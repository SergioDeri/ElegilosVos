// Proceso de notificaciones push (ticket 15).
//
// Recibe un cliente de SERVICE ROLE (lee suscripciones y Alineaciones de todos
// los Hinchas, `evento_disponibilidad` y `notificacion_enviada`), un `ahora`
// explícito y la función que envía un push (inyectada: en producción la de
// `./web-push`, en los tests un doble). Por eso no importa `server-only` ni
// `crearClienteAdmin`: lo hacen sus llamadores (la ruta de cron).
//
// Qué avisar a quién lo decide `avisosPendientes` de `@/domain/notificaciones`,
// según el Club Favorito y las preferencias de cada Hincha
// (`preferencia_notificacion`). La Selección avisa Votación abierta y Cierra
// pronto (feature Selección, ticket 13), Convocatoria cargada y Gran Ausente
// final (ticket 14): estos dos se detectan por el estado (hay Convocatoria /
// hay 11 Elegido con Convocatoria) y no desde la acción del backoffice, así
// que una Convocatoria cargada tarde se avisa en la siguiente corrida.
// Cada aviso se registra en `notificacion_enviada` con ON CONFLICT DO NOTHING
// ANTES de enviarlo, y solo se envía si esta corrida lo insertó: aunque dos
// corridas se pisen, nadie recibe dos veces la misma notificación (a lo sumo
// una; si el envío falla no se reintenta). Las suscripciones a las que el
// servicio push responde 404/410 (vencidas) se borran.
import type { SupabaseClient } from "@supabase/supabase-js";
import { alineacionDesdeFila, COLUMNAS_ALINEACION } from "@/domain/armado";
import { votacionAbierta } from "@/domain/calendario";
import { estadoResultadoDeLaBase } from "@/domain/cierre";
import { aparicionesDesdeJson, type Apariciones } from "@/domain/destacados";
import { CLUBES, esClubId, SELECCION, type ClubId } from "@/domain/comun/tipos";
import {
  ANTIGUEDAD_MAXIMA_DEL_RESULTADO_MS,
  avisosPendientes,
  type Aviso,
  type DatosDeLaSeleccion,
  type DatosDelClub,
  type HinchaConSuscripcion,
  type MensajePush,
  type NotificacionEnviada,
  type ResultadoParaAvisos,
  type ConvocatoriaParaAvisos,
  type ResultadoDeLaSeleccionParaAvisos,
  type SuscripcionPush,
  type TipoNotificacion,
  preferenciasDesdeFila,
  votacionAbiertaDelClub,
  votacionesAbiertasDeLaSeleccion,
  preferenciasDe,
} from "@/domain/notificaciones";
import { aparicionesDeVotacion } from "@/domain/votacion";
import { leerPartidos, leerPlantel } from "@/lib/club/lecturas";
import { leerAlineacionesDelPartido } from "@/lib/votacion/conteo";
import type { Database } from "@/lib/supabase/database.types";

type ClienteServicio = SupabaseClient<Database>;

/** "vencida": el servicio push respondió 404/410 (hay que borrar la suscripción). */
export type ResultadoEnvio = "ok" | "vencida" | "error";
export type EnviarPush = (suscripcion: SuscripcionPush, mensaje: MensajePush) => Promise<ResultadoEnvio>;

export interface ResumenNotificaciones {
  /** Avisos registrados (y enviados) en esta corrida. */
  avisos: number;
  /** Pushes entregados al servicio push (un aviso va a cada dispositivo del Hincha). */
  enviados: number;
  /** Pushes que fallaron por otro motivo (no se reintentan). */
  fallidos: number;
  /** Suscripciones vencidas borradas. */
  suscripcionesBorradas: number;
}

const PAGINA = 1000;
const LOTE = 500;
const ENVIOS_EN_PARALELO = 20;

interface Suscripcion extends SuscripcionPush {
  id: string;
}

export async function enviarNotificaciones(
  supabase: ClienteServicio,
  ahora: Date,
  enviar: EnviarPush,
): Promise<ResumenNotificaciones> {
  const resumen: ResumenNotificaciones = { avisos: 0, enviados: 0, fallidos: 0, suscripcionesBorradas: 0 };
  const { hinchas, suscripciones } = await cargarSuscripciones(supabase);
  if (hinchas.length === 0) return resumen;

  const clubes: DatosDelClub[] = [];
  for (const club of CLUBES) {
    const ids = hinchas.filter((h) => h.club === club && preferenciasDe(h).miClub).map((h) => h.id);
    if (ids.length) clubes.push(await cargarClub(supabase, club, ahora, ids));
  }
  const seleccion = hinchas.some((h) => preferenciasDe(h).seleccion)
    ? await cargarSeleccion(supabase, ahora)
    : undefined;
  const referencias = new Set<string>();
  if (seleccion) {
    for (const v of votacionesAbiertasDeLaSeleccion(seleccion, ahora)) referencias.add(v.partidoId);
    for (const r of seleccion.resultados ?? []) referencias.add(r.partidoId);
  }
  for (const c of clubes) {
    const abierta = votacionAbiertaDelClub(c, ahora);
    if (abierta) referencias.add(abierta.partidoId);
    for (const r of c.resultados) referencias.add(r.partidoId);
    for (const e of c.eventos) referencias.add(e.id);
  }
  const yaEnviadas = await cargarEnviadas(supabase, [...referencias]);

  if (seleccion) seleccion.apariciones = await cargarAparicionesProvisorias(supabase, seleccion, hinchas, yaEnviadas, ahora);

  const avisos = avisosPendientes({ ahora, hinchas, clubes, seleccion, yaEnviadas });
  const propios = await registrar(supabase, avisos);
  resumen.avisos = propios.length;

  const vencidas = new Set<string>();
  const envios = propios.flatMap((aviso) => (suscripciones.get(aviso.hinchaId) ?? []).map((s) => ({ aviso, s })));
  await enParalelo(envios, ENVIOS_EN_PARALELO, async ({ aviso, s }) => {
    if (vencidas.has(s.id)) return;
    const resultado = await enviar(s, aviso.mensaje).catch((): ResultadoEnvio => "error");
    if (resultado === "ok") resumen.enviados++;
    else if (resultado === "error") resumen.fallidos++;
    else if (!vencidas.has(s.id)) {
      vencidas.add(s.id);
      const { error } = await supabase.from("suscripcion_push").delete().eq("id", s.id);
      if (error) throw error;
      resumen.suscripcionesBorradas++;
    }
  });
  return resumen;
}

async function cargarSuscripciones(supabase: ClienteServicio) {
  const hinchas = new Map<string, HinchaConSuscripcion>();
  const suscripciones = new Map<string, Suscripcion[]>();
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from("suscripcion_push")
      .select("id, hincha_id, endpoint, p256dh, auth, perfil(club_favorito_id, preferencia_notificacion(mi_club, seleccion))")
      .order("id")
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;
    for (const fila of data) {
      if (!fila.perfil) continue;
      const club = fila.perfil.club_favorito_id;
      hinchas.set(fila.hincha_id, {
        id: fila.hincha_id,
        // Sin Club Favorito: solo avisos de la Selección.
        club: esClubId(club) ? club : null,
        preferencias: preferenciasDesdeFila(fila.perfil.preferencia_notificacion),
      });
      const lista = suscripciones.get(fila.hincha_id) ?? [];
      lista.push({ id: fila.id, endpoint: fila.endpoint, p256dh: fila.p256dh, auth: fila.auth });
      suscripciones.set(fila.hincha_id, lista);
    }
    if (data.length < PAGINA) return { hinchas: [...hinchas.values()], suscripciones };
  }
}

async function cargarClub(
  supabase: ClienteServicio,
  club: ClubId,
  ahora: Date,
  hinchaIds: string[],
): Promise<DatosDelClub> {
  const datos: DatosDelClub = {
    club,
    partidos: (await leerPartidos(supabase, club)).map((p) => ({ ...p, rival: p.rival?.nombre ?? "el Rival" })),
    resultados: await cargarResultados(supabase, club, ahora),
    eventos: [],
    plantel: [],
    alineaciones: [],
  };
  const abierta = votacionAbierta(datos.partidos, ahora);
  if (!abierta) return datos;

  // Si el Partido se postergó después del cierre, el Calendario la ve
  // abierta pero ya tiene resultado congelado: no se reabre ni se avisa.
  const { data: congelado, error: errorResultado } = await supabase
    .from("resultado_votacion")
    .select("partido_id")
    .eq("partido_id", abierta.partidoId)
    .maybeSingle();
  if (errorResultado) throw errorResultado;
  if (congelado) return { ...datos, partidosConResultado: [abierta.partidoId] };

  const { data: eventos, error } = await supabase
    .from("evento_disponibilidad")
    .select("id, jugador_id, disponibilidad_nueva, momento")
    .eq("club_id", club)
    .gte("momento", abierta.abre.toISOString())
    .lte("momento", ahora.toISOString());
  if (error) throw error;
  if (eventos.length === 0) return datos;

  return {
    ...datos,
    eventos: eventos.map((e) => ({
      id: e.id,
      jugadorId: e.jugador_id,
      disponibilidadNueva: e.disponibilidad_nueva,
      momento: new Date(e.momento),
    })),
    plantel: await leerPlantel(supabase, club),
    alineaciones: await cargarAlineaciones(supabase, abierta.partidoId, hinchaIds),
  };
}

/**
 * Partidos de la Selección; de sus Votaciones abiertas, las que ya tienen
 * resultado congelado; y para los avisos del ticket 14, las Convocatorias y
 * los resultados `con_once` que pueden avisarse (Votaciones abiertas, cierres
 * de las últimas 48 horas y Convocatorias cargadas o corregidas en ese lapso).
 * Las apariciones provisorias se cargan aparte (`cargarAparicionesProvisorias`).
 */
async function cargarSeleccion(supabase: ClienteServicio, ahora: Date): Promise<DatosDeLaSeleccion> {
  const partidos = (await leerPartidos(supabase, SELECCION)).map((p) => ({ ...p, rival: p.rival?.nombre ?? "el Rival" }));
  const abiertas = votacionesAbiertasDeLaSeleccion({ partidos }, ahora).map((v) => v.partidoId);
  const desde = new Date(ahora.getTime() - ANTIGUEDAD_MAXIMA_DEL_RESULTADO_MS).toISOString();

  // Resultados que cerraron hace poco y Convocatorias que se cargaron hace poco.
  const { data: cerrados, error } = await supabase
    .from("resultado_votacion")
    .select("partido_id, estado, cierre, apariciones, partido!inner(club_id)")
    .eq("partido.club_id", SELECCION)
    .gte("cierre", desde)
    .lte("cierre", ahora.toISOString());
  if (error) throw error;
  const recientes = await leerConvocatoriasDePartidos(supabase, { actualizadasDesde: desde, actualizadasHasta: ahora.toISOString() });

  const convocatorias = new Map(recientes.map((c) => [c.partidoId, c]));
  const faltanConvocatorias = [...new Set([...abiertas, ...cerrados.map((r) => r.partido_id)])].filter(
    (id) => !convocatorias.has(id),
  );
  for (const c of await leerConvocatoriasDePartidos(supabase, { partidos: faltanConvocatorias })) convocatorias.set(c.partidoId, c);

  const resultados = new Map(cerrados.map((r) => [r.partido_id, r]));
  const faltanResultados = [...new Set([...abiertas, ...convocatorias.keys()])].filter((id) => !resultados.has(id));
  if (faltanResultados.length) {
    const { data, error: errorResultados } = await supabase
      .from("resultado_votacion")
      .select("partido_id, estado, cierre, apariciones, partido!inner(club_id)")
      .in("partido_id", faltanResultados);
    if (errorResultados) throw errorResultados;
    for (const r of data) resultados.set(r.partido_id, r);
  }

  const plantel =
    convocatorias.size > 0 ? (await leerPlantel(supabase, SELECCION)).map((j) => ({ id: j.id, nombre: j.nombre })) : [];
  return {
    partidos,
    partidosConResultado: abiertas.filter((id) => resultados.has(id)),
    convocatorias: [...convocatorias.values()],
    resultados: [...resultados.values()].map(
      (r): ResultadoDeLaSeleccionParaAvisos => ({
        partidoId: r.partido_id,
        estado: estadoResultadoDeLaBase(r.estado),
        cierre: new Date(r.cierre),
        apariciones: aparicionesDesdeJson(r.apariciones),
      }),
    ),
    plantel,
  };
}

/** Convocatorias de Partidos (de la Selección): por Partido o cargadas/corregidas desde una hora. */
async function leerConvocatoriasDePartidos(
  supabase: ClienteServicio,
  filtro: { partidos: string[] } | { actualizadasDesde: string; actualizadasHasta: string },
): Promise<ConvocatoriaParaAvisos[]> {
  if ("partidos" in filtro && filtro.partidos.length === 0) return [];
  let consulta = supabase
    .from("convocatoria_partido")
    .select("partido_id, convocatoria!inner(actualizado_en, convocatoria_jugador(jugador_id))");
  consulta =
    "partidos" in filtro
      ? consulta.in("partido_id", filtro.partidos)
      : consulta
          .gte("convocatoria.actualizado_en", filtro.actualizadasDesde)
          .lte("convocatoria.actualizado_en", filtro.actualizadasHasta);
  const { data, error } = await consulta;
  if (error) throw error;
  return data.map((f) => ({
    partidoId: f.partido_id,
    convocados: f.convocatoria.convocatoria_jugador.map((j) => j.jugador_id).sort(),
    actualizadaEn: new Date(f.convocatoria.actualizado_en),
  }));
}

/**
 * Apariciones de las Votaciones abiertas de la Selección con Convocatoria,
 * para el Gran Ausente provisorio. Solo cuenta las que todavía le deben el
 * aviso a algún Hincha (contar todas las Alineaciones en cada corrida sería caro).
 */
async function cargarAparicionesProvisorias(
  supabase: ClienteServicio,
  seleccion: DatosDeLaSeleccion,
  hinchas: readonly HinchaConSuscripcion[],
  yaEnviadas: readonly NotificacionEnviada[],
  ahora: Date,
): Promise<DatosDeLaSeleccion["apariciones"]> {
  const destinatarios = hinchas.filter((h) => preferenciasDe(h).seleccion).map((h) => h.id);
  const avisados = new Set(
    yaEnviadas.filter((n) => n.tipo === "convocatoria_cargada").map((n) => `${n.hinchaId}|${n.referencia}`),
  );
  const apariciones: { partidoId: string; apariciones: Apariciones }[] = [];
  for (const { partidoId } of votacionesAbiertasDeLaSeleccion(seleccion, ahora)) {
    if (!seleccion.convocatorias?.some((c) => c.partidoId === partidoId)) continue;
    if (destinatarios.every((id) => avisados.has(`${id}|${partidoId}`))) continue;
    const filas = await leerAlineacionesDelPartido(supabase, partidoId);
    apariciones.push({ partidoId, apariciones: aparicionesDeVotacion(filas) });
  }
  return apariciones;
}

async function cargarResultados(supabase: ClienteServicio, club: ClubId, ahora: Date): Promise<ResultadoParaAvisos[]> {
  const { data, error } = await supabase
    .from("resultado_votacion")
    .select("partido_id, estado, cierre, partido!inner(club_id)")
    .eq("partido.club_id", club)
    .eq("estado", "con_once")
    .gte("cierre", new Date(ahora.getTime() - ANTIGUEDAD_MAXIMA_DEL_RESULTADO_MS).toISOString())
    .lte("cierre", ahora.toISOString());
  if (error) throw error;
  return data.map((r) => ({
    partidoId: r.partido_id,
    estado: estadoResultadoDeLaBase(r.estado),
    cierre: new Date(r.cierre),
  }));
}

/** Alineaciones del Partido de los Hinchas con suscripción (en tandas, para no armar URLs enormes). */
async function cargarAlineaciones(
  supabase: ClienteServicio,
  partidoId: string,
  hinchaIds: string[],
): Promise<DatosDelClub["alineaciones"]> {
  const alineaciones: { hinchaId: string; alineacion: ReturnType<typeof alineacionDesdeFila> }[] = [];
  for (let i = 0; i < hinchaIds.length; i += 100) {
    const { data, error } = await supabase
      .from("alineacion")
      .select(`hincha_id, ${COLUMNAS_ALINEACION}`)
      .eq("partido_id", partidoId)
      .in("hincha_id", hinchaIds.slice(i, i + 100));
    if (error) throw error;
    for (const fila of data) alineaciones.push({ hinchaId: fila.hincha_id, alineacion: alineacionDesdeFila(fila) });
  }
  return alineaciones;
}

async function cargarEnviadas(supabase: ClienteServicio, referencias: string[]): Promise<NotificacionEnviada[]> {
  const enviadas: NotificacionEnviada[] = [];
  for (let i = 0; i < referencias.length; i += 100) {
    const tanda = referencias.slice(i, i + 100);
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await supabase
        .from("notificacion_enviada")
        .select("hincha_id, tipo, referencia")
        .in("referencia", tanda)
        .order("hincha_id")
        .order("tipo")
        .order("referencia")
        .range(desde, desde + PAGINA - 1);
      if (error) throw error;
      for (const f of data) enviadas.push({ hinchaId: f.hincha_id, tipo: f.tipo as TipoNotificacion, referencia: f.referencia });
      if (data.length < PAGINA) break;
    }
  }
  return enviadas;
}

/** Inserta los avisos en el registro de enviados y devuelve solo los que insertó ESTA corrida. */
async function registrar(supabase: ClienteServicio, avisos: Aviso[]): Promise<Aviso[]> {
  const clave = (n: { hincha_id: string; tipo: string; referencia: string }) => `${n.hincha_id}|${n.tipo}|${n.referencia}`;
  const propios: Aviso[] = [];
  for (let i = 0; i < avisos.length; i += LOTE) {
    const lote = avisos.slice(i, i + LOTE);
    const { data, error } = await supabase
      .from("notificacion_enviada")
      .upsert(
        lote.map((a) => ({ hincha_id: a.hinchaId, tipo: a.tipo, referencia: a.referencia })),
        { onConflict: "hincha_id,tipo,referencia", ignoreDuplicates: true },
      )
      .select("hincha_id, tipo, referencia");
    if (error) throw error;
    const insertados = new Set(data.map(clave));
    propios.push(
      ...lote.filter((a) => insertados.has(clave({ hincha_id: a.hinchaId, tipo: a.tipo, referencia: a.referencia }))),
    );
  }
  return propios;
}

async function enParalelo<T>(items: T[], limite: number, tarea: (item: T) => Promise<void>): Promise<void> {
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (siguiente < items.length) await tarea(items[siguiente++]!);
  });
  await Promise.all(trabajadores);
}

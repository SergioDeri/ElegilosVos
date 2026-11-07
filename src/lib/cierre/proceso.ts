// Proceso de cierre de Votaciones (ticket 12, servidor).
//
// Para cada Partido con la hora de cierre pasada y sin resultado congelado:
//   * cancelado → 'anulada'; ventana vacía (abre >= cierra) → 'nunca_abrio';
//   * si no, materializa las Alineaciones heredadas pendientes (ticket 10)
//     como justo antes del cierre y cuenta TODAS las Alineaciones guardadas con la Disponibilidad a
//     la hora de cierre → 'con_once' o 'sin_alineaciones'.
// y lo inserta con INSERT ... ON CONFLICT DO NOTHING: correrlo dos veces (o
// en paralelo) no cambia ni duplica nada, y la base rechaza cualquier
// modificación posterior (resultado inmutable).
//
// Necesita un cliente con la service role (`crearClienteAdmin()`); no lo crea
// acá para poder probarlo con un `ahora` explícito.
//
// Límites (documentados en docs/DESARROLLO.md):
//   * Las Alineaciones son las guardadas cuando corre el proceso. Después del
//     cierre ningún Hincha puede escribirlas, pero si alguien borra su cuenta
//     entre el cierre y el proceso, su Alineación ya no cuenta.
//   * Solo cuentan las Alineaciones de Hinchas cuyo Club Favorito de hoy es
//     el Club del Partido (`leerAlineacionesDelPartido`, corrección A).
//   * La Disponibilidad se reconstruye a la hora de cierre con
//     `evento_disponibilidad`; la pertenencia al Plantel, el número y la
//     posición natural se toman AL MOMENTO DE CORRER el cierre (no tienen
//     historial). Con el cron cada minuto la diferencia con la hora de cierre
//     es despreciable, así que no se reconstruyen.
import {
  decidirCierre,
  disponibilidadAlCierre,
  estadoResultadoDeLaBase,
  resultadoDelConteo,
  type EstadoResultado,
} from "@/domain/cierre";
import { clubIdDeLaBase, type ClubId } from "@/domain/comun/tipos";
import { materializarHerencias } from "@/lib/herencia/materializar";
import { contarVotacion } from "@/domain/votacion";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { leerAlineacionesDelPartido, leerJugadoresParaConteo } from "@/lib/votacion/conteo";

type ClienteSupabase = SupabaseClient<Database>;

/** Cambios de Disponibilidad del Club desde `desde` (paginado por id). */
async function leerCambiosDesde(cliente: ClienteSupabase, club: ClubId, desde: Date) {
  const cambios: { jugadorId: string; disponibilidadAnterior: Database["public"]["Enums"]["disponibilidad"]; momento: Date }[] = [];
  let ultimoId: string | null = null;
  for (;;) {
    let consulta = cliente
      .from("evento_disponibilidad")
      .select("id, jugador_id, disponibilidad_anterior, momento")
      .eq("club_id", club)
      .gte("momento", desde.toISOString())
      .order("id")
      .limit(1000);
    if (ultimoId !== null) consulta = consulta.gt("id", ultimoId);
    const { data, error } = await consulta;
    if (error) throw error;
    for (const c of data) {
      cambios.push({ jugadorId: c.jugador_id, disponibilidadAnterior: c.disponibilidad_anterior, momento: new Date(c.momento) });
    }
    if (data.length < 1000) return cambios;
    ultimoId = data[data.length - 1]!.id;
  }
}

export interface CierreDePartido {
  partidoId: string;
  /** Estado del resultado congelado, o `null` si todavía no corresponde cerrar. */
  estado: EstadoResultado | null;
  /** `true` si esta corrida insertó el resultado; `false` si ya existía o no correspondía. */
  creado: boolean;
}

interface VotacionFila {
  partido_id: string;
  club_id: string;
  estado: string;
  abre: string;
  cierra: string;
}

async function congelar(cliente: ClienteSupabase, votacion: VotacionFila, ahora: Date): Promise<CierreDePartido> {
  const cierra = new Date(votacion.cierra);
  const decision = decidirCierre(
    {
      estado: votacion.estado as "pendiente" | "abierta" | "cerrada" | "anulada",
      abre: new Date(votacion.abre),
      cierra,
    },
    ahora,
  );
  if (decision.accion === "esperar") return { partidoId: votacion.partido_id, estado: null, creado: false };

  let aInsertar: {
    estado: EstadoResultado;
    esquema: string | null;
    once: Json | null;
    detalle: Json | null;
    alineaciones_que_cuentan: number;
  };
  if (decision.accion === "registrar") {
    aInsertar = { estado: decision.estado, esquema: null, once: null, detalle: null, alineaciones_que_cuentan: 0 };
  } else {
    // Herencias que el cron del ticket 10 no llegó a materializar: se crean
    // como si fuera justo antes del cierre, para que esos votos cuenten.
    const club = clubIdDeLaBase(votacion.club_id);
    await materializarHerencias(cliente, new Date(cierra.getTime() - 1), { club });
    // Lectura + adaptación + conteo del ticket 11 (sin hincha_id; el detalle
    // ya sale por `soloAgregados`), con la Disponibilidad al cierre.
    const [filas, jugadores, cambios] = await Promise.all([
      leerAlineacionesDelPartido(cliente, votacion.partido_id),
      leerJugadoresParaConteo(cliente, club),
      leerCambiosDesde(cliente, club, cierra),
    ]);
    const r = resultadoDelConteo(contarVotacion(filas, disponibilidadAlCierre(jugadores, cambios, cierra)));
    aInsertar = {
      estado: r.estado,
      esquema: r.esquema,
      once: r.once as unknown as Json,
      detalle: r.detalle as unknown as Json,
      alineaciones_que_cuentan: r.alineacionesQueCuentan,
    };
  }

  const { data, error } = await cliente
    .from("resultado_votacion")
    .upsert(
      { partido_id: votacion.partido_id, cierre: cierra.toISOString(), ...aInsertar },
      { onConflict: "partido_id", ignoreDuplicates: true },
    )
    .select("partido_id");
  if (error) throw error;
  const creado = (data ?? []).length > 0;
  if (creado) return { partidoId: votacion.partido_id, estado: aInsertar.estado, creado };

  // Otra corrida lo congeló primero: devolvemos el que quedó.
  const { data: existente, error: errorLectura } = await cliente
    .from("resultado_votacion")
    .select("estado")
    .eq("partido_id", votacion.partido_id)
    .single();
  if (errorLectura) throw errorLectura;
  return { partidoId: votacion.partido_id, estado: estadoResultadoDeLaBase(existente.estado), creado: false };
}

/**
 * Cierra (si corresponde en `ahora`) la Votación de un Partido. Idempotente:
 * si ya tiene resultado, lo devuelve sin recalcular.
 */
export async function cerrarVotacion(cliente: ClienteSupabase, partidoId: string, ahora: Date): Promise<CierreDePartido> {
  const { data: existente, error: errorExistente } = await cliente
    .from("resultado_votacion")
    .select("estado")
    .eq("partido_id", partidoId)
    .maybeSingle();
  if (errorExistente) throw errorExistente;
  if (existente) return { partidoId, estado: estadoResultadoDeLaBase(existente.estado), creado: false };

  const [{ data: partido, error: errorPartido }, { data: votacion, error: errorVotacion }] = await Promise.all([
    cliente.from("partido").select("club_id").eq("id", partidoId).maybeSingle(),
    cliente.rpc("votacion_de_partido", { partido: partidoId, ahora: ahora.toISOString() }).maybeSingle(),
  ]);
  if (errorPartido) throw errorPartido;
  if (errorVotacion) throw errorVotacion;
  if (!partido || !votacion) return { partidoId, estado: null, creado: false };
  return congelar(cliente, { ...votacion, club_id: partido.club_id }, ahora);
}

export interface ResumenCierre {
  cerrados: CierreDePartido[];
  errores: { partidoId: string; mensaje: string }[];
}

/**
 * Cierra todas las Votaciones vencidas en `ahora` que no tienen resultado.
 * Un error en un Partido no frena a los demás (se reintenta en la próxima
 * corrida). Procesa hasta 1000 por corrida (límite de PostgREST).
 */
export async function cerrarVotacionesVencidas(cliente: ClienteSupabase, ahora: Date): Promise<ResumenCierre> {
  const { data, error } = await cliente.rpc("votaciones_por_cerrar", { ahora: ahora.toISOString() });
  if (error) throw error;
  const resumen: ResumenCierre = { cerrados: [], errores: [] };
  for (const votacion of data ?? []) {
    try {
      resumen.cerrados.push(await congelar(cliente, votacion, ahora));
    } catch (e) {
      resumen.errores.push({
        partidoId: votacion.partido_id,
        mensaje: e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e),
      });
    }
  }
  return resumen;
}

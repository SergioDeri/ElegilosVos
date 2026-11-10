// Materialización de la Herencia de Alineación (ticket 10).
//
// Lee y escribe con un cliente de SERVICE ROLE que recibe por parámetro: las
// Alineaciones heredadas son de otros Hinchas y conservan sus horas originales
// (el trigger de `alineacion` solo sella horas en pedidos de la API). Por eso
// este archivo no importa `crearClienteAdmin`: lo hacen sus llamadores de
// servidor (la ruta de cron y `asegurarHerencia`), y los tests de RLS lo
// llaman con su propio cliente de servicio.
//
// Cada Hincha hereda su Alineación MÁS RECIENTE del Club entre todos los
// Partidos anteriores no cancelados (no solo la del inmediatamente anterior,
// que puede no tener Alineaciones si su Votación nunca abrió). Para no leer
// toda la historia en cada corrida, solo se buscan las Alineaciones viejas de
// los Hinchas del Club que todavía no tienen la del Partido abierto
// ("pendientes"), en tandas y paginando.
//
// La Selección (ticket 07 de la Selección) también se procesa: no tiene
// Hinchas propios, así que los "pendientes" son todos los Hinchas con perfil,
// y puede tener dos Votaciones abiertas (fecha doble, ADR-0005). Se procesan
// en orden cronológico: la segunda copia lo que el Hincha tiene en la primera
// en ese momento (incluida la que la primera acaba de heredar).
//
// Qué heredar lo decide la lógica pura de `@/domain/herencia`. La escritura es
// `insert ... on conflict (hincha_id, partido_id) do nothing`: aunque dos
// corridas se pisen, nunca se duplica ni se pisa una Alineación existente.
import type { SupabaseClient } from "@supabase/supabase-js";
import { alineacionDesdeFila, COLUMNAS_ALINEACION, filaDesdeAlineacion } from "@/domain/armado";
import { CLUBES, esClubId, SELECCION, type ClubOSeleccion } from "@/domain/comun/tipos";
import type { JugadorDelPlantel } from "@/domain/editor";
import {
  alineacionesAHeredar,
  votacionesAHeredar,
  type AlineacionAnterior,
  type Herencia,
  type VotacionAHeredar,
} from "@/domain/herencia";
import { leerPartidos, leerPlantel } from "@/lib/club/lecturas";
import type { Database } from "@/lib/supabase/database.types";
import { leerPorId } from "@/lib/supabase/paginar";

type ClienteServicio = SupabaseClient<Database>;

const LOTE_INSERT = 500;
/** Hinchas por consulta de Alineaciones anteriores (los ids van en la URL). */
const LOTE_HINCHAS = 100;

export interface OpcionesMaterializar {
  /** Solo este Club o la Selección (por defecto, los Clubes y la Selección). */
  club?: ClubOSeleccion;
  /** Solo este Hincha (al entrar a la pantalla de armado). */
  hinchaId?: string;
}

/** Una por Votación abierta (en la Selección pueden ser dos), o una con `partidoId: null` si no hay qué heredar. */
export interface ResultadoClub {
  club: ClubOSeleccion;
  /** Partido con la Votación abierta, o null si no hay nada que heredar. */
  partidoId: string | null;
  /** Partido inmediatamente anterior (no cancelado); se hereda también de los previos. */
  anteriorId: string | null;
  /** Alineaciones heredadas creadas en esta corrida. */
  creadas: number;
}

/**
 * Para cada Votación abierta en `ahora` (de los Clubes y de la Selección),
 * crea la Alineación heredada para cada Hincha (del Club; en la Selección,
 * cualquiera) que todavía no tiene la del Partido abierto, a partir de su
 * Alineación más reciente en los Partidos anteriores no cancelados (o de la
 * que tiene en el anterior, si su Votación sigue abierta). Idempotente.
 */
export async function materializarHerencias(
  supabase: ClienteServicio,
  ahora: Date,
  opciones: OpcionesMaterializar = {},
): Promise<ResultadoClub[]> {
  const clubes: readonly ClubOSeleccion[] = opciones.club ? [opciones.club] : [...CLUBES, SELECCION];
  const resultados: ResultadoClub[] = [];
  for (const club of clubes) {
    const votaciones = votacionesAHeredar(await leerPartidos(supabase, club), ahora, club);
    if (votaciones.length === 0) resultados.push({ club, partidoId: null, anteriorId: null, creadas: 0 });
    // En orden cronológico: en una fecha doble, la segunda copia de la primera ya materializada.
    for (const votacion of votaciones) {
      resultados.push(await materializarVotacion(supabase, club, votacion, opciones.hinchaId));
    }
  }
  return resultados;
}

async function materializarVotacion(
  supabase: ClienteServicio,
  club: ClubOSeleccion,
  votacion: VotacionAHeredar,
  hinchaId: string | undefined,
): Promise<ResultadoClub> {
  const resultado = { club, partidoId: votacion.partidoId, anteriorId: votacion.anteriorId, creadas: 0 };

  const yaTienen = await cargarQuienesTienen(supabase, votacion.partidoId, hinchaId);
  const pendientes = (hinchaId ? [hinchaId] : await cargarHinchas(supabase, club)).filter((h) => !yaTienen.has(h));
  if (pendientes.length === 0) return resultado;

  let plantel: JugadorDelPlantel[] | null = null;
  for (let i = 0; i < pendientes.length; i += LOTE_HINCHAS) {
    const anteriores = await cargarAnteriores(supabase, club, pendientes.slice(i, i + LOTE_HINCHAS));
    if (anteriores.length === 0) continue;
    plantel ??= await leerPlantel(supabase, club);
    const herencias = alineacionesAHeredar({
      club,
      partidosAnteriores: votacion.partidosAnteriores,
      anteriorAbierta: votacion.anteriorAbierta,
      anteriores,
      yaTienen,
      plantel,
    });
    resultado.creadas += await insertar(supabase, votacion.partidoId, herencias);
  }
  return resultado;
}

async function insertar(supabase: ClienteServicio, partidoId: string, herencias: readonly Herencia[]): Promise<number> {
  let creadas = 0;
  for (let i = 0; i < herencias.length; i += LOTE_INSERT) {
    const filas = herencias.slice(i, i + LOTE_INSERT).map((h) => ({
      hincha_id: h.hinchaId,
      partido_id: partidoId,
      ...filaDesdeAlineacion(h.alineacion),
    }));
    const { data, error } = await supabase
      .from("alineacion")
      .upsert(filas, { onConflict: "hincha_id,partido_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    creadas += data.length;
  }
  return creadas;
}

/**
 * Las Alineaciones de estos Hinchas en Partidos del Club (todas: el dominio
 * elige la más reciente entre los anteriores no cancelados e ignora el resto),
 * con su Club Favorito de hoy. Pagina por `id` (keyset).
 */
async function cargarAnteriores(
  supabase: ClienteServicio,
  club: ClubOSeleccion,
  hinchas: readonly string[],
): Promise<AlineacionAnterior[]> {
  const filas = await leerPorId(() =>
    supabase
      .from("alineacion")
      .select(`id, hincha_id, partido_id, ${COLUMNAS_ALINEACION}, perfil(club_favorito_id), partido!inner(club_id)`)
      .in("hincha_id", hinchas)
      .eq("partido.club_id", club),
  );
  return filas.map((fila) => ({
    hinchaId: fila.hincha_id,
    partidoId: fila.partido_id,
    clubFavorito: esClubId(fila.perfil?.club_favorito_id) ? fila.perfil.club_favorito_id : null,
    alineacion: alineacionDesdeFila(fila),
  }));
}

/**
 * Ids de los Hinchas que pueden heredar (paginado por id): los que hoy tienen
 * a `club` de Club Favorito, o todos en la Selección.
 */
async function cargarHinchas(supabase: ClienteServicio, club: ClubOSeleccion): Promise<string[]> {
  const filas = await leerPorId(() => {
    const consulta = supabase.from("perfil").select("id");
    return club === SELECCION ? consulta : consulta.eq("club_favorito_id", club);
  });
  return filas.map((f) => f.id);
}

async function cargarQuienesTienen(
  supabase: ClienteServicio,
  partidoId: string,
  hinchaId: string | undefined,
): Promise<Set<string>> {
  const filas = await leerPorId(() => {
    const consulta = supabase.from("alineacion").select("id, hincha_id").eq("partido_id", partidoId);
    return hinchaId ? consulta.eq("hincha_id", hinchaId) : consulta;
  });
  return new Set(filas.map((f) => f.hincha_id));
}

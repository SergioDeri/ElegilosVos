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
// Qué heredar lo decide la lógica pura de `@/domain/herencia`. La escritura es
// `insert ... on conflict (hincha_id, partido_id) do nothing`: aunque dos
// corridas se pisen, nunca se duplica ni se pisa una Alineación existente.
import type { SupabaseClient } from "@supabase/supabase-js";
import { alineacionDesdeFila, COLUMNAS_ALINEACION, filaDesdeAlineacion } from "@/domain/armado";
import { CLUBES, esClubId, type ClubId } from "@/domain/comun/tipos";
import type { JugadorDelPlantel } from "@/domain/editor";
import { alineacionesAHeredar, votacionAHeredar, type AlineacionAnterior, type Herencia } from "@/domain/herencia";
import { leerPartidos, leerPlantel } from "@/lib/club/lecturas";
import type { Database } from "@/lib/supabase/database.types";
import { leerPorId } from "@/lib/supabase/paginar";

type ClienteServicio = SupabaseClient<Database>;

const LOTE_INSERT = 500;
/** Hinchas por consulta de Alineaciones anteriores (los ids van en la URL). */
const LOTE_HINCHAS = 100;

export interface OpcionesMaterializar {
  /** Solo este Club (por defecto, todos). */
  club?: ClubId;
  /** Solo este Hincha (al entrar a la pantalla de armado). */
  hinchaId?: string;
}

export interface ResultadoClub {
  club: ClubId;
  /** Partido con la Votación abierta, o null si no hay nada que heredar. */
  partidoId: string | null;
  /** Partido inmediatamente anterior (no cancelado); se hereda también de los previos. */
  anteriorId: string | null;
  /** Alineaciones heredadas creadas en esta corrida. */
  creadas: number;
}

/**
 * Para cada Club con Votación abierta en `ahora`, crea la Alineación heredada
 * para cada Hincha del Club que todavía no tiene la del Partido abierto, a
 * partir de su Alineación más reciente en los Partidos anteriores no
 * cancelados. Idempotente.
 */
export async function materializarHerencias(
  supabase: ClienteServicio,
  ahora: Date,
  opciones: OpcionesMaterializar = {},
): Promise<ResultadoClub[]> {
  const clubes = opciones.club ? [opciones.club] : CLUBES;
  const resultados: ResultadoClub[] = [];
  for (const club of clubes) {
    resultados.push(await materializarClub(supabase, club, ahora, opciones.hinchaId));
  }
  return resultados;
}

async function materializarClub(
  supabase: ClienteServicio,
  club: ClubId,
  ahora: Date,
  hinchaId: string | undefined,
): Promise<ResultadoClub> {
  const votacion = votacionAHeredar(await leerPartidos(supabase, club), ahora);
  if (!votacion) return { club, partidoId: null, anteriorId: null, creadas: 0 };
  const resultado = { club, partidoId: votacion.partidoId, anteriorId: votacion.anteriorId, creadas: 0 };

  const yaTienen = await cargarQuienesTienen(supabase, votacion.partidoId, hinchaId);
  const pendientes = (hinchaId ? [hinchaId] : await cargarHinchasDelClub(supabase, club)).filter((h) => !yaTienen.has(h));
  if (pendientes.length === 0) return resultado;

  let plantel: JugadorDelPlantel[] | null = null;
  for (let i = 0; i < pendientes.length; i += LOTE_HINCHAS) {
    const anteriores = await cargarAnteriores(supabase, club, pendientes.slice(i, i + LOTE_HINCHAS));
    if (anteriores.length === 0) continue;
    plantel ??= await leerPlantel(supabase, club);
    const herencias = alineacionesAHeredar({
      club,
      partidosAnteriores: votacion.partidosAnteriores,
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
  club: ClubId,
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

/** Ids de los Hinchas cuyo Club Favorito de hoy es `club` (paginado por id). */
async function cargarHinchasDelClub(supabase: ClienteServicio, club: ClubId): Promise<string[]> {
  const filas = await leerPorId(() => supabase.from("perfil").select("id").eq("club_favorito_id", club));
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

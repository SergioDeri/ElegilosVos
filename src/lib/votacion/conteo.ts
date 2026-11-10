// Lectura + conteo de una Votación desde la base (ticket 11; lo reutiliza el
// cierre del ticket 12).
//
// Recibe el cliente de Supabase por parámetro y no tiene secretos: para contar
// todas las Alineaciones hace falta la SERVICE ROLE (RLS solo deja leer la
// propia), así que el que llama es responsable de pasar `crearClienteAdmin()`
// desde código de servidor y de devolver al Hincha SOLO el resultado agregado.
//
//   const resultado = await contarPartido(crearClienteAdmin(), partidoId);
//
// Nunca se devuelve `hincha_id`: las filas no tienen con qué identificar al Hincha.
//
// Solo cuentan las Alineaciones de Hinchas cuyo Club Favorito de HOY es el
// Club del Partido: si el Admin le cambia el Club a un Hincha, su Alineación
// del Club anterior deja de contar (además `cambiar_club_favorito` la borra si
// la Votación está abierta). El filtro se hace en la base con un join a
// `perfil` y no se expone en la salida.
//
// La Selección todavía no se cuenta (tickets 05 y 10 del feature Selección):
// para un Partido de la Selección, `leerAlineacionesDelPartido` devuelve
// vacío y `contarPartido` null, como si el Partido no existiera.
import type { SupabaseClient } from "@supabase/supabase-js";
import { esClubId, type ClubId } from "@/domain/comun/tipos";
import type { ResultadoConteo } from "@/domain/conteo";
import {
  COLUMNAS_ALINEACION_PARA_CONTEO,
  COLUMNAS_JUGADOR_PARA_CONTEO,
  contarVotacion,
  type FilaAlineacion,
  type FilaJugadorParaConteo,
} from "@/domain/votacion";
import type { Database } from "@/lib/supabase/database.types";
import { leerPorId, TAMANO_DE_PAGINA } from "@/lib/supabase/paginar";

type Cliente = SupabaseClient<Database>;

/**
 * Las Alineaciones guardadas del Partido que cuentan: las de Hinchas cuyo Club
 * Favorito de hoy es el Club del Partido (sin `hincha_id`). Vacío si el
 * Partido no existe. Pagina por `id` (keyset): no se saltea ni repite filas
 * aunque se inserten otras durante la lectura, y no depende del límite de
 * filas del servidor.
 */
export async function leerAlineacionesDelPartido(
  cliente: Cliente,
  partidoId: string,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
): Promise<FilaAlineacion[]> {
  const club = await clubDelPartido(cliente, partidoId);
  return club === null ? [] : leerAlineaciones(cliente, partidoId, club, tamanoDePagina);
}

/** El Club del Partido; null si no existe o es de la Selección (todavía no se cuenta). */
async function clubDelPartido(cliente: Cliente, partidoId: string): Promise<ClubId | null> {
  const { data, error } = await cliente.from("partido").select("club_id").eq("id", partidoId).maybeSingle();
  if (error) throw error;
  return data && esClubId(data.club_id) ? data.club_id : null;
}

async function leerAlineaciones(
  cliente: Cliente,
  partidoId: string,
  club: ClubId,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
): Promise<FilaAlineacion[]> {
  const filas = await leerPorId(
    () =>
      cliente
        .from("alineacion")
        // `perfil!inner` solo para filtrar por el Club Favorito de hoy; no se copia a la salida.
        .select(`id, ${COLUMNAS_ALINEACION_PARA_CONTEO}, perfil!inner(club_favorito_id)`)
        .eq("partido_id", partidoId)
        .eq("perfil.club_favorito_id", club),
    tamanoDePagina,
  );
  return filas.map((f) => ({
    esquema: f.esquema,
    esquema_elegido_a_mano: f.esquema_elegido_a_mano,
    esquema_modificado_en: f.esquema_modificado_en,
    puestos: f.puestos,
  }));
}

/** Todos los Jugadores del Club (incluidos no Disponibles y bajas: el Motor descarta sus votos). */
export async function leerJugadoresParaConteo(cliente: Cliente, club: ClubId): Promise<FilaJugadorParaConteo[]> {
  const { data, error } = await cliente.from("jugador").select(COLUMNAS_JUGADOR_PARA_CONTEO).eq("club_id", club);
  if (error) throw error;
  return data;
}

export interface ConteoDePartido {
  readonly club: ClubId;
  readonly resultado: ResultadoConteo;
}

/** Cuenta la Votación del Partido con la Disponibilidad actual. `null` si el Partido no existe. */
export async function contarPartido(cliente: Cliente, partidoId: string): Promise<ConteoDePartido | null> {
  const club = await clubDelPartido(cliente, partidoId);
  if (club === null) return null;
  const [filas, jugadores] = await Promise.all([
    leerAlineaciones(cliente, partidoId, club),
    leerJugadoresParaConteo(cliente, club),
  ]);
  return { club, resultado: contarVotacion(filas, jugadores) };
}

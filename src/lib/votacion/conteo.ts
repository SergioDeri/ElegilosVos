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
// En la Selección (ticket 08 del feature Selección) cuentan las Alineaciones
// de todos los Hinchas, sin importar su Club Favorito: un solo resultado, sin
// separar por hinchada. El cierre (`src/lib/cierre/proceso.ts`) usa esta
// misma lectura y, en la Selección, congela además las apariciones (ticket 10).
import type { SupabaseClient } from "@supabase/supabase-js";
import { esClubOSeleccion, SELECCION, type ClubOSeleccion } from "@/domain/comun/tipos";
import type { ResultadoConteo } from "@/domain/conteo";
import type { Apariciones } from "@/domain/destacados";
import {
  aparicionesDeVotacion,
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
 * Las Alineaciones guardadas del Partido que cuentan (sin `hincha_id`): en un
 * Club, las de Hinchas cuyo Club Favorito de hoy es el Club del Partido; en la
 * Selección, todas. Vacío si el Partido no existe. Pagina por `id` (keyset):
 * no se saltea ni repite filas aunque se inserten otras durante la lectura, y
 * no depende del límite de filas del servidor.
 */
export async function leerAlineacionesDelPartido(
  cliente: Cliente,
  partidoId: string,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
): Promise<FilaAlineacion[]> {
  const de = await duenoDelPartido(cliente, partidoId);
  return de === null ? [] : leerAlineaciones(cliente, partidoId, de, tamanoDePagina);
}

/** El Club (o la Selección) del Partido; null si no existe. */
async function duenoDelPartido(cliente: Cliente, partidoId: string): Promise<ClubOSeleccion | null> {
  const { data, error } = await cliente.from("partido").select("club_id").eq("id", partidoId).maybeSingle();
  if (error) throw error;
  return data && esClubOSeleccion(data.club_id) ? data.club_id : null;
}

async function leerAlineaciones(
  cliente: Cliente,
  partidoId: string,
  de: ClubOSeleccion,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
): Promise<FilaAlineacion[]> {
  const filas =
    de === SELECCION
      ? await leerPorId(
          () => cliente.from("alineacion").select(`id, ${COLUMNAS_ALINEACION_PARA_CONTEO}`).eq("partido_id", partidoId),
          tamanoDePagina,
        )
      : await leerPorId(
          () =>
            cliente
              .from("alineacion")
              // `perfil!inner` solo para filtrar por el Club Favorito de hoy; no se copia a la salida.
              .select(`id, ${COLUMNAS_ALINEACION_PARA_CONTEO}, perfil!inner(club_favorito_id)`)
              .eq("partido_id", partidoId)
              .eq("perfil.club_favorito_id", de),
          tamanoDePagina,
        );
  return filas.map((f) => ({
    esquema: f.esquema,
    esquema_elegido_a_mano: f.esquema_elegido_a_mano,
    esquema_modificado_en: f.esquema_modificado_en,
    puestos: f.puestos,
  }));
}

/** Todos los Jugadores del Club o de la Selección (incluidos no Disponibles y bajas: el Motor descarta sus votos). */
export async function leerJugadoresParaConteo(cliente: Cliente, club: ClubOSeleccion): Promise<FilaJugadorParaConteo[]> {
  const { data, error } = await cliente.from("jugador").select(COLUMNAS_JUGADOR_PARA_CONTEO).eq("club_id", club);
  if (error) throw error;
  return data;
}

export interface ConteoDePartido {
  readonly club: ClubOSeleccion;
  readonly resultado: ResultadoConteo;
  /** En cuántas de esas mismas Alineaciones figura cada Jugador (para el Más Pedido y el Gran Ausente). */
  readonly apariciones: Apariciones;
}

/** Cuenta la Votación del Partido con la Disponibilidad actual. `null` si el Partido no existe. */
export async function contarPartido(cliente: Cliente, partidoId: string): Promise<ConteoDePartido | null> {
  const club = await duenoDelPartido(cliente, partidoId);
  if (club === null) return null;
  const [filas, jugadores] = await Promise.all([
    leerAlineaciones(cliente, partidoId, club),
    leerJugadoresParaConteo(cliente, club),
  ]);
  return { club, resultado: contarVotacion(filas, jugadores), apariciones: aparicionesDeVotacion(filas) };
}

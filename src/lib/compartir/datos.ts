// Datos de las imágenes para compartir (ticket 16). Reciben el cliente de
// Supabase para poder testearlas con distintos usuarios:
//
// - modeloMiAlineacion: con el cliente de la SESIÓN (RLS: el Hincha solo lee
//   su propia Alineación y los Partidos y Jugadores de su Club).
// - modeloOnceElegido: con la SERVICE ROLE (la imagen es pública). Lee solo
//   `resultado_votacion` con estado `con_once`, el Partido, el Rival y los
//   Jugadores del 11: nada de Hinchas ni de Alineaciones.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { alineacionDesdeFila, COLUMNAS_ALINEACION } from "@/domain/armado";
import { onceDesdeJson } from "@/domain/cierre";
import { esUuid } from "@/domain/comun/ids";
import { NOMBRE_RIVAL_DESCONOCIDO } from "@/domain/comun/textos";
import { esClubId, type ClubId } from "@/domain/comun/tipos";
import { modeloDeImagen, type ModeloImagen } from "@/domain/compartir";
import { esEsquemaId, type EsquemaId } from "@/domain/esquemas";
import { fechaDeImagen } from "@/lib/compartir/fecha";
import type { Database } from "@/lib/supabase/database.types";

type Cliente = SupabaseClient<Database>;

/**
 * La imagen de la Alineación del Hincha `hinchaId` para el Partido, o null si
 * no tiene (o no la puede leer). `hinchaId` sale SIEMPRE de la sesión, nunca
 * del pedido; igual, RLS solo deja leer la propia.
 */
export async function modeloMiAlineacion(cliente: Cliente, hinchaId: string, partidoId: string): Promise<ModeloImagen | null> {
  if (!esUuid(partidoId) || !esUuid(hinchaId)) return null;
  const { data: fila, error } = await cliente
    .from("alineacion")
    .select(`${COLUMNAS_ALINEACION}, partido(club_id, inicio, rival(nombre))`)
    .eq("hincha_id", hinchaId)
    .eq("partido_id", partidoId)
    .maybeSingle();
  if (error) throw error;
  if (!fila?.partido || !esClubId(fila.partido.club_id)) return null;

  const alineacion = alineacionDesdeFila(fila);
  const ids = Object.values(alineacion.puestos).map((o) => o!.jugadorId);
  const jugadores = await leerJugadores(cliente, fila.partido.club_id, ids);

  return modeloDeImagen({
    tipo: "mi_alineacion",
    club: fila.partido.club_id,
    rival: fila.partido.rival?.nombre ?? NOMBRE_RIVAL_DESCONOCIDO,
    ...fechaDeImagen(new Date(fila.partido.inicio)),
    esquema: alineacion.esquema,
    asignaciones: Object.entries(alineacion.puestos).map(([puesto, o]) => ({ puesto, jugadorId: o!.jugadorId })),
    jugadores,
  });
}

/** La imagen del 11 Elegido del Partido, o null si no existe o su Votación no tuvo 11 Elegido. */
/** El modelo de la imagen del 11 Elegido, con el Club y el Esquema para dibujarlo en la cancha pixel. */
export type ModeloOnceElegido = ModeloImagen & { clubId: ClubId; esquemaId: EsquemaId };

export async function modeloOnceElegido(clienteServicio: Cliente, partidoId: string): Promise<ModeloOnceElegido | null> {
  if (!esUuid(partidoId)) return null;
  const { data: fila, error } = await clienteServicio
    .from("resultado_votacion")
    .select("esquema, once, partido(club_id, inicio, rival(nombre))")
    .eq("partido_id", partidoId)
    .eq("estado", "con_once")
    .maybeSingle();
  if (error) throw error;
  if (!fila?.partido || !fila.esquema || !esEsquemaId(fila.esquema) || !esClubId(fila.partido.club_id)) return null;

  const once = onceDesdeJson(fila.once);
  const ids = once.flatMap((a) => (a.jugadorId ? [a.jugadorId] : []));
  const jugadores = await leerJugadores(clienteServicio, fila.partido.club_id, ids);

  const modelo = modeloDeImagen({
    tipo: "once_elegido",
    club: fila.partido.club_id,
    rival: fila.partido.rival?.nombre ?? NOMBRE_RIVAL_DESCONOCIDO,
    ...fechaDeImagen(new Date(fila.partido.inicio)),
    esquema: fila.esquema,
    asignaciones: once,
    jugadores,
  });
  return { ...modelo, clubId: fila.partido.club_id, esquemaId: fila.esquema };
}

/** Solo los Jugadores pedidos, del Club del Partido (incluye bajas: la imagen los nombra igual). */
async function leerJugadores(cliente: Cliente, club: ClubId, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await cliente.from("jugador").select("id, nombre, numero").eq("club_id", club).in("id", ids);
  if (error) throw error;
  return data;
}

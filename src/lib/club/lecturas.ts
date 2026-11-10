// Lecturas fila → dominio del Plantel y los Partidos de un Club (o de la Selección), compartidas
// por la Herencia, las notificaciones y la pantalla de armado. Reciben el
// cliente: con el de la sesión, RLS decide qué se ve; con la service role, todo.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartidoCalendario } from "@/domain/calendario";
import { numeroDeClubDeLaBase, SELECCION, type ClubOSeleccion } from "@/domain/comun/tipos";
import type { JugadorDelPlantel } from "@/domain/editor";
import type { Database } from "@/lib/supabase/database.types";

type Cliente = SupabaseClient<Database>;

/** Jugador del Plantel con lo que hace falta para mostrarlo. */
export interface JugadorDelClub extends JugadorDelPlantel {
  nombre: string;
  /** null en la Selección: sus Jugadores no llevan número. */
  numero: number | null;
  motivo: string | null;
}

/** Todos los Jugadores del Club o de la Selección (incluidos no Disponibles y bajas), por número (en la Selección, por nombre). */
export async function leerPlantel(cliente: Cliente, club: ClubOSeleccion): Promise<JugadorDelClub[]> {
  const { data, error } = await cliente
    .from("jugador")
    .select("id, nombre, numero, posicion_natural, disponibilidad, motivo_disponibilidad, en_plantel")
    .eq("club_id", club)
    .order("numero")
    .order("nombre");
  if (error) throw error;
  return data.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    numero: club === SELECCION ? null : numeroDeClubDeLaBase(j.numero),
    posicionNatural: j.posicion_natural,
    disponibilidad: j.disponibilidad,
    enPlantel: j.en_plantel,
    motivo: j.motivo_disponibilidad,
  }));
}

export interface PartidoDelClub extends PartidoCalendario {
  rival: { nombre: string; escudoPath: string | null } | null;
}

/**
 * Todos los Partidos del Club (el Calendario los necesita todos), con su Rival.
 * El Rival del Clásico (con `club_id`) sin escudo propio usa el de su Club.
 */
export async function leerPartidos(cliente: Cliente, club: ClubOSeleccion): Promise<PartidoDelClub[]> {
  const { data, error } = await cliente
    .from("partido")
    .select("id, inicio, estado, creado_en, rival(nombre, escudo_path, club(escudo_path))")
    .eq("club_id", club);
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    inicio: new Date(p.inicio),
    estado: p.estado,
    creadoEn: new Date(p.creado_en),
    rival: p.rival ? { nombre: p.rival.nombre, escudoPath: p.rival.escudo_path ?? p.rival.club?.escudo_path ?? null } : null,
  }));
}

/** Ruta del escudo del Club en el bucket `escudos`, o null si el Admin todavía no lo subió. */
export async function leerEscudoDelClub(cliente: Cliente, club: ClubOSeleccion): Promise<string | null> {
  const { data, error } = await cliente.from("club").select("escudo_path").eq("id", club).maybeSingle();
  if (error) throw error;
  return data?.escudo_path ?? null;
}

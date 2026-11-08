// Lecturas fila → dominio del Plantel y los Partidos de un Club, compartidas
// por la Herencia, las notificaciones y la pantalla de armado. Reciben el
// cliente: con el de la sesión, RLS decide qué se ve; con la service role, todo.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartidoCalendario } from "@/domain/calendario";
import type { ClubId } from "@/domain/comun/tipos";
import type { JugadorDelPlantel } from "@/domain/editor";
import type { Database } from "@/lib/supabase/database.types";

type Cliente = SupabaseClient<Database>;

/** Jugador del Plantel con lo que hace falta para mostrarlo. */
export interface JugadorDelClub extends JugadorDelPlantel {
  nombre: string;
  numero: number;
  motivo: string | null;
}

/** Todos los Jugadores del Club (incluidos no Disponibles y bajas), por número. */
export async function leerPlantel(cliente: Cliente, club: ClubId): Promise<JugadorDelClub[]> {
  const { data, error } = await cliente
    .from("jugador")
    .select("id, nombre, numero, posicion_natural, disponibilidad, motivo_disponibilidad, en_plantel")
    .eq("club_id", club)
    .order("numero");
  if (error) throw error;
  return data.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    numero: j.numero,
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
export async function leerPartidos(cliente: Cliente, club: ClubId): Promise<PartidoDelClub[]> {
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
export async function leerEscudoDelClub(cliente: Cliente, club: ClubId): Promise<string | null> {
  const { data, error } = await cliente.from("club").select("escudo_path").eq("id", club).maybeSingle();
  if (error) throw error;
  return data?.escudo_path ?? null;
}

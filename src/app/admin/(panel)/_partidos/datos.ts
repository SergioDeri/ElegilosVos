// Lecturas del backoffice de Rivales y Partidos (servidor, cliente de la
// sesión del Admin: RLS con es_admin()).
import "server-only";
import type { PartidoCalendario } from "@/domain/calendario";
import { esClubId, type ClubId } from "@/domain/comun/tipos";
import type { RivalParaPartido } from "@/domain/partidos";
import type { crearClienteServidor } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

import { BUCKET_ESCUDOS } from "@/lib/imagenes/subida";

export { BUCKET_ESCUDOS };

export interface RivalVista extends RivalParaPartido {
  nombre: string;
  escudoPath: string | null;
}

export interface PartidoAdmin extends PartidoCalendario {
  clubId: ClubId;
  rivalId: string;
  rivalNombre: string;
}

export async function cargarRivales(supabase: Cliente): Promise<RivalVista[]> {
  const { data, error } = await supabase.from("rival").select("id, nombre, activo, club_id, escudo_path").order("nombre");
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    activo: r.activo,
    clubId: esClubId(r.club_id) ? r.club_id : null,
    escudoPath: r.escudo_path,
  }));
}

/** Todos los Partidos del Club (el Calendario de Votación los necesita todos). */
export async function cargarPartidosDelClub(supabase: Cliente, club: ClubId): Promise<PartidoAdmin[]> {
  const { data, error } = await supabase
    .from("partido")
    .select("id, club_id, rival_id, inicio, estado, creado_en, rival(nombre)")
    .eq("club_id", club);
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    clubId: club,
    rivalId: p.rival_id,
    rivalNombre: p.rival?.nombre ?? "?",
    inicio: new Date(p.inicio),
    estado: p.estado,
    creadoEn: new Date(p.creado_en),
  }));
}

export function urlEscudo(supabase: Cliente, path: string | null): string | null {
  return path ? supabase.storage.from(BUCKET_ESCUDOS).getPublicUrl(path).data.publicUrl : null;
}

/**
 * Ids de los Partidos del Club cuya Votación ya tiene resultado congelado
 * (ticket 12): esa Votación es definitiva aunque el Partido se postergue o
 * se cancele, y el Partido ya no se puede borrar.
 */
export async function cargarConOnceElegido(supabase: Cliente, club: ClubId): Promise<Set<string>> {
  const { data, error } = await supabase.from("resultado_votacion").select("partido_id, partido!inner(club_id)").eq("partido.club_id", club);
  if (error) throw error;
  return new Set(data.map((r) => r.partido_id));
}

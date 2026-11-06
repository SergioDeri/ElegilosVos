// Lecturas de la pantalla de armado (servidor). Todo con el cliente del
// usuario: RLS decide qué ve (solo su Club y su propia Alineación). El Plantel
// y los Partidos se leen con @/lib/club/lecturas.
import "server-only";
import type { Alineacion } from "@/domain/editor";
import { alineacionDesdeFila, COLUMNAS_ALINEACION } from "@/domain/armado";
import type { crearClienteServidor } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** La Alineación guardada del Hincha de la sesión para el Partido, o null. */
export async function cargarAlineacion(supabase: Cliente, partidoId: string): Promise<Alineacion | null> {
  const { data, error } = await supabase
    .from("alineacion")
    .select(COLUMNAS_ALINEACION)
    .eq("partido_id", partidoId)
    .maybeSingle();
  if (error) throw error;
  return data ? alineacionDesdeFila(data) : null;
}

/**
 * Ids de los Partidos (de `ids`) cuya Votación ya tiene resultado congelado
 * (11 Elegido o motivo por el que no lo tuvo). Si el Partido se postergó
 * después del cierre, su Votación es definitiva aunque el Calendario la vea
 * pendiente o abierta.
 */
export async function cargarConOnceElegido(supabase: Cliente, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase.from("resultado_votacion").select("partido_id").in("partido_id", [...ids]);
  if (error) throw error;
  return new Set(data.map((r) => r.partido_id));
}

// Lecturas de la Convocatoria (Selección, ticket 09). Sin `server-only` ni
// Next: reciben el cliente para poder probarlas en los tests de RLS. Con la
// sesión de un Hincha, RLS deja leer la Convocatoria a cualquier usuario con
// perfil; el Parcial la lee con la service role.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Convocatoria } from "@/domain/destacados";
import type { Database } from "@/lib/supabase/database.types";

type Cliente = SupabaseClient<Database>;

/**
 * Los ids de los convocados para el Partido, o `null` si el Partido todavía
 * no tiene Convocatoria (lo que espera `destacado` de @/domain/destacados).
 */
export async function leerConvocados(cliente: Cliente, partidoId: string): Promise<Convocatoria | null> {
  const { data, error } = await cliente
    .from("convocatoria_partido")
    .select("convocatoria (convocatoria_jugador (jugador_id))")
    .eq("partido_id", partidoId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.convocatoria) return null;
  return data.convocatoria.convocatoria_jugador.map((j) => j.jugador_id).sort();
}

/** Una Convocatoria del backoffice: sus Jugadores y los Partidos a los que se aplica. */
export interface ConvocatoriaCargada {
  readonly id: string;
  readonly actualizadoEn: string;
  readonly jugadores: readonly string[];
  readonly partidos: readonly string[];
}

/** Todas las Convocatorias, la más reciente primero. */
export async function leerConvocatorias(cliente: Cliente): Promise<ConvocatoriaCargada[]> {
  const { data, error } = await cliente
    .from("convocatoria")
    .select("id, creado_en, actualizado_en, convocatoria_jugador (jugador_id), convocatoria_partido (partido_id)")
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return data.map((c) => ({
    id: c.id,
    actualizadoEn: c.actualizado_en,
    jugadores: c.convocatoria_jugador.map((j) => j.jugador_id),
    partidos: c.convocatoria_partido.map((p) => p.partido_id),
  }));
}

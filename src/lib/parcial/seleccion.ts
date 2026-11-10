// Cálculo del Parcial de la Selección (Selección, ticket 08). Sin secretos ni
// Next: recibe el cliente (la SERVICE ROLE, porque cuenta las Alineaciones de
// todos) para poder probarlo en los tests de RLS. Devuelve solo agregados.
import type { SupabaseClient } from "@supabase/supabase-js";
import { SELECCION } from "@/domain/comun/tipos";
import type { ResultadoConteo } from "@/domain/conteo";
import { destacado, type Destacado } from "@/domain/destacados";
import type { Database } from "@/lib/supabase/database.types";
import { contarPartido } from "@/lib/votacion/conteo";

/** El Parcial de un Partido de la Selección: el del Conteo más el destacado. */
export interface ParcialDeLaSeleccion {
  readonly resultado: ResultadoConteo;
  /** El Más Pedido (todavía no hay Convocatoria: ticket 09), o null si nadie figura en ninguna Alineación. */
  readonly destacado: Destacado | null;
}

/**
 * Cuenta el Partido de la Selección y calcula su destacado con las apariciones
 * de las mismas Alineaciones (incluidas las heredadas, ADR-0002). `null` si el
 * Partido no existe o no es de la Selección.
 */
export async function calcularParcialDeLaSeleccion(
  servicio: SupabaseClient<Database>,
  partidoId: string,
): Promise<ParcialDeLaSeleccion | null> {
  const conteo = await contarPartido(servicio, partidoId);
  if (!conteo || conteo.club !== SELECCION) return null;
  // Sin Convocatoria cargada (todavía no se puede cargar): el Más Pedido.
  return { resultado: conteo.resultado, destacado: destacado(conteo.apariciones) };
}

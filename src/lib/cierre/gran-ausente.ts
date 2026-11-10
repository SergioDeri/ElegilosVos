// Gran Ausente final de un Partido de la Selección (Selección, ticket 10).
//
// No se guarda: se deriva de las apariciones congeladas con el resultado
// (`resultado_votacion.apariciones`) y de la Convocatoria del Partido. Si la
// Convocatoria se carga después del cierre, aparece sola; una vez publicado,
// la base deja la Convocatoria fija (trigger `convocatoria_proteger_fija`).
//
// Sin `server-only`: recibe el cliente para poder probarlo en los tests de
// RLS. Con la sesión de un Hincha, RLS deja leer los resultados de la
// Selección y la Convocatoria a cualquier usuario con perfil; la service role
// también sirve (por ejemplo, para una imagen pública o un aviso).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aparicionesDesdeJson,
  granAusenteFinal,
  type Apariciones,
  type Convocatoria,
  type Destacado,
} from "@/domain/destacados";
import { leerConvocados } from "@/lib/convocatoria/lecturas";
import type { Database } from "@/lib/supabase/database.types";

type Cliente = SupabaseClient<Database>;

export interface DestacadoAlCierre {
  /** Apariciones congeladas al cierre (base del Gran Ausente final y, sin Convocatoria, del Más Pedido). */
  readonly apariciones: Apariciones;
  /** Los convocados del Partido, o null si todavía no hay Convocatoria. */
  readonly convocados: Convocatoria | null;
  /** El Gran Ausente final, o null (sin Convocatoria todavía, o ningún no convocado figura). */
  readonly granAusente: Destacado | null;
}

/**
 * El Gran Ausente final del Partido y lo que hace falta para mostrarlo.
 * `null` si el Partido no tiene resultado congelado con apariciones (no es de
 * la Selección, todavía no cerró, o cerró sin contarse: anulada o no abrió).
 */
export async function leerGranAusenteFinal(cliente: Cliente, partidoId: string): Promise<DestacadoAlCierre | null> {
  const [{ data, error }, convocados] = await Promise.all([
    cliente.from("resultado_votacion").select("apariciones").eq("partido_id", partidoId).maybeSingle(),
    leerConvocados(cliente, partidoId),
  ]);
  if (error) throw error;
  const apariciones = aparicionesDesdeJson(data?.apariciones ?? null);
  if (!apariciones) return null;
  return { apariciones, convocados, granAusente: granAusenteFinal(apariciones, convocados) };
}

// Quién puede ver el Parcial de un Partido (ticket 11). Sin secretos ni Next:
// recibe el cliente de la SESIÓN del Hincha (RLS) y la función que calcula el
// Parcial, para poder probarlo en los tests de RLS.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClubId } from "@/domain/comun/tipos";
import type { ResultadoConteo } from "@/domain/conteo";
import type { Database } from "@/lib/supabase/database.types";
import { esUuid } from "@/domain/comun/ids";

export type ParcialParaHincha =
  | { readonly tipo: "ok"; readonly resultado: ResultadoConteo }
  /** El Partido no existe o no es del Club Favorito del Hincha. */
  | { readonly tipo: "prohibido" }
  /** La Votación del Partido no está abierta (el Parcial solo existe mientras lo está). */
  | { readonly tipo: "no_abierta" };

/**
 * Verifica con el cliente del Hincha (RLS: solo ve los Partidos de su Club)
 * que el Partido sea de su Club y que su Votación esté abierta; recién ahí
 * pide el cálculo (que corre con la service role y devuelve solo agregados).
 */
export async function parcialParaHincha(
  clienteDelHincha: SupabaseClient<Database>,
  club: ClubId,
  partidoId: string,
  calcular: (partidoId: string) => Promise<ResultadoConteo | null>,
): Promise<ParcialParaHincha> {
  if (!esUuid(partidoId)) return { tipo: "prohibido" };
  // Las dos lecturas van juntas (un solo viaje a Supabase de espera). El
  // estado de la Votación recién se mira si el Partido es del Club.
  const [{ data: partido, error }, { data: votacion, error: errorVotacion }] = await Promise.all([
    clienteDelHincha.from("partido").select("club_id").eq("id", partidoId).maybeSingle(),
    clienteDelHincha.rpc("votacion_de_partido", { partido: partidoId }).maybeSingle(),
  ]);
  if (error) throw error;
  if (!partido || partido.club_id !== club) return { tipo: "prohibido" };
  if (errorVotacion) throw errorVotacion;
  if (votacion?.estado !== "abierta") return { tipo: "no_abierta" };

  const resultado = await calcular(partidoId);
  if (!resultado) return { tipo: "prohibido" };
  return { tipo: "ok", resultado };
}

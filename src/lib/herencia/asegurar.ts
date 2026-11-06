// Herencia al entrar a la pantalla de armado (ticket 10): si el Hincha no
// tiene Alineación para la Votación abierta y tenía una en el Partido
// anterior, se materializa en ese momento (misma función que el cron, así que
// es idempotente). No depender solo del cron.
import "server-only";
import type { ClubId } from "@/domain/comun/tipos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { materializarHerencias } from "./materializar";

/**
 * Nunca rompe la pantalla: si falla (por ejemplo, falta la service role en el
 * entorno), lo registra y el Hincha arranca con la cancha vacía; el cron lo
 * vuelve a intentar.
 */
export async function asegurarHerencia(hinchaId: string, club: ClubId, ahora: Date): Promise<void> {
  try {
    await materializarHerencias(crearClienteAdmin(), ahora, { club, hinchaId });
  } catch (error) {
    console.error("No se pudo materializar la Alineación heredada", error);
  }
}

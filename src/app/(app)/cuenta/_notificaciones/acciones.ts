"use server";

// Server Actions de las notificaciones push (ticket 15) y de las preferencias
// "mi club" / "Selección" (Selección, ticket 13). Actúan siempre sobre el
// Hincha de la sesión (cliente con RLS): nunca reciben un id de Hincha. Un
// Hincha sin Club también puede usarlas (recibe los avisos de la Selección).
import { LARGO_MAXIMO_ENDPOINT, validarSuscripcion, type Interruptor } from "@/domain/notificaciones";
import { requerirSesion } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

const LARGO_MAXIMO_USER_AGENT = 512;

/** Guarda la suscripción de este navegador (`PushSubscription.toJSON()`) a nombre del Hincha de la sesión. */
export async function activarNotificaciones(suscripcion: unknown, userAgent: unknown): Promise<ResultadoAccion> {
  await requerirSesion();
  const validacion = validarSuscripcion(suscripcion);
  if (!validacion.ok) return { ok: false, error: "El navegador devolvió una suscripción inválida." };
  const { endpoint, p256dh, auth } = validacion.suscripcion;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("registrar_suscripcion_push", {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: typeof userAgent === "string" ? userAgent.slice(0, LARGO_MAXIMO_USER_AGENT) : undefined,
  });
  if (error) {
    console.error("No se pudo guardar la suscripción push", error.code);
    return { ok: false, error: "No se pudieron activar las notificaciones. Probá de nuevo." };
  }
  return { ok: true };
}

/** Borra la suscripción de este navegador (solo si es del Hincha de la sesión: RLS). */
export async function desactivarNotificaciones(endpoint: unknown): Promise<ResultadoAccion> {
  await requerirSesion();
  if (typeof endpoint !== "string" || endpoint.length > LARGO_MAXIMO_ENDPOINT) {
    return { ok: false, error: "Suscripción inválida." };
  }
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("suscripcion_push").delete().eq("endpoint", endpoint);
  if (error) return { ok: false, error: "No se pudieron desactivar las notificaciones. Probá de nuevo." };
  return { ok: true };
}

/** Si la suscripción de este navegador está guardada a nombre del Hincha de la sesión. */
export async function suscripcionGuardada(endpoint: unknown): Promise<boolean> {
  await requerirSesion();
  if (typeof endpoint !== "string" || endpoint.length > LARGO_MAXIMO_ENDPOINT) return false;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("suscripcion_push").select("id").eq("endpoint", endpoint).maybeSingle();
  return data !== null;
}

const COLUMNA: Record<Interruptor, "mi_club" | "seleccion"> = { miClub: "mi_club", seleccion: "seleccion" };

/** Prende o apaga uno de los dos interruptores ("mi club" o "Selección") del Hincha de la sesión. */
export async function cambiarPreferencia(interruptor: unknown, prendido: unknown): Promise<ResultadoAccion> {
  await requerirSesion();
  if ((interruptor !== "miClub" && interruptor !== "seleccion") || typeof prendido !== "boolean") {
    return { ok: false, error: "Preferencia inválida." };
  }
  const supabase = await crearClienteServidor();
  // Sin fila, la crea (el otro interruptor queda prendido, como por defecto).
  const { error } = await supabase
    .from("preferencia_notificacion")
    .upsert({ [COLUMNA[interruptor]]: prendido }, { onConflict: "hincha_id" });
  if (error) {
    console.error("No se pudo guardar la preferencia de notificación", error.code);
    return { ok: false, error: "No se pudo guardar el cambio. Probá de nuevo." };
  }
  return { ok: true };
}

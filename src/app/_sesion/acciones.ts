"use server";

// Ticket 17: al cerrar sesión, este navegador deja de recibir los avisos de la
// cuenta. La acción borra la suscripción push por endpoint con el cliente de
// la sesión (RLS: solo si es del usuario de la sesión). No redirige ni exige
// Club Favorito: se llama justo antes de cerrar la sesión, desde cualquier
// pantalla (app, elegir club, backoffice).
import { LARGO_MAXIMO_ENDPOINT } from "@/domain/notificaciones";
import { obtenerHincha } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function olvidarSuscripcionDeEsteNavegador(endpoint: unknown): Promise<void> {
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > LARGO_MAXIMO_ENDPOINT) return;
  if (!(await obtenerHincha())) return;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("suscripcion_push").delete().eq("endpoint", endpoint);
  if (error) console.error("No se pudo borrar la suscripción push al cerrar sesión", error.code);
}

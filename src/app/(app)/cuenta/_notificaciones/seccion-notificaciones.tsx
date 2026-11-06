// Sección "Notificaciones" de /cuenta (ticket 15).
import { crearClienteServidor } from "@/lib/supabase/server";
import { ControlNotificaciones } from "./control-notificaciones";

export async function SeccionNotificaciones({ className }: { className?: string }) {
  // RLS: solo cuenta las suscripciones del Hincha de la sesión.
  const supabase = await crearClienteServidor();
  const { count } = await supabase.from("suscripcion_push").select("id", { count: "exact", head: true });

  return (
    <section aria-labelledby="seccion-notificaciones" className={className}>
      <h2 id="seccion-notificaciones">Notificaciones</h2>
      <p>
        Te avisamos cuando abre la Votación de tu Club, cuando faltan 3 horas para el cierre, cuando sale el 11 Elegido
        y si un Jugador de tu Alineación deja de estar Disponible.
      </p>
      <ControlNotificaciones clavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      {!!count && (
        <p>
          Tenés las notificaciones activadas en {count} {count === 1 ? "dispositivo" : "dispositivos"}.
        </p>
      )}
    </section>
  );
}

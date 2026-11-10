// Sección "Notificaciones" de /cuenta (ticket 15; interruptores "mi club" y
// "Selección": Selección, ticket 13). Un Hincha sin Club (`club = null`) solo
// ve el interruptor de la Selección.
import type { ClubId } from "@/domain/comun/tipos";
import { interruptoresVisibles, preferenciasDesdeFila } from "@/domain/notificaciones";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ControlNotificaciones } from "./control-notificaciones";
import { Interruptores } from "./interruptores";

export async function SeccionNotificaciones({ className, club }: { className?: string; club: ClubId | null }) {
  // RLS: solo cuenta las suscripciones y lee las preferencias del Hincha de la sesión.
  const supabase = await crearClienteServidor();
  const [{ count }, { data: preferencias }] = await Promise.all([
    supabase.from("suscripcion_push").select("id", { count: "exact", head: true }),
    supabase.from("preferencia_notificacion").select("mi_club, seleccion").maybeSingle(),
  ]);

  return (
    <section aria-labelledby="seccion-notificaciones" className={className}>
      <h2 id="seccion-notificaciones">Notificaciones</h2>
      {club ? (
        <p>
          Te avisamos cuando abre la Votación de tu Club o de la Selección y cuando faltan 3 horas para el cierre. De tu
          Club, también cuando sale el 11 Elegido y si un Jugador de tu Alineación deja de estar Disponible.
        </p>
      ) : (
        <p>Te avisamos cuando abre una Votación de la Selección y cuando faltan 3 horas para el cierre.</p>
      )}
      <ControlNotificaciones clavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      {!!count && (
        <p>
          Tenés las notificaciones activadas en {count} {count === 1 ? "dispositivo" : "dispositivos"}.
        </p>
      )}
      <Interruptores visibles={interruptoresVisibles(club)} iniciales={preferenciasDesdeFila(preferencias)} />
    </section>
  );
}

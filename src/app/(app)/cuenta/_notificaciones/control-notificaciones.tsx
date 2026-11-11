"use client";

// Activar / desactivar las notificaciones push en ESTE navegador (ticket 15).
// La clave pública VAPID es pública por diseño; la privada vive solo en el
// servidor (src/lib/notificaciones/web-push.ts).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { registrarServiceWorker } from "@/app/_pwa/service-worker";
import { desactivarNotificaciones } from "./acciones";
import { activarPush, estadoPush, type EstadoPush } from "./push";

type Estado = "cargando" | EstadoPush;

export function ControlNotificaciones({ clavePublica }: { clavePublica: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    estadoPush(clavePublica)
      .catch(() => "no_soportado" as const)
      .then((e) => vigente && setEstado(e));
    return () => {
      vigente = false;
    };
  }, [clavePublica]);

  async function activar() {
    setOcupado(true);
    setError(null);
    const resultado = await activarPush(clavePublica);
    if ("error" in resultado) setError(resultado.error);
    else {
      setEstado(resultado.estado);
      if (resultado.estado === "activadas") router.refresh();
    }
    setOcupado(false);
  }

  async function desactivar() {
    setOcupado(true);
    setError(null);
    try {
      const registro = await registrarServiceWorker();
      const suscripcion = await registro.pushManager.getSubscription();
      if (suscripcion) {
        const resultado = await desactivarNotificaciones(suscripcion.endpoint);
        if (!resultado.ok) {
          setError(resultado.error);
          return;
        }
        await suscripcion.unsubscribe();
      }
      setEstado("desactivadas");
      router.refresh();
    } catch {
      setError("No se pudieron desactivar las notificaciones en este navegador.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      {estado === "cargando" && <p>Revisando las notificaciones de este navegador…</p>}
      {estado === "sin_configurar" && <p>Las notificaciones todavía no están disponibles.</p>}
      {estado === "no_soportado" && <p>Este navegador no permite notificaciones push.</p>}
      {estado === "ios_sin_instalar" && (
        <div>
          <p>En iPhone y iPad, las notificaciones solo funcionan con Elegilos Vos agregada a la pantalla de inicio:</p>
          <ol>
            <li>Abrí esta página en Safari.</li>
            <li>
              Tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).
            </li>
            <li>
              Elegí <strong>Agregar a pantalla de inicio</strong> y confirmá.
            </li>
            <li>Abrí Elegilos Vos desde el ícono nuevo, entrá a Mi cuenta y activá las notificaciones.</li>
          </ol>
          <p>Necesitás iOS 16.4 o posterior.</p>
        </div>
      )}
      {estado === "bloqueadas" && (
        <p>
          Bloqueaste las notificaciones para este sitio. Para activarlas, habilitalas en la configuración del navegador y
          volvé a esta página.
        </p>
      )}
      {estado === "activadas" && (
        <p role="status">
          Notificaciones <strong>activadas</strong> en este navegador.{" "}
          <button type="button" onClick={desactivar} disabled={ocupado}>
            Desactivar
          </button>
        </p>
      )}
      {estado === "desactivadas" && (
        <p role="status">
          Notificaciones <strong>desactivadas</strong> en este navegador.{" "}
          <button type="button" onClick={activar} disabled={ocupado}>
            Activar
          </button>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

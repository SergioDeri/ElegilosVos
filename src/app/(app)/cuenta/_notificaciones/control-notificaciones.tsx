"use client";

// Activar / desactivar las notificaciones push en ESTE navegador (ticket 15).
// La clave pública VAPID es pública por diseño; la privada vive solo en el
// servidor (src/lib/notificaciones/web-push.ts).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { registrarServiceWorker, soportaServiceWorker } from "@/app/_pwa/service-worker";
import { activarNotificaciones, desactivarNotificaciones, suscripcionGuardada } from "./acciones";

type Estado =
  | "cargando"
  | "sin_configurar" // falta NEXT_PUBLIC_VAPID_PUBLIC_KEY
  | "ios_sin_instalar" // iOS: push solo con la web agregada a la pantalla de inicio
  | "no_soportado"
  | "bloqueadas" // el Hincha negó el permiso en el navegador
  | "activadas"
  | "desactivadas";

function esIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS se presenta como Mac: se distingue por la pantalla táctil.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function enModoApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function soportaPush(): boolean {
  return soportaServiceWorker() && "PushManager" in window && "Notification" in window;
}

/** Clave VAPID pública (base64url) → bytes, como la pide `pushManager.subscribe`. */
function claveABytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binario = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function estadoInicial(clavePublica: string): Promise<Estado> {
  if (!clavePublica) return "sin_configurar";
  if (esIos() && !enModoApp()) return "ios_sin_instalar";
  if (!soportaPush()) return "no_soportado";
  if (Notification.permission === "denied") return "bloqueadas";
  const registro = await registrarServiceWorker();
  const suscripcion = await registro.pushManager.getSubscription();
  if (!suscripcion || Notification.permission !== "granted") return "desactivadas";
  // Activadas solo si el servidor la tiene a nombre de esta cuenta (pudo
  // vencer, o el navegador pudo activarlas con otra cuenta).
  return (await suscripcionGuardada(suscripcion.endpoint)) ? "activadas" : "desactivadas";
}

export function ControlNotificaciones({ clavePublica }: { clavePublica: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    estadoInicial(clavePublica)
      .catch(() => "no_soportado" as const)
      .then((e) => vigente && setEstado(e));
    return () => {
      vigente = false;
    };
  }, [clavePublica]);

  async function activar() {
    setOcupado(true);
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueadas" : "desactivadas");
        return;
      }
      const registro = await registrarServiceWorker();
      const suscripcion =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(clavePublica) }));
      const resultado = await activarNotificaciones(suscripcion.toJSON(), navigator.userAgent);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setEstado("activadas");
      router.refresh();
    } catch {
      setError("No se pudieron activar las notificaciones en este navegador.");
    } finally {
      setOcupado(false);
    }
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

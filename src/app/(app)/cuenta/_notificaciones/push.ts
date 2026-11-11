"use client";

// Push en ESTE navegador (ticket 15): en qué estado está y cómo activarlo.
// Lo usan el control de /cuenta y el aviso que aparece al abrir la app.
import { registrarServiceWorker, soportaServiceWorker } from "@/app/_pwa/service-worker";
import { activarNotificaciones, suscripcionGuardada } from "./acciones";

export type EstadoPush =
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

export async function estadoPush(clavePublica: string): Promise<EstadoPush> {
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

export type ResultadoActivar = { estado: EstadoPush } | { error: string };

/** Pide el permiso, suscribe este navegador y guarda la suscripción a nombre del Hincha. */
export async function activarPush(clavePublica: string): Promise<ResultadoActivar> {
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return { estado: permiso === "denied" ? "bloqueadas" : "desactivadas" };
    const registro = await registrarServiceWorker();
    const suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveABytes(clavePublica),
      }));
    const resultado = await activarNotificaciones(suscripcion.toJSON(), navigator.userAgent);
    return resultado.ok ? { estado: "activadas" } : { error: resultado.error };
  } catch {
    return {
      error: "No se pudieron activar las notificaciones en este navegador.",
    };
  }
}

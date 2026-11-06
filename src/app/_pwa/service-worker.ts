// Registro del service worker (public/sw.js). Solo navegador.

export const RUTA_SERVICE_WORKER = "/sw.js";

export function soportaServiceWorker(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/** Registra (o reutiliza) el service worker con alcance en toda la app. */
export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(RUTA_SERVICE_WORKER, { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

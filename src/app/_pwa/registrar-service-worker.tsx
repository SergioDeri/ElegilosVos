"use client";

// Registra el service worker en cualquier página (ticket 15), para que la web
// sea instalable y reciba pushes aunque el Hincha no pase por /cuenta.
import { useEffect } from "react";
import { registrarServiceWorker, soportaServiceWorker } from "./service-worker";

export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!soportaServiceWorker()) return;
    registrarServiceWorker().catch((error: unknown) => console.error("No se pudo registrar el service worker", error));
  }, []);
  return null;
}

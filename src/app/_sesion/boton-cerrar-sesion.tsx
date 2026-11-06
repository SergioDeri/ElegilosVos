"use client";

// Botón "Cerrar sesión" (ticket 17). Antes de cerrar la sesión desuscribe las
// notificaciones push de ESTE navegador (borra la fila por endpoint y llama a
// `unsubscribe()`), para que el dispositivo deje de recibir los avisos de la
// cuenta. Si eso falla o tarda, la sesión se cierra igual. Sin JavaScript el
// formulario hace el POST a /auth/salir directamente.
import { useState, type FormEvent } from "react";
import { soportaServiceWorker } from "@/app/_pwa/service-worker";
import { olvidarSuscripcionDeEsteNavegador } from "./acciones";

const ESPERA_MAXIMA_MS = 3000;

async function desuscribirEsteNavegador(): Promise<void> {
  if (!soportaServiceWorker() || !("PushManager" in window)) return;
  // No registra un service worker nuevo: si no hay, no hay suscripción.
  const registro = await navigator.serviceWorker.getRegistration("/");
  const suscripcion = await registro?.pushManager.getSubscription();
  if (!suscripcion) return;
  await olvidarSuscripcionDeEsteNavegador(suscripcion.endpoint).catch(() => undefined);
  await suscripcion.unsubscribe();
}

export function BotonCerrarSesion() {
  const [cerrando, setCerrando] = useState(false);

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (cerrando) return;
    setCerrando(true);
    const formulario = evento.currentTarget;
    const limite = new Promise<void>((resolver) => setTimeout(resolver, ESPERA_MAXIMA_MS));
    void Promise.race([desuscribirEsteNavegador().catch(() => undefined), limite]).then(() => formulario.submit());
  }

  return (
    <form action="/auth/salir" method="post" onSubmit={alEnviar}>
      <button type="submit" disabled={cerrando}>
        {cerrando ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
    </form>
  );
}

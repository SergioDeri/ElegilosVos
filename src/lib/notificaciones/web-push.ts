// Envío real de Web Push con VAPID (ticket 15). SOLO SERVIDOR: usa
// `VAPID_PRIVATE_KEY`, que nunca puede llegar al navegador (`server-only` hace
// fallar el build si un componente cliente importa este archivo).
import "server-only";
import webpush from "web-push";
import type { EnviarPush, ResultadoEnvio } from "./proceso";

/** Cuánto guarda el servicio push un aviso si el dispositivo está apagado (12 horas). */
const TTL_SEGUNDOS = 12 * 60 * 60;

/**
 * La función de envío con las claves VAPID de las variables de entorno, o
 * null si falta alguna (el llamador saltea el envío y lo registra en el log).
 */
export function crearEnvioWebPush(env: Readonly<Record<string, string | undefined>> = process.env): EnviarPush | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  const vapidDetails = { subject, publicKey, privateKey };

  return async (suscripcion, mensaje): Promise<ResultadoEnvio> => {
    try {
      await webpush.sendNotification(
        { endpoint: suscripcion.endpoint, keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth } },
        JSON.stringify(mensaje),
        { vapidDetails, TTL: TTL_SEGUNDOS },
      );
      return "ok";
    } catch (error) {
      const estado = (error as { statusCode?: unknown }).statusCode;
      if (estado === 404 || estado === 410) return "vencida";
      // Sin el endpoint ni el cuerpo en el log: son datos sensibles.
      console.error("Push: falló un envío", { estado, mensaje: (error as Error).message });
      return "error";
    }
  };
}

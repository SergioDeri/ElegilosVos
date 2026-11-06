// Validación de la suscripción push que manda el navegador (lo que devuelve
// `PushSubscription.toJSON()`): no se confía en nada que venga del cliente.

/** Lo que se guarda de una suscripción (tabla `suscripcion_push`). */
export interface SuscripcionPush {
  /** URL del servicio push del navegador (https). Sensible: identifica al dispositivo; nunca se expone a otros. */
  endpoint: string;
  /** Clave pública ECDH P-256 del navegador, base64url sin padding (65 bytes). */
  p256dh: string;
  /** Secreto de autenticación, base64url sin padding (16 bytes). */
  auth: string;
}

export const LARGO_MAXIMO_ENDPOINT = 2048;
const BYTES_P256DH = 65;
const BYTES_AUTH = 16;

export type ValidacionSuscripcion = { ok: true; suscripcion: SuscripcionPush } | { ok: false };

export function validarSuscripcion(valor: unknown): ValidacionSuscripcion {
  if (typeof valor !== "object" || valor === null) return { ok: false };
  const { endpoint, keys } = valor as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || !endpointValido(endpoint)) return { ok: false };
  if (typeof keys !== "object" || keys === null) return { ok: false };
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  const p = base64UrlDeBytes(p256dh, BYTES_P256DH);
  const a = base64UrlDeBytes(auth, BYTES_AUTH);
  if (p === null || a === null) return { ok: false };
  return { ok: true, suscripcion: { endpoint, p256dh: p, auth: a } };
}

function endpointValido(endpoint: string): boolean {
  if (endpoint.length > LARGO_MAXIMO_ENDPOINT) return false;
  try {
    return new URL(endpoint).protocol === "https:";
  } catch {
    return false;
  }
}

/** El texto sin padding si es base64url (se tolera el padding `=`) de exactamente `bytes` bytes; si no, null. */
function base64UrlDeBytes(valor: unknown, bytes: number): string | null {
  if (typeof valor !== "string") return null;
  const sinPadding = valor.replace(/={0,2}$/, "");
  if (!/^[A-Za-z0-9_-]*$/.test(sinPadding)) return null;
  return sinPadding.length === Math.ceil((bytes * 4) / 3) ? sinPadding : null;
}

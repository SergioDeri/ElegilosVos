// Reglas de acceso por ruta, sin dependencias de Next ni Supabase (se testean
// solas). Las usa src/proxy.ts para la redirección optimista; la verificación
// real (sesión válida + Club Favorito) la hace el layout de src/app/(app).

export type Decision = { tipo: "seguir" } | { tipo: "redirigir"; destino: string };

export const RUTA_LOGIN = "/login";
export const RUTA_ELEGIR_CLUB = "/elegir-club";
export const RUTA_INICIO = "/";

/** Solo para quien no inició sesión: con sesión mandan al inicio. */
const RUTAS_DE_INVITADO = ["/login", "/registro", "/verificar"];

/**
 * Accesibles con o sin sesión (incluye sus subrutas). `/api` queda libre
 * porque cada Route Handler se autentica solo (p. ej. el cron con CRON_SECRET).
 * `/compartir` tiene los links públicos del 11 Elegido (ticket 16).
 */
const RUTAS_LIBRES = ["/recuperar", "/auth", "/api", "/compartir"];

function coincide(ruta: string, base: string): boolean {
  return ruta === base || ruta.startsWith(`${base}/`);
}

export function decidirAcceso(ruta: string, conSesion: boolean): Decision {
  if (RUTAS_LIBRES.some((base) => coincide(ruta, base))) {
    return { tipo: "seguir" };
  }

  if (RUTAS_DE_INVITADO.some((base) => coincide(ruta, base))) {
    return conSesion ? { tipo: "redirigir", destino: RUTA_INICIO } : { tipo: "seguir" };
  }

  if (!conSesion) {
    const destino = ruta === RUTA_INICIO ? RUTA_LOGIN : `${RUTA_LOGIN}?next=${encodeURIComponent(ruta)}`;
    return { tipo: "redirigir", destino };
  }
  return { tipo: "seguir" };
}

const LARGO_MAXIMO_DESTINO = 1024;

/**
 * Devuelve `destino` si es una ruta interna de la app; si no, el inicio.
 * Evita open redirects con el parámetro `next`: además de `//` y `/\`,
 * descarta espacios, caracteres de control y barras invertidas en cualquier
 * lugar (el parser de URL borra tabs y saltos de línea, así que "/\t/malo.com"
 * se convierte en "//malo.com") y confirma que, resuelto contra un origen,
 * siga en ese origen.
 */
export function rutaSegura(destino: string | null | undefined): string {
  if (
    !destino ||
    destino.length > LARGO_MAXIMO_DESTINO ||
    !destino.startsWith("/") ||
    destino.startsWith("//") ||
    /[\u0000- \u007f\\]/.test(destino)
  ) {
    return RUTA_INICIO;
  }
  const base = "http://elegilosvos.invalid";
  try {
    if (new URL(destino, base).origin !== base) return RUTA_INICIO;
  } catch {
    return RUTA_INICIO;
  }
  return destino;
}

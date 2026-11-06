// Cabeceras de seguridad de todas las respuestas (ticket 17). Las aplica
// next.config.ts; esto es lógica pura para poder testearla.
//
// CSP sin nonces (la variante "Without Nonces" de la guía de Next): Next
// inyecta scripts inline para hidratar, así que `script-src` necesita
// 'unsafe-inline'; a cambio todas las páginas pueden seguir siendo estáticas o
// dinámicas sin pasar por el proxy. Lo que sí bloquea: scripts de otros
// orígenes, `eval` en producción, conexiones e imágenes fuera de la app y de
// Supabase, plugins, <base> ajeno, formularios hacia otros sitios y que otro
// sitio muestre la app en un iframe (clickjacking).

export type Cabecera = { key: string; value: string };

export type OpcionesCabeceras = {
  /** NEXT_PUBLIC_SUPABASE_URL: Auth/REST desde el navegador e imágenes de Storage. */
  supabaseUrl: string | undefined;
  /** `next dev`: React usa eval para reconstruir errores del servidor. */
  desarrollo: boolean;
  /** Deploy de producción: agrega HSTS. */
  produccion: boolean;
};

/** Origen (`https://host[:puerto]`) de la URL de Supabase, o null si no es una URL http(s) válida. */
function origenDe(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

export function cabecerasDeSeguridad({ supabaseUrl, desarrollo, produccion }: OpcionesCabeceras): Cabecera[] {
  const supabase = origenDe(supabaseUrl);
  const externos = supabase ? [supabase] : [];
  const todoHttps = supabase === null || supabase.startsWith("https:");

  const directivas: [string, ...string[]][] = [
    ["default-src", "'self'"],
    ["script-src", "'self'", "'unsafe-inline'", ...(desarrollo ? ["'unsafe-eval'"] : [])],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:", ...externos],
    ["font-src", "'self'"],
    ["connect-src", "'self'", ...externos],
    ["worker-src", "'self'"],
    ["manifest-src", "'self'"],
    ["frame-src", "'none'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    ...(todoHttps && !desarrollo ? [["upgrade-insecure-requests"] as [string]] : []),
  ];
  const csp = directivas.map((d) => d.join(" ")).join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(produccion ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  ];
}

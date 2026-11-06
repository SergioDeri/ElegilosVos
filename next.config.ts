import type { NextConfig } from "next";
import { cabecerasDeSeguridad } from "./src/lib/seguridad/cabeceras";

// cacheComponents queda desactivado a propósito: casi todas las páginas
// dependen de la sesión (cookies) y preferimos el modelo dinámico por defecto.
const nextConfig: NextConfig = {
  // No anunciar el framework en cada respuesta.
  poweredByHeader: false,
  async headers() {
    return [
      // Ticket 17: cabeceras de seguridad en todas las respuestas (CSP,
      // anti-iframe, nosniff, Referrer-Policy, Permissions-Policy y HSTS en
      // producción). Se calculan al hacer el build: NEXT_PUBLIC_SUPABASE_URL
      // tiene que estar definida en ese momento (en Vercel lo está).
      {
        source: "/:path*",
        headers: cabecerasDeSeguridad({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          desarrollo: process.env.NODE_ENV === "development",
          produccion: process.env.NODE_ENV === "production",
        }),
      },
      // Ticket 15: el service worker no se cachea (las actualizaciones llegan al
      // toque) y solo ejecuta código propio. Va después: su CSP reemplaza a la
      // general para /sw.js.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Ticket 07: fotos de Jugadores de hasta 2 MB (src/domain/planteles)
      // más el resto del formulario multipart.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;

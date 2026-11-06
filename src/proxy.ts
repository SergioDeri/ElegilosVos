// Proxy de Next 16 (antes "middleware"). Corre antes de cada página:
//   1. Refresca la sesión de Supabase (cookies).
//   2. Redirección optimista según haya sesión o no (src/lib/auth/rutas.ts).
// NO es la barrera de seguridad: la autorización real está en RLS y en el
// layout de src/app/(app) (sesión + Club Favorito). Ver ticket 04.
import { NextResponse, type NextRequest } from "next/server";
import { decidirAcceso } from "@/lib/auth/rutas";
import { actualizarSesion } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const sesion = await actualizarSesion(request);
  const decision = decidirAcceso(request.nextUrl.pathname, sesion.conSesion);

  if (decision.tipo === "redirigir") {
    return sesion.aplicarA(NextResponse.redirect(new URL(decision.destino, request.url)));
  }
  return sesion.respuesta;
}

export const config = {
  matcher: [
    // Todo menos estáticos, imágenes optimizadas y archivos con extensión
    // (favicon, imágenes de /public, manifest, service worker...).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|js|webmanifest)$).*)",
  ],
};

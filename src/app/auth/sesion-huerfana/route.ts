// Sesión huérfana: el JWT tiene firma válida pero su usuario ya no existe
// (p. ej. se borró). Se borran las cookies de sesión de este navegador (sin
// llamar a Auth, que ya no conoce al usuario) y se va al login. Lo usa
// requerirSesion() de @/lib/auth/sesion.
import { NextResponse, type NextRequest } from "next/server";
import { RUTA_LOGIN } from "@/lib/auth/rutas";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL(RUTA_LOGIN, request.nextUrl.origin), { status: 303 });
}

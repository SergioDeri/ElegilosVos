// Vuelta del login con Google (OAuth con PKCE): canjea el código por la
// sesión (cookies) y manda a donde iba el Hincha.
import { NextResponse, type NextRequest } from "next/server";
import { rutaSegura } from "@/lib/auth/rutas";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const codigo = searchParams.get("code");
  const destino = rutaSegura(searchParams.get("next"));

  if (codigo) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(destino, origin));
  }

  return NextResponse.redirect(new URL("/login?error=google", origin));
}

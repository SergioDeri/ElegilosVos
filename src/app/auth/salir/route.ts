// Cerrar sesión (POST desde un formulario).
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
}

// Imagen pública del 11 Elegido de un Partido (ticket 16). Se lee con la
// service role, pero solo el resultado congelado con estado `con_once` y los
// Jugadores del 11 (sin datos de Hinchas). 404 si no hay 11 Elegido.
import type { NextRequest } from "next/server";
import { modeloOnceElegido } from "@/lib/compartir/datos";
import { imagenDe } from "@/lib/compartir/imagen";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export async function GET(_pedido: NextRequest, ctx: RouteContext<"/api/imagen/once-elegido/[partidoId]">) {
  const { partidoId } = await ctx.params;
  const modelo = await modeloOnceElegido(crearClienteAdmin(), partidoId);
  if (!modelo) return new Response("No encontrado", { status: 404 });
  return imagenDe(modelo, {
    // El resultado es inmutable; solo los datos del Jugador podrían corregirse.
    "Cache-Control": "public, max-age=300, s-maxage=3600",
    "Content-Disposition": `inline; filename="${modelo.nombreArchivo}"`,
  });
}

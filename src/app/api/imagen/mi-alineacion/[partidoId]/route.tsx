// Imagen de la Alineación del Hincha de la SESIÓN para un Partido (ticket 16).
// Nunca acepta un Hincha del pedido: el id sale de la sesión y la lectura va
// con el cliente del usuario (RLS: solo su propia Alineación). No es pública
// ni se cachea.
import type { NextRequest } from "next/server";
import { obtenerHincha } from "@/lib/auth/sesion";
import { modeloMiAlineacion } from "@/lib/compartir/datos";
import { imagenDe } from "@/lib/compartir/imagen";
import { crearClienteServidor } from "@/lib/supabase/server";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

export async function GET(_pedido: NextRequest, ctx: RouteContext<"/api/imagen/mi-alineacion/[partidoId]">) {
  const { partidoId } = await ctx.params;
  const hincha = await obtenerHincha();
  if (!hincha) return new Response("Iniciá sesión", { status: 401, headers: SIN_CACHE });

  const modelo = await modeloMiAlineacion(await crearClienteServidor(), hincha.id, partidoId);
  if (!modelo) return new Response("No encontrado", { status: 404, headers: SIN_CACHE });
  return imagenDe(modelo, {
    ...SIN_CACHE,
    "Content-Disposition": `inline; filename="${modelo.nombreArchivo}"`,
  });
}

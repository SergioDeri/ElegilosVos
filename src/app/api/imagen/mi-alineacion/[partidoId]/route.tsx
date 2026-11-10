// Imagen de la Alineación del Hincha de la SESIÓN para un Partido (ticket 16).
// Nunca acepta un Hincha del pedido: el id sale de la sesión y la lectura va
// con el cliente del usuario (RLS: solo su propia Alineación). No es pública
// ni se cachea. También la de la Selección (Selección, ticket 12), para
// cualquier Hincha con perfil, con o sin Club, con el escudo de la Selección.
import type { NextRequest } from "next/server";
import { SELECCION } from "@/domain/comun/tipos";
import { obtenerHincha } from "@/lib/auth/sesion";
import { modeloMiAlineacion } from "@/lib/compartir/datos";
import { escudoDeLaSeleccion } from "@/lib/compartir/escudo";
import { imagenDe } from "@/lib/compartir/imagen";
import { crearClienteServidor } from "@/lib/supabase/server";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

export async function GET(_pedido: NextRequest, ctx: RouteContext<"/api/imagen/mi-alineacion/[partidoId]">) {
  const { partidoId } = await ctx.params;
  const hincha = await obtenerHincha();
  if (!hincha) return new Response("Iniciá sesión", { status: 401, headers: SIN_CACHE });

  const cliente = await crearClienteServidor();
  const modelo = await modeloMiAlineacion(cliente, hincha.id, partidoId);
  if (!modelo) return new Response("No encontrado", { status: 404, headers: SIN_CACHE });
  const escudo = modelo.clubId === SELECCION ? await escudoDeLaSeleccion(cliente) : null;
  return imagenDe(
    modelo,
    { ...SIN_CACHE, "Content-Disposition": `inline; filename="${modelo.nombreArchivo}"` },
    { escudo },
  );
}

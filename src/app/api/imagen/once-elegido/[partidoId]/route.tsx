// Imagen pública del 11 Elegido de un Partido (ticket 16). Se lee con la
// service role, pero solo el resultado congelado con estado `con_once` y los
// Jugadores del 11 (sin datos de Hinchas). 404 si no hay 11 Elegido. En la
// Selección (Selección, ticket 12) suma el destacado (Gran Ausente final o
// Más Pedido, de las apariciones agregadas) y el escudo de la Selección.
import type { NextRequest } from "next/server";
import { SELECCION } from "@/domain/comun/tipos";
import { modeloOnceElegido } from "@/lib/compartir/datos";
import { escudoDeLaSeleccion } from "@/lib/compartir/escudo";
import { imagenDe } from "@/lib/compartir/imagen";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export async function GET(_pedido: NextRequest, ctx: RouteContext<"/api/imagen/once-elegido/[partidoId]">) {
  const { partidoId } = await ctx.params;
  const servicio = crearClienteAdmin();
  const modelo = await modeloOnceElegido(servicio, partidoId);
  if (!modelo) return new Response("No encontrado", { status: 404 });
  const escudo = modelo.clubId === SELECCION ? await escudoDeLaSeleccion(servicio) : null;
  return imagenDe(
    modelo,
    {
      // El resultado es inmutable; solo los datos del Jugador (y, en la
      // Selección, una Convocatoria cargada después del cierre) podrían cambiarla.
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Content-Disposition": `inline; filename="${modelo.nombreArchivo}"`,
    },
    { escudo },
  );
}

// Cron del cierre de Votaciones (ticket 12). Lo llama Vercel Cron (GET con
// `Authorization: Bearer ${CRON_SECRET}`) o pg_cron + pg_net desde Supabase
// (ver README). Sin el secreto correcto: 401.
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { cerrarVotacionesVencidas } from "@/lib/cierre/proceso";
import { etiquetaDelParcial } from "@/lib/parcial";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAutorizado(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const resumen = await cerrarVotacionesVencidas(crearClienteAdmin(), new Date());
  // El Parcial cacheado de esos Partidos ya no vale (ticket 11).
  for (const c of resumen.cerrados) if (c.creado) revalidateTag(etiquetaDelParcial(c.partidoId), "max");
  // Solo ids y estados: nada de datos de Hinchas.
  return NextResponse.json(resumen, { status: resumen.errores.length ? 500 : 200 });
}

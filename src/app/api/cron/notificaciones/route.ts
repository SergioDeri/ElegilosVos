// Cron de notificaciones push (ticket 15). Lo llama Vercel Cron (GET con
// `Authorization: Bearer ${CRON_SECRET}`) o pg_cron + pg_net desde Supabase
// (ver docs/DESARROLLO.md). Sin el secreto correcto: 401. Sin claves VAPID configuradas no
// envía nada (lo registra en el log) y responde 200 con `salteado: true`.
import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { enviarNotificaciones } from "@/lib/notificaciones/proceso";
import { crearEnvioWebPush } from "@/lib/notificaciones/web-push";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAutorizado(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const enviar = crearEnvioWebPush();
  if (!enviar) {
    console.warn("Notificaciones: faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT; no se envía nada.");
    return NextResponse.json({ salteado: true });
  }
  // Solo cantidades: nada de datos de Hinchas.
  return NextResponse.json(await enviarNotificaciones(crearClienteAdmin(), new Date(), enviar));
}

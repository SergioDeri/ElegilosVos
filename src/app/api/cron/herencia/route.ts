// Cron de Herencia de Alineación (ticket 10): materializa las Alineaciones
// heredadas de cada Votación abierta. Idempotente: se puede llamar seguido.
// Protegido con `Authorization: Bearer ${CRON_SECRET}` (lo manda Vercel Cron;
// pg_cron/pg_net también puede llamarla, ver docs/DESARROLLO.md).
import { cronAutorizado } from "@/lib/cron/autorizar";
import { materializarHerencias } from "@/lib/herencia/materializar";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request): Promise<Response> {
  if (!cronAutorizado(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const resultados = await materializarHerencias(crearClienteAdmin(), new Date());
  return Response.json({ ok: true, resultados });
}

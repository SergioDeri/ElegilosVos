"use server";

// Server Actions de la Convocatoria (Selección, ticket 09). TODAS empiezan con
// requerirAdminEnAccion(): Postgres verifica que sea Admin con 2FA y las
// escrituras van con el cliente de esa sesión (RLS con es_admin()).
//
// Al guardar o borrar, el Parcial de cada Partido afectado (los de antes y
// los de después) deja de estar en caché: pasa del Más Pedido al Gran Ausente
// provisorio (o al revés) en la próxima visita.
//
// Una Convocatoria con Gran Ausente final publicado (alguno de sus Partidos
// ya tiene 11 Elegido, ticket 10) queda fija: la base rechaza corregirla o
// borrarla con `EV100` (trigger `convocatoria_proteger_fija`).
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { validarConvocatoria, type ErroresConvocatoria } from "@/domain/convocatoria";
import { requerirAdminEnAccion } from "@/lib/auth/admin";
import { etiquetaDelParcial } from "@/lib/parcial";

type Supabase = Awaited<ReturnType<typeof requerirAdminEnAccion>>;

export type EstadoConvocatoria = {
  errores?: ErroresConvocatoria;
  mensaje?: string;
};

const RUTA = "/admin/convocatorias";

/** La base rechaza cambiar una Convocatoria con Gran Ausente final publicado. */
const CONVOCATORIA_FIJA = "EV100";
const MENSAJE_FIJA = "Esta Convocatoria ya tiene Gran Ausente final publicado: no se puede cambiar ni borrar.";

async function partidosDe(supabase: Supabase, convocatoria: string): Promise<string[]> {
  const { data, error } = await supabase.from("convocatoria_partido").select("partido_id").eq("convocatoria_id", convocatoria);
  if (error) throw error;
  return data.map((p) => p.partido_id);
}

function olvidarParciales(partidos: Iterable<string>) {
  for (const id of new Set(partidos)) updateTag(etiquetaDelParcial(id));
}

/** Alta (`id` null) o corrección de una Convocatoria con sus Jugadores y sus Partidos. */
export async function guardarConvocatoria(
  id: string | null,
  _previo: EstadoConvocatoria,
  formData: FormData,
): Promise<EstadoConvocatoria> {
  const supabase = await requerirAdminEnAccion();
  const validacion = validarConvocatoria({ jugadores: formData.getAll("jugador"), partidos: formData.getAll("partido") });
  if (!validacion.ok) return { errores: validacion.errores };

  const antes = id ? await partidosDe(supabase, id) : [];
  const { jugadores, partidos } = validacion.convocatoria;
  const { error } = await supabase.rpc("guardar_convocatoria", {
    // La función acepta null (alta); los tipos generados no lo dicen.
    convocatoria: id as string,
    jugadores: [...jugadores],
    partidos: [...partidos],
  });
  if (error) {
    if (error.code === "23505") return { errores: { partidos: "Un Partido elegido ya está en otra Convocatoria." } };
    if (error.code === "23514") return { mensaje: "Solo se convocan elegibles de la Selección, para Partidos de la Selección." };
    if (error.code === "P0002") return { mensaje: "Esa Convocatoria ya no existe." };
    if (error.code === CONVOCATORIA_FIJA) return { mensaje: MENSAJE_FIJA };
    return { mensaje: "No se pudo guardar la Convocatoria." };
  }
  olvidarParciales([...antes, ...partidos]);
  redirect(RUTA);
}

export async function borrarConvocatoria(id: string): Promise<void> {
  const supabase = await requerirAdminEnAccion();
  const antes = await partidosDe(supabase, id);
  const { error } = await supabase.from("convocatoria").delete().eq("id", id);
  // La página no ofrece borrar una Convocatoria fija; si se llega igual, vuelve a la ficha.
  if (error?.code === CONVOCATORIA_FIJA) redirect(`${RUTA}/${id}`);
  if (error) throw error;
  olvidarParciales(antes);
  redirect(RUTA);
}

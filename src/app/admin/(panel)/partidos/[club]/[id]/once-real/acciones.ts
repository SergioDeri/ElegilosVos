"use server";

// Server Actions del 11 Real (ticket 14; la Selección, Selección ticket 11). Empiezan con requerirAdminEnAccion()
// (es_admin() en Postgres) y escriben con el cliente de esa sesión. La
// validación (@/domain/once-real) se repite en la base (trigger).
import { refresh } from "next/cache";
import { esClubOSeleccion, SELECCION, type ClubOSeleccion } from "@/domain/comun/tipos";
import { validarOnceReal, type RechazoOnceReal } from "@/domain/once-real";
import { requerirAdminEnAccion } from "@/lib/auth/admin";

export type EstadoOnceReal = { mensaje?: string; ok?: boolean };

function textoRechazo(r: RechazoOnceReal, club: ClubOSeleccion): string {
  switch (r.motivo) {
    case "cantidad":
      return `Marcaste ${r.cantidad} Jugadores: tienen que ser exactamente 11.`;
    case "repetidos":
      return "Hay Jugadores repetidos.";
    case "ajenos":
      return club === SELECCION ? "Hay Jugadores que no son elegibles de la Selección." : "Hay Jugadores que no son del Club del Partido.";
    case "no_empezo":
      return "El 11 Real se carga desde el inicio del Partido.";
    case "cancelado":
      return "El Partido está cancelado: no tiene 11 Real.";
  }
}

export async function guardarOnceReal(
  club: ClubOSeleccion,
  partidoId: string,
  _previo: EstadoOnceReal,
  formData: FormData,
): Promise<EstadoOnceReal> {
  const supabase = await requerirAdminEnAccion();
  if (!esClubOSeleccion(club)) return { mensaje: "Club inválido." };

  const [{ data: partido }, { data: plantel, error: errorPlantel }] = await Promise.all([
    supabase.from("partido").select("inicio, estado").eq("id", partidoId).eq("club_id", club).maybeSingle(),
    supabase.from("jugador").select("id").eq("club_id", club),
  ]);
  if (!partido || errorPlantel) return { mensaje: "No se encontró el Partido." };

  const validacion = validarOnceReal({
    jugadores: formData.getAll("jugador"),
    plantel,
    partido: { inicio: new Date(partido.inicio), cancelado: partido.estado === "cancelado" },
    ahora: new Date(),
  });
  if (!validacion.ok) return { mensaje: textoRechazo(validacion, club) };

  // Corrección si ya existe; si no, alta. (Sin upsert: solo `jugadores` es editable.)
  const { data: corregido, error: errorCorreccion } = await supabase
    .from("once_real")
    .update({ jugadores: validacion.jugadores })
    .eq("partido_id", partidoId)
    .select("partido_id");
  if (errorCorreccion) return { mensaje: "No se pudo guardar el 11 Real." };
  if (corregido.length === 0) {
    const { error } = await supabase.from("once_real").insert({ partido_id: partidoId, jugadores: validacion.jugadores });
    if (error) return { mensaje: "No se pudo guardar el 11 Real." };
  }
  refresh();
  return { ok: true, mensaje: "11 Real guardado." };
}

export async function borrarOnceReal(partidoId: string): Promise<EstadoOnceReal> {
  const supabase = await requerirAdminEnAccion();
  const { data, error } = await supabase.from("once_real").delete().eq("partido_id", partidoId).select("partido_id");
  if (error || data.length === 0) return { mensaje: "No se pudo borrar el 11 Real." };
  refresh();
  return { ok: true, mensaje: "11 Real borrado." };
}

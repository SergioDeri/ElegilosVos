"use server";

// Server Actions del backoffice. TODAS empiezan con requerirAdminEnAccion():
// verifican en Postgres que la sesión sea de un Admin con 2FA y usan el
// cliente de esa sesión (RLS con es_admin()), nunca la service role.
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { esClubId, type ClubId } from "@/domain/comun/tipos";
import { validarDatosJugador, validarDisponibilidad, validarJugador, type Errores } from "@/domain/planteles";
import { requerirAdminEnAccion } from "@/lib/auth/admin";

export type EstadoFormulario = {
  errores?: Errores;
  mensaje?: string;
  ok?: boolean;
};

// -----------------------------------------------------------------------------
// Jugadores
// -----------------------------------------------------------------------------

export async function crearJugador(club: ClubId, _previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const supabase = await requerirAdminEnAccion();
  if (!esClubId(club)) return { mensaje: "Club inválido." };

  const validacion = validarJugador({
    nombre: formData.get("nombre"),
    numero: formData.get("numero"),
    posicionNatural: formData.get("posicionNatural"),
    disponibilidad: formData.get("disponibilidad"),
    motivo: formData.get("motivo"),
  });
  if (!validacion.ok) return { errores: validacion.errores };

  const j = validacion.jugador;
  const { error } = await supabase
    .from("jugador")
    .insert({
      club_id: club,
      nombre: j.nombre,
      numero: j.numero,
      posicion_natural: j.posicionNatural,
      disponibilidad: j.disponibilidad,
      motivo_disponibilidad: j.motivoDisponibilidad,
    });
  if (error) return { mensaje: "No se pudo dar de alta al Jugador." };
  redirect(`/admin/planteles/${club}`);
}

export async function editarDatosJugador(id: string, _previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const supabase = await requerirAdminEnAccion();
  const validacion = validarDatosJugador({
    nombre: formData.get("nombre"),
    numero: formData.get("numero"),
    posicionNatural: formData.get("posicionNatural"),
  });
  if (!validacion.ok) return { errores: validacion.errores };

  const { nombre, numero, posicionNatural } = validacion.datos;
  const { data, error } = await supabase
    .from("jugador")
    .update({ nombre, numero, posicion_natural: posicionNatural })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return { mensaje: "No se pudieron guardar los cambios." };
  refresh();
  return { ok: true, mensaje: "Datos guardados." };
}

export async function cambiarDisponibilidad(id: string, _previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const supabase = await requerirAdminEnAccion();
  const validacion = validarDisponibilidad({
    disponibilidad: formData.get("disponibilidad"),
    motivo: formData.get("motivo"),
  });
  if (!validacion.ok) return { errores: validacion.errores };

  // Si cambia la Disponibilidad, la base registra el evento (trigger).
  const { disponibilidad, motivoDisponibilidad } = validacion.disponibilidad;
  const { data, error } = await supabase
    .from("jugador")
    .update({ disponibilidad, motivo_disponibilidad: motivoDisponibilidad })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return { mensaje: "No se pudo cambiar la Disponibilidad." };
  refresh();
  return { ok: true, mensaje: "Disponibilidad guardada." };
}

/** Baja lógica (sale del Plantel, se conserva en el historial) o reincorporación. */
export async function cambiarEnPlantel(id: string, enPlantel: boolean): Promise<void> {
  const supabase = await requerirAdminEnAccion();
  await supabase.from("jugador").update({ en_plantel: enPlantel }).eq("id", id);
  refresh();
}

// -----------------------------------------------------------------------------
// Hinchas
// -----------------------------------------------------------------------------

export async function cambiarClubDeHincha(hinchaId: string, _previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const supabase = await requerirAdminEnAccion();
  const club = formData.get("club");
  if (!esClubId(club)) return { mensaje: "Elegí un Club." };

  const { error } = await supabase.rpc("cambiar_club_favorito", { hincha: hinchaId, club });
  if (error) return { mensaje: "No se pudo cambiar el Club Favorito." };
  refresh();
  return { ok: true, mensaje: "Club Favorito cambiado." };
}

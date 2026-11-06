"use server";

// Server Actions del backoffice. TODAS empiezan con requerirAdminEnAccion():
// verifican en Postgres que la sesión sea de un Admin con 2FA y usan el
// cliente de esa sesión (RLS con es_admin()), nunca la service role.
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { esClubId, type ClubId } from "@/domain/comun/tipos";
import { validarDatosJugador, validarDisponibilidad, validarJugador, type Errores } from "@/domain/planteles";
import { requerirAdminEnAccion } from "@/lib/auth/admin";
import { archivoElegido, leerImagen, subirImagen, type ImagenLeida } from "@/lib/imagenes/subida";

const BUCKET = "jugadores";

export type EstadoFormulario = {
  errores?: Errores & { foto?: string };
  mensaje?: string;
  ok?: boolean;
};

type Supabase = Awaited<ReturnType<typeof requerirAdminEnAccion>>;

const MENSAJE_FOTO = {
  vacia: "El archivo está vacío.",
  tamano: "La foto no puede pesar más de 2 MB.",
  formato: "La foto tiene que ser JPG, PNG o WebP.",
} as const;

/** Sube la foto y la asigna al Jugador; borra la anterior. */
function guardarFoto(supabase: Supabase, jugador: { id: string; club_id: string; foto_path: string | null }, foto: ImagenLeida) {
  return subirImagen(supabase, {
    bucket: BUCKET,
    carpeta: `${jugador.club_id}/${jugador.id}`,
    imagen: foto,
    anterior: jugador.foto_path,
    asignar: async (ruta) => {
      const { data, error } = await supabase.from("jugador").update({ foto_path: ruta }).eq("id", jugador.id).select("id");
      return !error && data.length > 0;
    },
  });
}

async function buscarJugador(supabase: Supabase, id: string) {
  const { data } = await supabase.from("jugador").select("id, club_id, foto_path").eq("id", id).maybeSingle();
  return data;
}

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
  const archivo = archivoElegido(formData, "foto");
  const foto = archivo ? await leerImagen(archivo) : null;
  if (!validacion.ok || (foto && !foto.ok)) {
    return {
      errores: {
        ...(validacion.ok ? {} : validacion.errores),
        ...(foto && !foto.ok ? { foto: MENSAJE_FOTO[foto.motivo] } : {}),
      },
    };
  }

  const j = validacion.jugador;
  const { data: creado, error } = await supabase
    .from("jugador")
    .insert({
      club_id: club,
      nombre: j.nombre,
      numero: j.numero,
      posicion_natural: j.posicionNatural,
      disponibilidad: j.disponibilidad,
      motivo_disponibilidad: j.motivoDisponibilidad,
    })
    .select("id, club_id, foto_path")
    .single();
  if (error) return { mensaje: "No se pudo dar de alta al Jugador." };

  if (foto?.ok && !(await guardarFoto(supabase, creado, foto))) {
    redirect(`/admin/jugadores/${creado.id}?aviso=foto`);
  }
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

export async function cambiarFoto(id: string, _previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const supabase = await requerirAdminEnAccion();
  const archivo = archivoElegido(formData, "foto");
  if (!archivo) return { errores: { foto: "Elegí una foto." } };
  const foto = await leerImagen(archivo);
  if (!foto.ok) return { errores: { foto: MENSAJE_FOTO[foto.motivo] } };

  const jugador = await buscarJugador(supabase, id);
  if (!jugador) return { mensaje: "No existe el Jugador." };
  if (!(await guardarFoto(supabase, jugador, foto))) return { mensaje: "No se pudo subir la foto." };
  refresh();
  return { ok: true, mensaje: "Foto guardada." };
}

export async function quitarFoto(id: string): Promise<void> {
  const supabase = await requerirAdminEnAccion();
  const jugador = await buscarJugador(supabase, id);
  if (!jugador?.foto_path) return;
  const { error } = await supabase.from("jugador").update({ foto_path: null }).eq("id", id);
  if (!error) await supabase.storage.from(BUCKET).remove([jugador.foto_path]);
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

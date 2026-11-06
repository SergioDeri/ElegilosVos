"use server";

// Server Actions de Rivales y Partidos (ticket 08). TODAS empiezan con
// requerirAdminEnAccion(): Postgres verifica que sea Admin con 2FA y las
// escrituras van con el cliente de esa sesión (RLS con es_admin()).
//
// Los cambios de Partidos que afectan el Calendario de Votación (Votación
// abierta que cambia, Votación que nunca abriría o que se reabre) no se
// guardan de entrada: devuelven los avisos y piden confirmación (`confirmar=1`).
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { PartidoCalendario } from "@/domain/calendario";
import { formatearHoraUy } from "@/domain/comun/horario";
import { esClubId, type ClubId } from "@/domain/comun/tipos";
import {
  analizarCambio,
  validarAccion,
  validarInicio,
  validarPartido,
  validarRival,
  type AccionSobrePartido,
  type ErroresPartido,
  type ErroresRival,
} from "@/domain/partidos";
import { requerirAdminEnAccion } from "@/lib/auth/admin";
import { archivoElegido, leerImagen, subirImagen, type ImagenLeida } from "@/lib/imagenes/subida";
import { BUCKET_ESCUDOS, cargarConOnceElegido, cargarPartidosDelClub, cargarRivales, type PartidoAdmin } from "./datos";
import { TEXTO_RECHAZO, textosDeAvisos } from "./textos";

type Supabase = Awaited<ReturnType<typeof requerirAdminEnAccion>>;

export type EstadoRival = {
  errores?: ErroresRival & { escudo?: string };
  mensaje?: string;
  ok?: boolean;
};

export type EstadoPartido = {
  errores?: ErroresPartido;
  mensaje?: string;
  ok?: boolean;
  /** Avisos del Calendario: el Admin tiene que confirmar para guardar. */
  avisos?: string[];
  /** Lo que mandó el Admin, para no perderlo al pedir confirmación. */
  valores?: { rivalId?: string; inicio?: string };
};

// -----------------------------------------------------------------------------
// Rivales
// -----------------------------------------------------------------------------

const MENSAJE_ESCUDO = {
  vacia: "El archivo está vacío.",
  tamano: "El escudo no puede pesar más de 2 MB.",
  formato: "El escudo tiene que ser JPG, PNG o WebP.",
} as const;

/** Sube el escudo y lo asigna al Rival; borra el anterior. */
function guardarEscudo(supabase: Supabase, rival: { id: string; escudo_path: string | null }, escudo: ImagenLeida) {
  return subirImagen(supabase, {
    bucket: BUCKET_ESCUDOS,
    carpeta: rival.id,
    imagen: escudo,
    anterior: rival.escudo_path,
    asignar: async (ruta) => {
      const { data, error } = await supabase.from("rival").update({ escudo_path: ruta }).eq("id", rival.id).select("id");
      return !error && data.length > 0;
    },
  });
}

function erroresDeEscritura(error: { code?: string; message?: string }): EstadoRival {
  if (error.code === "23505") {
    return /club_id/.test(error.message ?? "")
      ? { errores: { clubId: "Ya hay otro Rival que representa a ese Club." } }
      : { errores: { nombre: "Ya existe un Rival con ese nombre." } };
  }
  return { mensaje: "No se pudo guardar el Rival." };
}

export async function crearRival(_previo: EstadoRival, formData: FormData): Promise<EstadoRival> {
  const supabase = await requerirAdminEnAccion();
  const validacion = validarRival({ nombre: formData.get("nombre"), clubId: formData.get("clubId") });
  const archivo = archivoElegido(formData, "escudo");
  const escudo = archivo ? await leerImagen(archivo) : null;
  if (!validacion.ok || (escudo && !escudo.ok)) {
    return {
      errores: {
        ...(validacion.ok ? {} : validacion.errores),
        ...(escudo && !escudo.ok ? { escudo: MENSAJE_ESCUDO[escudo.motivo] } : {}),
      },
    };
  }

  const { nombre, clubId } = validacion.rival;
  const { data: creado, error } = await supabase
    .from("rival")
    .insert({ nombre, club_id: clubId })
    .select("id, escudo_path")
    .single();
  if (error) return erroresDeEscritura(error);

  if (escudo?.ok && !(await guardarEscudo(supabase, creado, escudo))) {
    redirect(`/admin/rivales/${creado.id}?aviso=escudo`);
  }
  redirect("/admin/rivales");
}

export async function editarRival(id: string, _previo: EstadoRival, formData: FormData): Promise<EstadoRival> {
  const supabase = await requerirAdminEnAccion();
  const validacion = validarRival({ nombre: formData.get("nombre"), clubId: formData.get("clubId") });
  if (!validacion.ok) return { errores: validacion.errores };

  const { nombre, clubId } = validacion.rival;
  const { data, error } = await supabase.from("rival").update({ nombre, club_id: clubId }).eq("id", id).select("id");
  if (error) return erroresDeEscritura(error);
  if (data.length === 0) return { mensaje: "No existe el Rival." };
  refresh();
  return { ok: true, mensaje: "Datos guardados." };
}

export async function cambiarEscudo(id: string, _previo: EstadoRival, formData: FormData): Promise<EstadoRival> {
  const supabase = await requerirAdminEnAccion();
  const archivo = archivoElegido(formData, "escudo");
  if (!archivo) return { errores: { escudo: "Elegí un escudo." } };
  const escudo = await leerImagen(archivo);
  if (!escudo.ok) return { errores: { escudo: MENSAJE_ESCUDO[escudo.motivo] } };

  const { data: rival } = await supabase.from("rival").select("id, escudo_path").eq("id", id).maybeSingle();
  if (!rival) return { mensaje: "No existe el Rival." };
  if (!(await guardarEscudo(supabase, rival, escudo))) return { mensaje: "No se pudo subir el escudo." };
  refresh();
  return { ok: true, mensaje: "Escudo guardado." };
}

export async function quitarEscudo(id: string): Promise<void> {
  const supabase = await requerirAdminEnAccion();
  const { data: rival } = await supabase.from("rival").select("escudo_path").eq("id", id).maybeSingle();
  if (!rival?.escudo_path) return;
  const { error } = await supabase.from("rival").update({ escudo_path: null }).eq("id", id);
  if (!error) await supabase.storage.from(BUCKET_ESCUDOS).remove([rival.escudo_path]);
  refresh();
}

/** Baja lógica (no se ofrece para Partidos nuevos) o reactivación. */
export async function cambiarActivoRival(id: string, activo: boolean): Promise<void> {
  const supabase = await requerirAdminEnAccion();
  await supabase.from("rival").update({ activo }).eq("id", id);
  refresh();
}

/** Borra un Rival sin Partidos (la base lo impide si tiene: ahí se da de baja). */
export async function borrarRival(id: string): Promise<void> {
  const supabase = await requerirAdminEnAccion();
  const { data, error } = await supabase.from("rival").delete().eq("id", id).select("escudo_path");
  if (error || data.length === 0) redirect(`/admin/rivales/${id}?aviso=borrar`);
  const escudo = data[0]?.escudo_path;
  if (escudo) await supabase.storage.from(BUCKET_ESCUDOS).remove([escudo]);
  redirect("/admin/rivales");
}

// -----------------------------------------------------------------------------
// Partidos
// -----------------------------------------------------------------------------

/** Id provisorio del Partido que se está dando de alta, para el análisis. */
const NUEVO = "nuevo";

function aCalendario(p: PartidoAdmin): PartidoCalendario {
  return { id: p.id, inicio: p.inicio, estado: p.estado, creadoEn: p.creadoEn };
}

/**
 * Si el cambio de `antes` a `despues` merece avisos y el Admin todavía no los
 * confirmó, devuelve el estado que los muestra; si no, null (se puede guardar).
 */
function pedirConfirmacion(
  antes: readonly PartidoAdmin[],
  despues: readonly PartidoCalendario[],
  ahora: Date,
  formData: FormData,
  valores: EstadoPartido["valores"],
  conOnceElegido: ReadonlySet<string>,
): EstadoPartido | null {
  if (formData.get("confirmar") === "1") return null;
  const avisos = analizarCambio(antes.map(aCalendario), despues, ahora, conOnceElegido);
  if (avisos.length === 0) return null;
  const porId = new Map(antes.map((p) => [p.id, p]));
  const nombre = (id: string) => {
    if (id === NUEVO) return "Este Partido";
    const p = porId.get(id);
    return p ? `Partido vs ${p.rivalNombre} (${formatearHoraUy(p.inicio)})` : "Este Partido";
  };
  return { avisos: textosDeAvisos(avisos, nombre), valores };
}

async function situacion(supabase: Supabase, id: string) {
  const { data: partido } = await supabase.from("partido").select("id, club_id, rival_id, estado, inicio").eq("id", id).maybeSingle();
  if (!partido || !esClubId(partido.club_id)) return null;
  const club: ClubId = partido.club_id;
  const [partidos, conOnceElegido] = await Promise.all([
    cargarPartidosDelClub(supabase, club),
    cargarConOnceElegido(supabase, club),
  ]);
  return {
    partido,
    club,
    partidos,
    conOnceElegido,
    situacion: {
      estado: partido.estado,
      inicio: new Date(partido.inicio),
      // Solo importa para borrar; se consulta ahí.
      tieneAlineaciones: false,
      // Resultado congelado (ticket 12): la Votación es definitiva.
      tieneOnceElegido: conOnceElegido.has(id),
    },
  };
}

function textosValores(formData: FormData) {
  const texto = (campo: string) => {
    const v = formData.get(campo);
    return typeof v === "string" ? v : undefined;
  };
  return { rivalId: texto("rivalId"), inicio: texto("inicio") };
}

export async function crearPartido(club: ClubId, _previo: EstadoPartido, formData: FormData): Promise<EstadoPartido> {
  const supabase = await requerirAdminEnAccion();
  if (!esClubId(club)) return { mensaje: "Club inválido." };
  const valores = textosValores(formData);

  const rivales = await cargarRivales(supabase);
  const validacion = validarPartido({ clubId: club, ...valores }, rivales);
  if (!validacion.ok) return { errores: validacion.errores, valores };
  const { rivalId, inicio } = validacion.partido;

  const ahora = new Date();
  const [antes, conOnceElegido] = await Promise.all([cargarPartidosDelClub(supabase, club), cargarConOnceElegido(supabase, club)]);
  const nuevo: PartidoCalendario = { id: NUEVO, inicio, estado: "programado", creadoEn: ahora };
  const confirmacion = pedirConfirmacion(antes, [...antes.map(aCalendario), nuevo], ahora, formData, valores, conOnceElegido);
  if (confirmacion) return confirmacion;

  const { error } = await supabase.from("partido").insert({ club_id: club, rival_id: rivalId, inicio: inicio.toISOString() });
  if (error) return { mensaje: "No se pudo cargar el Partido.", valores };
  redirect(`/admin/partidos/${club}`);
}

/** Cambia el Rival y/o el inicio (postergación o cambio de horario). No toca las Alineaciones. */
export async function reprogramarPartido(id: string, _previo: EstadoPartido, formData: FormData): Promise<EstadoPartido> {
  const supabase = await requerirAdminEnAccion();
  const valores = textosValores(formData);
  const actual = await situacion(supabase, id);
  if (!actual) return { mensaje: "No existe el Partido." };

  const rivales = await cargarRivales(supabase);
  const validacion = validarPartido({ clubId: actual.club, ...valores }, rivales, actual.partido.rival_id);
  if (!validacion.ok) return { errores: validacion.errores, valores };
  const { rivalId, inicio } = validacion.partido;

  const ahora = new Date();
  const permitido = validarAccion(actual.situacion, { tipo: "reprogramar", inicio }, ahora);
  if (!permitido.ok) return { mensaje: TEXTO_RECHAZO[permitido.motivo], valores };

  const despues = actual.partidos.map((p) => (p.id === id ? { ...aCalendario(p), inicio } : aCalendario(p)));
  const confirmacion = pedirConfirmacion(actual.partidos, despues, ahora, formData, valores, actual.conOnceElegido);
  if (confirmacion) return confirmacion;

  const { data, error } = await supabase
    .from("partido")
    .update({ rival_id: rivalId, inicio: inicio.toISOString() })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return { mensaje: "No se pudieron guardar los cambios.", valores };
  refresh();
  return {
    ok: true,
    mensaje: actual.situacion.tieneOnceElegido ? "Partido guardado. El 11 Elegido quedó igual: la Votación no se reabre." : "Partido guardado.",
  };
}

/** Cancela (anula la Votación) o reactiva con un inicio. Las Alineaciones se conservan. */
export async function cambiarEstadoPartido(
  id: string,
  accion: "cancelar" | "reactivar",
  _previo: EstadoPartido,
  formData: FormData,
): Promise<EstadoPartido> {
  const supabase = await requerirAdminEnAccion();
  const valores = textosValores(formData);
  const actual = await situacion(supabase, id);
  if (!actual) return { mensaje: "No existe el Partido." };

  let pedido: AccionSobrePartido;
  if (accion === "reactivar") {
    const inicio = validarInicio(valores.inicio);
    if (!inicio) return { errores: { inicio: "Fecha y hora inválidas." }, valores };
    pedido = { tipo: "reactivar", inicio };
  } else {
    pedido = { tipo: "cancelar" };
  }

  const ahora = new Date();
  const permitido = validarAccion(actual.situacion, pedido, ahora);
  if (!permitido.ok) return { mensaje: TEXTO_RECHAZO[permitido.motivo], valores };

  const cambio =
    pedido.tipo === "reactivar" ? { estado: "programado" as const, inicio: pedido.inicio } : { estado: "cancelado" as const };
  const despues = actual.partidos.map((p) => (p.id === id ? { ...aCalendario(p), ...cambio } : aCalendario(p)));
  const confirmacion = pedirConfirmacion(actual.partidos, despues, ahora, formData, valores, actual.conOnceElegido);
  if (confirmacion) return confirmacion;

  const { data, error } = await supabase
    .from("partido")
    .update(pedido.tipo === "reactivar" ? { estado: "programado", inicio: pedido.inicio.toISOString() } : { estado: "cancelado" })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return { mensaje: "No se pudo cambiar el Partido.", valores };
  refresh();
  const congelado = actual.situacion.tieneOnceElegido ? " El 11 Elegido quedó igual: la Votación no se reabre." : "";
  return {
    ok: true,
    mensaje:
      pedido.tipo === "reactivar"
        ? `Partido reactivado.${congelado}`
        : actual.situacion.tieneOnceElegido
          ? `Partido cancelado.${congelado}`
          : "Partido cancelado: su Votación quedó anulada.",
  };
}

/** Borra un Partido sin Alineaciones (con Alineaciones, se cancela). */
export async function borrarPartido(id: string, _previo: EstadoPartido, formData: FormData): Promise<EstadoPartido> {
  const supabase = await requerirAdminEnAccion();
  const actual = await situacion(supabase, id);
  if (!actual) return { mensaje: "No existe el Partido." };

  const { data: tieneAlineaciones, error: errorConsulta } = await supabase.rpc("partido_tiene_alineaciones", { partido: id });
  if (errorConsulta) return { mensaje: "No se pudo verificar si tiene Alineaciones." };

  const ahora = new Date();
  const permitido = validarAccion({ ...actual.situacion, tieneAlineaciones }, { tipo: "borrar" }, ahora);
  if (!permitido.ok) return { mensaje: TEXTO_RECHAZO[permitido.motivo] };

  const despues = actual.partidos.filter((p) => p.id !== id).map(aCalendario);
  const confirmacion = pedirConfirmacion(actual.partidos, despues, ahora, formData, {}, actual.conOnceElegido);
  if (confirmacion) return confirmacion;

  // La base también lo impide si aparecieron Alineaciones entretanto (EV080).
  const { error } = await supabase.from("partido").delete().eq("id", id);
  if (error) return { mensaje: error.code === "EV080" ? TEXTO_RECHAZO.con_alineaciones : "No se pudo borrar el Partido." };
  redirect(`/admin/partidos/${actual.club}`);
}

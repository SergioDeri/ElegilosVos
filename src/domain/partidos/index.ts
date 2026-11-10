// Reglas de Rivales y Partidos para el backoffice (ticket 08). Lógica pura.
//
// El escudo de un Rival se valida con `validarEscudo` de @/domain/planteles
// (PNG pixel art de exactamente 48x48, por contenido real).
import { aHoraUyLocal, desdeHoraUy } from "@/domain/comun/horario";
import { CLUBES, esClubOSeleccion, SELECCION, type ClubId, type ClubOSeleccion, type EstadoPartido } from "@/domain/comun/tipos";
import { calcularVotaciones, cierreDeVotacion, type PartidoCalendario, type Votacion } from "@/domain/calendario";

export const LARGO_MAXIMO_NOMBRE_RIVAL = 60;

// -----------------------------------------------------------------------------
// Rival
// -----------------------------------------------------------------------------

export type Rival = {
  nombre: string;
  /** Club que representa este Rival (Peñarol o Nacional, para el Clásico); null si es un Rival común. */
  clubId: ClubId | null;
};

export type ErroresRival = Partial<Record<"nombre" | "clubId", string>>;
export type ResultadoRival = { ok: true; rival: Rival } | { ok: false; errores: ErroresRival };

/** Nombre y Club representado, tal como llegan de un formulario ("" = ninguno). */
export function validarRival(entrada: { nombre: unknown; clubId: unknown }): ResultadoRival {
  const errores: ErroresRival = {};

  const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim().replace(/\s+/g, " ") : "";
  if (!nombre) errores.nombre = "Falta el nombre.";
  else if (nombre.length > LARGO_MAXIMO_NOMBRE_RIVAL) errores.nombre = `Máximo ${LARGO_MAXIMO_NOMBRE_RIVAL} caracteres.`;

  const sinClub = entrada.clubId === null || entrada.clubId === undefined || entrada.clubId === "";
  const clubId = sinClub ? null : (CLUBES.find((c) => c === entrada.clubId) ?? undefined);
  if (clubId === undefined) errores.clubId = "Club inválido.";

  if (Object.keys(errores).length > 0 || clubId === undefined) return { ok: false, errores };
  return { ok: true, rival: { nombre, clubId } };
}

// -----------------------------------------------------------------------------
// Partido
// -----------------------------------------------------------------------------

/** Lo que hace falta de un Rival para cargar un Partido. */
export type RivalParaPartido = { id: string; activo: boolean; clubId: ClubId | null };

/**
 * Rivales que se pueden elegir para un Partido del Club o de la Selección:
 * los activos, salvo el propio Club (la Selección no juega contra ningún
 * Club: sus Rivales son otras selecciones). Al editar, `rivalActualId` se
 * sigue ofreciendo aunque se haya dado de baja (el Partido ya lo tenía).
 */
export function rivalesParaPartido<R extends RivalParaPartido>(
  rivales: readonly R[],
  clubId: ClubOSeleccion,
  rivalActualId?: string,
): R[] {
  return rivales.filter((r) => puedeEnfrentar(clubId, r) && (r.activo || r.id === rivalActualId));
}

function puedeEnfrentar(clubId: ClubOSeleccion, rival: RivalParaPartido): boolean {
  return clubId === SELECCION ? rival.clubId === null : rival.clubId !== clubId;
}

/** Un Partido es de un Club o de la Selección. */
export type DatosPartido = { clubId: ClubOSeleccion; rivalId: string; inicio: Date };
export type ErroresPartido = Partial<Record<"clubId" | "rivalId" | "inicio", string>>;
export type ResultadoPartido = { ok: true; partido: DatosPartido } | { ok: false; errores: ErroresPartido };

/**
 * Club (o la Selección), Rival e inicio tal como llegan del formulario. El inicio es la fecha y
 * hora de Montevideo de un `<input type="datetime-local">` ("2026-11-10T20:00")
 * y se devuelve como instante UTC.
 */
export function validarPartido(
  entrada: { clubId: unknown; rivalId: unknown; inicio: unknown },
  rivales: readonly RivalParaPartido[],
  rivalActualId?: string,
): ResultadoPartido {
  const errores: ErroresPartido = {};

  const clubId = esClubOSeleccion(entrada.clubId) ? entrada.clubId : undefined;
  if (!clubId) errores.clubId = "Club inválido.";

  const rival = clubId ? rivalesParaPartido(rivales, clubId, rivalActualId).find((r) => r.id === entrada.rivalId) : undefined;
  if (clubId && !rival) {
    const existente = rivales.find((r) => r.id === entrada.rivalId);
    errores.rivalId =
      clubId === SELECCION && existente && existente.clubId !== null
        ? "La Selección no juega contra un Club."
        : existente?.clubId === clubId
          ? "Un Club no puede jugar contra sí mismo."
          : existente && !existente.activo
            ? "Ese Rival está dado de baja."
            : "Elegí un Rival.";
  }

  const inicio = validarInicio(entrada.inicio);
  if (!inicio) errores.inicio = "Fecha y hora inválidas.";

  if (!clubId || !rival || !inicio || Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, partido: { clubId, rivalId: rival.id, inicio } };
}

// -----------------------------------------------------------------------------
// Avisos de un cambio en el calendario del Club
// -----------------------------------------------------------------------------

export type AvisoCambio =
  /** La Votación de este Partido no abriría nunca (abre >= cierra). */
  | { tipo: "nunca_abre"; partidoId: string }
  /** Cambia una Votación que está abierta ahora (su cierre, su apertura o su estado). `despues` null: el Partido se borra. */
  | { tipo: "afecta_votacion_abierta"; partidoId: string; antes: Votacion; despues: Votacion | null }
  /** Una Votación que ya había cerrado volvería a estar pendiente o abierta. */
  | { tipo: "reabre_votacion"; partidoId: string };

/** La Votación no abre nunca: su ventana [abre, cierra) está vacía. */
export function ventanaVacia(votacion: Votacion): boolean {
  return votacion.abre.getTime() >= votacion.cierra.getTime();
}

/**
 * Compara el Calendario de Votación de un Club antes y después de un cambio
 * (alta, postergación, cancelación, reactivación o baja de un Partido) y
 * devuelve lo que el Admin tiene que saber antes de confirmarlo. `antes` y
 * `despues` son todos los Partidos del Club.
 *
 * `conOnceElegido`: ids de los Partidos cuya Votación ya tiene resultado
 * congelado. Esa Votación es definitiva (no se reabre aunque el Calendario
 * la vea pendiente o abierta), así que no se avisa nada sobre ella; sí sobre
 * lo que el cambio provoca en las demás.
 *
 * `de`: el Club o la Selección de los Partidos (cada uno con su regla de
 * apertura; ver `calcularVotaciones`).
 */
export function analizarCambio(
  antes: readonly PartidoCalendario[],
  despues: readonly PartidoCalendario[],
  ahora: Date,
  conOnceElegido: ReadonlySet<string> = new Set(),
  de?: ClubOSeleccion,
): AvisoCambio[] {
  const previas = new Map(calcularVotaciones(antes, ahora, de).map((v) => [v.partidoId, v]));
  const avisos: AvisoCambio[] = [];

  for (const v of calcularVotaciones(despues, ahora, de)) {
    const previa = previas.get(v.partidoId);
    previas.delete(v.partidoId);
    if (conOnceElegido.has(v.partidoId)) continue;

    const vaciaAntes = previa !== undefined && previa.estado !== "anulada" && ventanaVacia(previa);
    if (v.estado !== "anulada" && ventanaVacia(v) && !vaciaAntes) {
      avisos.push({ tipo: "nunca_abre", partidoId: v.partidoId });
    }
    if (previa?.estado === "abierta" && !mismaVotacion(previa, v)) {
      avisos.push({ tipo: "afecta_votacion_abierta", partidoId: v.partidoId, antes: previa, despues: v });
    }
    if (previa?.estado === "cerrada" && (v.estado === "abierta" || v.estado === "pendiente")) {
      avisos.push({ tipo: "reabre_votacion", partidoId: v.partidoId });
    }
  }

  for (const previa of previas.values()) {
    if (previa.estado === "abierta") {
      avisos.push({ tipo: "afecta_votacion_abierta", partidoId: previa.partidoId, antes: previa, despues: null });
    }
  }
  return avisos;
}

function mismaVotacion(a: Votacion, b: Votacion): boolean {
  return a.estado === b.estado && a.abre.getTime() === b.abre.getTime() && a.cierra.getTime() === b.cierra.getTime();
}

// -----------------------------------------------------------------------------
// Postergar, cancelar, reactivar y borrar
// -----------------------------------------------------------------------------

export type SituacionPartido = {
  estado: EstadoPartido;
  inicio: Date;
  /** Algún Hincha guardó una Alineación para este Partido. */
  tieneAlineaciones: boolean;
  /** Su Votación ya cerró y tiene resultado congelado (ticket 12): no se reabre ni se borra el Partido. */
  tieneOnceElegido: boolean;
};

export type AccionSobrePartido =
  /** Postergar o cambiar el horario (Partido programado). */
  | { tipo: "reprogramar"; inicio: Date }
  | { tipo: "cancelar" }
  /** Deshacer una cancelación, con el inicio (nuevo o el mismo). */
  | { tipo: "reactivar"; inicio: Date }
  | { tipo: "borrar" };

export type MotivoRechazo =
  | "once_elegido"
  | "cancelado"
  | "ya_cancelado"
  | "no_cancelado"
  | "cierre_pasado"
  | "con_alineaciones";

export type ResultadoAccion = { ok: true } | { ok: false; motivo: MotivoRechazo };

/**
 * Si se puede hacer `accion` sobre el Partido en el instante `ahora`.
 *
 * - Con 11 Elegido la Votación es definitiva, pero el Partido se puede
 *   postergar, cancelar o reactivar (por ejemplo, se suspendió en la última
 *   hora): el 11 Elegido queda congelado y la Votación no se reabre (la base
 *   lo garantiza con `votacion_abierta`). Lo que no se puede es borrarlo.
 * - Postergar / cambiar horario: solo un Partido programado (uno cancelado
 *   primero se reactiva).
 * - Reactivar (deshacer la cancelación): solo si la Votación con el inicio
 *   elegido todavía no cerró (cierre > ahora). Así sirve para corregir una
 *   cancelación por error o reprogramar un Partido suspendido sin perder las
 *   Alineaciones, pero nunca deja una Votación cerrada que no pasó por el
 *   cierre (y que por eso no tendría 11 Elegido).
 * - Borrar: solo sin Alineaciones; si tiene, se cancela.
 */
export function validarAccion(partido: SituacionPartido, accion: AccionSobrePartido, ahora: Date): ResultadoAccion {
  switch (accion.tipo) {
    case "reprogramar":
      return partido.estado === "programado" ? { ok: true } : rechazo("cancelado");
    case "cancelar":
      return partido.estado === "programado" ? { ok: true } : rechazo("ya_cancelado");
    case "reactivar":
      if (partido.estado !== "cancelado") return rechazo("no_cancelado");
      // Con 11 Elegido la Votación ya pasó por el cierre: cualquier inicio sirve.
      if (partido.tieneOnceElegido) return { ok: true };
      return cierreDeVotacion(accion.inicio).getTime() > ahora.getTime() ? { ok: true } : rechazo("cierre_pasado");
    case "borrar":
      if (partido.tieneOnceElegido) return rechazo("once_elegido");
      return partido.tieneAlineaciones ? rechazo("con_alineaciones") : { ok: true };
  }
}

function rechazo(motivo: MotivoRechazo): ResultadoAccion {
  return { ok: false, motivo };
}

/**
 * Fecha y hora de Montevideo de un `<input type="datetime-local">` como
 * instante UTC, o null si no es una fecha y hora válida.
 *
 * Excepción a la regla de horas (docs/DESARROLLO.md, convención 5): es la única hora de
 * Montevideo que entra al dominio. Se queda acá porque `validarPartido` valida
 * el formulario completo del Partido (Club, Rival e inicio, con sus errores por
 * campo) y el inicio sale de ella ya en UTC; sacarla al borde partiría esa
 * validación en dos lugares.
 */
export function validarInicio(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim().slice(0, 16);
  try {
    const instante = desdeHoraUy(texto);
    // Descarta fechas que no existen (2026-02-30 "pasa" a marzo).
    return aHoraUyLocal(instante) === texto ? instante : null;
  } catch {
    return null;
  }
}

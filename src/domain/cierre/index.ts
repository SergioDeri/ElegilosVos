/**
 * Cierre de Votación y 11 Elegido (ticket 12). Lógica pura.
 *
 * - `decidirCierre`: qué hacer con una Votación en el instante `ahora`
 *   (esperar, contar o registrarla sin 11 Elegido).
 * - `disponibilidadAlCierre`: la Disponibilidad de cada Jugador a la hora de
 *   cierre, deshaciendo los cambios registrados después.
 * - `resultadoDelConteo`: el resultado a congelar a partir de `contar`.
 * - `coincidencia`: Jugadores en común entre dos onces (sin importar el Puesto).
 * - `onceDesdeJson`: lectura tolerante del 11 congelado (jsonb).
 */
import type { Disponibilidad } from "@/domain/comun/tipos";
import type { Asignacion, ResultadoConteo } from "@/domain/conteo";
import { PUESTO_IDS, type EsquemaId, type PuestoId } from "@/domain/esquemas";

/** Estados del resultado congelado (columna `resultado_votacion.estado`). */
export const ESTADOS_RESULTADO = ["con_once", "sin_alineaciones", "anulada", "nunca_abrio"] as const;
export type EstadoResultado = (typeof ESTADOS_RESULTADO)[number];

export function esEstadoResultado(valor: unknown): valor is EstadoResultado {
  return ESTADOS_RESULTADO.some((e) => e === valor);
}

/**
 * El estado leído de `resultado_votacion.estado`. La columna tiene un check
 * con estos valores, así que otro valor es un error de la base y se lanza.
 */
export function estadoResultadoDeLaBase(valor: string): EstadoResultado {
  if (!esEstadoResultado(valor)) throw new Error(`Estado de resultado desconocido: ${valor}`);
  return valor;
}

/** Lo que hace falta de la Votación (`votacion_de_partido` o `calcularVotaciones`). */
export interface VotacionACerrar {
  readonly estado: "pendiente" | "abierta" | "cerrada" | "anulada";
  readonly abre: Date;
  readonly cierra: Date;
}

export type DecisionCierre =
  | { readonly accion: "esperar" }
  | { readonly accion: "contar" }
  | { readonly accion: "registrar"; readonly estado: "anulada" | "nunca_abrio" };

/**
 * Qué hacer con una Votación en `ahora`:
 * - antes de la hora de cierre, esperar (también si el Partido está cancelado);
 * - cancelado y con la hora de cierre pasada: registrarla `anulada`;
 * - cerrada pero con la ventana vacía (`abre >= cierra`): `nunca_abrio`;
 * - cerrada: contar las Alineaciones.
 */
export function decidirCierre(votacion: VotacionACerrar, ahora: Date): DecisionCierre {
  if (ahora.getTime() < votacion.cierra.getTime()) return { accion: "esperar" };
  if (votacion.estado === "anulada") return { accion: "registrar", estado: "anulada" };
  if (votacion.estado !== "cerrada") return { accion: "esperar" };
  if (votacion.abre.getTime() >= votacion.cierra.getTime()) return { accion: "registrar", estado: "nunca_abrio" };
  return { accion: "contar" };
}

/** Un cambio de Disponibilidad registrado (tabla `evento_disponibilidad`). */
export interface CambioDeDisponibilidad {
  readonly jugadorId: string;
  readonly disponibilidadAnterior: Disponibilidad;
  readonly momento: Date;
}

/**
 * Devuelve los Jugadores con la Disponibilidad que tenían a la hora `cierre`:
 * si un Jugador cambió en `cierre` o después, vale la anterior al primero de
 * esos cambios. El resto de los datos se conserva tal cual.
 */
export function disponibilidadAlCierre<J extends { readonly id: string; readonly disponibilidad: Disponibilidad }>(
  jugadores: readonly J[],
  cambios: readonly CambioDeDisponibilidad[],
  cierre: Date,
): J[] {
  const primero = new Map<string, CambioDeDisponibilidad>();
  for (const c of cambios) {
    if (c.momento.getTime() < cierre.getTime()) continue;
    const previo = primero.get(c.jugadorId);
    if (!previo || c.momento.getTime() < previo.momento.getTime()) primero.set(c.jugadorId, c);
  }
  return jugadores.map((j) => {
    const c = primero.get(j.id);
    return c ? { ...j, disponibilidad: c.disponibilidadAnterior } : j;
  });
}

/** Resultado a congelar (sin Partido ni horas: las pone quien lo guarda). */
export interface ResultadoACongelar {
  readonly estado: "con_once" | "sin_alineaciones";
  readonly esquema: EsquemaId | null;
  readonly once: readonly Asignacion[] | null;
  /** La salida completa de `contar` (no tiene datos de Hinchas). */
  readonly detalle: ResultadoConteo;
  readonly alineacionesQueCuentan: number;
}

export function resultadoDelConteo(conteo: ResultadoConteo): ResultadoACongelar {
  if (conteo.vacio) {
    return { estado: "sin_alineaciones", esquema: null, once: null, detalle: conteo, alineacionesQueCuentan: 0 };
  }
  return {
    estado: "con_once",
    esquema: conteo.esquemaGanador,
    once: conteo.once,
    detalle: conteo,
    alineacionesQueCuentan: conteo.alineacionesQueCuentan,
  };
}

/** Cantidad de Jugadores distintos en común entre dos onces (vacíos ignorados). */
export function coincidencia(
  a: Iterable<string | null | undefined>,
  b: Iterable<string | null | undefined>,
): number {
  const enB = new Set<string>();
  for (const id of b) if (id) enB.add(id);
  const comunes = new Set<string>();
  for (const id of a) if (id && enB.has(id)) comunes.add(id);
  return comunes.size;
}

const PUESTOS = new Set<string>(PUESTO_IDS);

function esAsignacion(v: unknown): v is Asignacion {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.puesto === "string" &&
    PUESTOS.has(a.puesto) &&
    (a.jugadorId === null || typeof a.jugadorId === "string") &&
    (a.origen === "votos" || a.origen === "vacante") &&
    typeof a.votos === "number"
  );
}

/** El 11 congelado (jsonb). Si algo no tiene la forma esperada, devuelve `[]`. */
export function onceDesdeJson(valor: unknown): Asignacion[] {
  if (!Array.isArray(valor) || !valor.every(esAsignacion)) return [];
  return valor.map((a) => ({ puesto: a.puesto as PuestoId, jugadorId: a.jugadorId, origen: a.origen, votos: a.votos }));
}

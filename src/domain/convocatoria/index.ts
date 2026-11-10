/**
 * Convocatoria de la Selección (Selección, ticket 09). Lógica pura.
 *
 *   const r = validarConvocatoria({ jugadores: formData.getAll("jugador"), partidos: formData.getAll("partido") });
 *   if (r.ok) guardar(r.convocatoria);
 *
 * Una Convocatoria es la lista de Jugadores que el DT llama a la Selección
 * (elegibles del Plantel de la Selección) para uno o más de sus Partidos (por
 * ejemplo, los dos de una fecha doble). Que los Jugadores sean de la Selección,
 * que los Partidos también y que cada Partido esté en una sola Convocatoria lo
 * garantiza la base; acá se valida la forma de lo que llega del formulario.
 */
import { esUuid } from "@/domain/comun/ids";

export interface Convocatoria {
  /** Ids de los Jugadores convocados, sin repetir. */
  readonly jugadores: readonly string[];
  /** Ids de los Partidos de la Selección a los que se aplica, sin repetir. */
  readonly partidos: readonly string[];
}

export type ErroresConvocatoria = Partial<Record<"jugadores" | "partidos", string>>;
export type ResultadoConvocatoria = { ok: true; convocatoria: Convocatoria } | { ok: false; errores: ErroresConvocatoria };

/** Valida los Jugadores y Partidos elegidos (tal como llegan de un formulario). */
export function validarConvocatoria(entrada: { jugadores: readonly unknown[]; partidos: readonly unknown[] }): ResultadoConvocatoria {
  const jugadores = [...new Set(entrada.jugadores.filter(esUuid))];
  const partidos = [...new Set(entrada.partidos.filter(esUuid))];
  const errores: ErroresConvocatoria = {};
  if (!entrada.jugadores.every(esUuid)) errores.jugadores = "Hay un Jugador inválido.";
  else if (jugadores.length === 0) errores.jugadores = "Elegí al menos un Jugador.";
  if (!entrada.partidos.every(esUuid)) errores.partidos = "Hay un Partido inválido.";
  else if (partidos.length === 0) errores.partidos = "Elegí al menos un Partido.";
  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, convocatoria: { jugadores, partidos } };
}

// 11 Real (ticket 14): los 11 titulares que puso el DT, sin Esquema. Lógica
// pura de la carga del Admin. La base aplica las mismas reglas (trigger
// `once_real_validar`). `coincidencias` junta las Coincidencias que ve el
// Hincha (con `coincidencia` de `@/domain/cierre`); sirve a los Clubes y a la
// Selección (Selección, ticket 11).
import { coincidencia } from "@/domain/cierre";

export const JUGADORES_DEL_ONCE_REAL = 11;

export type RechazoOnceReal =
  | { readonly ok: false; readonly motivo: "cantidad"; readonly cantidad: number }
  | { readonly ok: false; readonly motivo: "repetidos" | "ajenos" | "no_empezo" | "cancelado" };

export type ResultadoOnceReal = { readonly ok: true; readonly jugadores: string[] } | RechazoOnceReal;

/**
 * Valida el 11 Real que marca el Admin:
 * - el Partido no está cancelado y ya empezó (`ahora >= inicio`);
 * - exactamente 11 Jugadores, sin repetir;
 * - todos del `plantel` del Club del Partido (puede incluir bajas recientes:
 *   lo decide quien arma la lista).
 * `jugadores` llega tal cual del formulario (lista de ids).
 */
export function validarOnceReal(entrada: {
  jugadores: unknown;
  plantel: readonly { readonly id: string }[];
  partido: { readonly inicio: Date; readonly cancelado: boolean };
  ahora: Date;
}): ResultadoOnceReal {
  const { partido, ahora } = entrada;
  if (partido.cancelado) return { ok: false, motivo: "cancelado" };
  if (ahora.getTime() < partido.inicio.getTime()) return { ok: false, motivo: "no_empezo" };

  const lista: unknown[] = Array.isArray(entrada.jugadores) ? entrada.jugadores : [];
  if (lista.length !== JUGADORES_DEL_ONCE_REAL) return { ok: false, motivo: "cantidad", cantidad: lista.length };

  const delPlantel = new Set(entrada.plantel.map((j) => j.id));
  if (!lista.every((id): id is string => typeof id === "string" && delPlantel.has(id))) {
    return { ok: false, motivo: "ajenos" };
  }
  if (new Set(lista).size !== lista.length) return { ok: false, motivo: "repetidos" };
  return { ok: true, jugadores: [...lista] };
}

type Once = readonly (string | null | undefined)[];

/** Las Coincidencias que ve el Hincha; null si falta alguno de los dos onces. */
export interface Coincidencias {
  /** Alineación del Hincha contra el 11 Elegido. */
  readonly alineacionConElegido: number | null;
  /** Alineación del Hincha contra el 11 Real. */
  readonly alineacionConReal: number | null;
  /** 11 Elegido contra el 11 Real ("la hinchada acertó X de 11"). */
  readonly elegidoConReal: number | null;
}

/**
 * Las Coincidencias entre la Alineación del Hincha, el 11 Elegido y el 11 Real
 * (Jugadores en común, sin importar el Puesto; los vacantes no cuentan). Cada
 * uno es null si no está: el Hincha no armó Alineación, la Votación no tuvo 11
 * Elegido o el Admin no cargó el 11 Real.
 */
export function coincidencias(entrada: {
  alineacion: Once | null;
  onceElegido: Once | null;
  onceReal: Once | null;
}): Coincidencias {
  const entre = (a: Once | null, b: Once | null) => (a && b ? coincidencia(a, b) : null);
  const { alineacion, onceElegido, onceReal } = entrada;
  return {
    alineacionConElegido: entre(alineacion, onceElegido),
    alineacionConReal: entre(alineacion, onceReal),
    elegidoConReal: entre(onceElegido, onceReal),
  };
}

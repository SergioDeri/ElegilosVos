// 11 Real (ticket 14): los 11 titulares que puso el DT, sin Esquema. Lógica
// pura de la carga del Admin. La base aplica las mismas reglas (trigger
// `once_real_validar`); la Coincidencia se calcula con `coincidencia` de
// `@/domain/cierre`.

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

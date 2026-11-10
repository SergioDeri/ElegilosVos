/**
 * Destacados de la Selección (Selección, ticket 08): el Más Pedido y el Gran
 * Ausente. Lógica pura.
 *
 *   const apariciones = contarApariciones(alineaciones); // las mismas que el Conteo, incluidas las heredadas (ADR-0002)
 *   destacado(apariciones);                // sin Convocatoria: el Más Pedido
 *   destacado(apariciones, convocados);    // con Convocatoria: el Gran Ausente (o null)
 *
 * Las **apariciones** de un Jugador son en cuántas Alineaciones figura, en
 * cualquier Puesto de su Esquema (los Puestos que no son del Esquema se
 * ignoran, como en el Conteo). El porcentaje es sobre las Alineaciones con al
 * menos un Jugador. No mira la Disponibilidad: mide a quién pide la gente.
 * Las apariciones son agregadas: no dicen quién votó.
 */
import { esPuestoDe, type EsquemaId, type PuestoId } from "@/domain/esquemas";

// ---------- Entrada ----------

/** Lo mínimo de una Alineación para contar apariciones (la del Editor y la del Conteo sirven). */
export interface AlineacionConJugadores {
  readonly esquema: EsquemaId;
  readonly puestos: Readonly<Partial<Record<PuestoId, { readonly jugadorId: string }>>>;
}

export interface AparicionesDeJugador {
  readonly jugadorId: string;
  /** Alineaciones en las que figura (una por Alineación, aunque esté en dos Puestos). */
  readonly apariciones: number;
}

export interface Apariciones {
  /** Alineaciones con al menos un Jugador (la base del porcentaje). */
  readonly alineaciones: number;
  /** Solo los Jugadores que figuran en alguna Alineación, ordenados por id. */
  readonly porJugador: readonly AparicionesDeJugador[];
}

/** Ids de los Jugadores convocados para el Partido. */
export type Convocatoria = readonly string[];

// ---------- Salida ----------

export interface JugadorDestacado {
  readonly jugadorId: string;
  readonly apariciones: number;
  /** 0..100, sobre las Alineaciones con al menos un Jugador. Sin redondear. */
  readonly porcentaje: number;
}

export type TipoDestacado = "mas_pedido" | "gran_ausente";

export interface Destacado {
  /** `mas_pedido` sin Convocatoria; `gran_ausente` con Convocatoria. */
  readonly tipo: TipoDestacado;
  /** El más elegido; con empate, todos los empatados (ordenados por id). Nunca vacío. */
  readonly jugadores: readonly JugadorDestacado[];
}

// ---------- Cálculo ----------

/** Cuenta en cuántas Alineaciones figura cada Jugador. */
export function contarApariciones(alineaciones: readonly AlineacionConJugadores[]): Apariciones {
  const porJugador = new Map<string, number>();
  let conJugadores = 0;
  for (const a of alineaciones) {
    const jugadores = new Set<string>();
    for (const [puesto, ocupado] of Object.entries(a.puestos)) {
      if (ocupado && esPuestoDe(a.esquema, puesto)) jugadores.add(ocupado.jugadorId);
    }
    if (jugadores.size === 0) continue;
    conJugadores++;
    for (const id of jugadores) porJugador.set(id, (porJugador.get(id) ?? 0) + 1);
  }
  return {
    alineaciones: conJugadores,
    porJugador: [...porJugador]
      .map(([jugadorId, apariciones]) => ({ jugadorId, apariciones }))
      .sort((x, y) => (x.jugadorId < y.jugadorId ? -1 : x.jugadorId > y.jugadorId ? 1 : 0)),
  };
}

/**
 * El destacado del Partido:
 * - sin Convocatoria (`undefined` o `null`): el **Más Pedido**, el que figura en más Alineaciones;
 * - con Convocatoria: el **Gran Ausente**, el no convocado que figura en más Alineaciones;
 * - `null` si nadie figura en ninguna Alineación (o, con Convocatoria, ningún no convocado).
 * Con empate, todos los empatados.
 */
export function destacado(apariciones: Apariciones, convocatoria?: Convocatoria | null): Destacado | null {
  const convocados = convocatoria ? new Set(convocatoria) : null;
  const candidatos = apariciones.porJugador.filter((j) => j.apariciones > 0 && !convocados?.has(j.jugadorId));
  if (candidatos.length === 0) return null;
  const maximo = Math.max(...candidatos.map((j) => j.apariciones));
  return {
    tipo: convocados ? "gran_ausente" : "mas_pedido",
    jugadores: candidatos
      .filter((j) => j.apariciones === maximo)
      .map((j) => ({
        jugadorId: j.jugadorId,
        apariciones: j.apariciones,
        porcentaje: (j.apariciones / apariciones.alineaciones) * 100,
      })),
  };
}

/**
 * Conteo de una Votación a partir de las filas de la base (ticket 11).
 *
 * Adaptador puro entre las tablas (`alineacion`, `jugador`) y el Motor de
 * Conteo: lo usan el Parcial (ticket 11) y el cierre / 11 Elegido (ticket 12).
 * El resultado es el de `contar` pasado por `soloAgregados`: sin datos de Hinchas.
 */
import { alineacionDesdeFila, COLUMNAS_ALINEACION, type FilaAlineacion } from "@/domain/armado";
import type { Disponibilidad, PosicionNatural } from "@/domain/comun/tipos";
import { contar, type JugadorParaConteo, type ResultadoConteo } from "@/domain/conteo";

export type { FilaAlineacion } from "@/domain/armado";

/** Columnas de la tabla `jugador` que necesita el conteo. */
export interface FilaJugadorParaConteo {
  id: string;
  numero: number;
  posicion_natural: PosicionNatural;
  disponibilidad: Disponibilidad;
  en_plantel: boolean;
}

/** Columnas a pedir a la tabla `jugador` (`select(COLUMNAS_JUGADOR_PARA_CONTEO)`). */
export const COLUMNAS_JUGADOR_PARA_CONTEO = "id, numero, posicion_natural, disponibilidad, en_plantel";

/** Columnas a pedir a la tabla `alineacion` (nunca `hincha_id`). */
export const COLUMNAS_ALINEACION_PARA_CONTEO = COLUMNAS_ALINEACION;

export function jugadorParaConteoDesdeFila(fila: FilaJugadorParaConteo): JugadorParaConteo {
  return {
    id: fila.id,
    numero: fila.numero,
    posicionNatural: fila.posicion_natural,
    disponibilidad: fila.disponibilidad,
    enPlantel: fila.en_plantel,
  };
}

/**
 * Cuenta las Alineaciones de una Votación (filas de `alineacion`) con los
 * Jugadores del Club (filas de `jugador`, con la Disponibilidad del momento
 * del conteo). Una fila ilegible cuenta como Alineación vacía (no cuenta).
 */
export function contarVotacion(
  filas: readonly FilaAlineacion[],
  jugadores: readonly FilaJugadorParaConteo[],
): ResultadoConteo {
  return soloAgregados(
    contar({
      alineaciones: filas.map(alineacionDesdeFila),
      jugadores: jugadores.map(jugadorParaConteoDesdeFila),
    }),
  );
}

/**
 * Copia del resultado con SOLO los campos agregados conocidos (lista blanca).
 * Usarla antes de devolver o guardar un resultado fuera del servidor: si el
 * Motor de Conteo sumara algún día un dato por Alineación, no se filtra.
 */
export function soloAgregados(resultado: ResultadoConteo): ResultadoConteo {
  if (resultado.vacio) return { vacio: true, alineacionesQueCuentan: 0 };
  return {
    vacio: false,
    alineacionesQueCuentan: resultado.alineacionesQueCuentan,
    esquemas: resultado.esquemas.map((e) => ({ esquema: e.esquema, votos: e.votos, porcentaje: e.porcentaje })),
    esquemaGanador: resultado.esquemaGanador,
    puestos: resultado.puestos.map((p) => ({
      puesto: p.puesto,
      totalVotos: p.totalVotos,
      candidatos: p.candidatos.map((c) => ({ jugadorId: c.jugadorId, votos: c.votos, porcentaje: c.porcentaje })),
    })),
    once: resultado.once.map((a) => ({ puesto: a.puesto, jugadorId: a.jugadorId, origen: a.origen, votos: a.votos })),
  };
}

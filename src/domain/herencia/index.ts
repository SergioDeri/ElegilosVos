/**
 * Herencia de Alineación (lógica pura).
 *
 * Al abrir la Votación de un Partido, cada Hincha arranca con su Alineación
 * MÁS RECIENTE del Club entre los Partidos anteriores no cancelados (en el
 * orden del Calendario), filtrada con `heredar` del Editor (sin los Jugadores
 * no Disponibles ni los que salieron del Plantel, conservando las horas
 * originales y la marca de Esquema elegido a mano). Esa Alineación heredada
 * cuenta como voto aunque el Hincha no entre (ADR-0002), por eso se
 * materializa en la base (ver `src/lib/herencia`).
 *
 * No alcanza con mirar solo el Partido inmediatamente anterior: si ese
 * Partido no tuvo Alineaciones (su Votación nunca abrió, `abre >= cierra`) o
 * el Hincha no tenía una ahí, igual tiene que heredar la última que guardó.
 * Los Partidos cancelados no cuentan (su Votación quedó anulada).
 *
 * - `votacionAHeredar`: qué Partido tiene la Votación abierta y de qué Partidos hereda.
 * - `alineacionesAHeredar`: qué Alineaciones hay que crear (idempotente).
 * - `jugadoresNoDisponibles`: para el aviso de la pantalla de armado.
 */
import { calcularVotaciones, type PartidoCalendario } from "@/domain/calendario";
import type { ClubId, Disponibilidad } from "@/domain/comun/tipos";
import { estaVacia, heredar, type Alineacion, type JugadorDelPlantel } from "@/domain/editor";
import { esquema, type PuestoId } from "@/domain/esquemas";

/** La Votación abierta de un Club y los Partidos de los que hereda. */
export interface VotacionAHeredar {
  /** Partido con la Votación abierta. */
  partidoId: string;
  /** Partido anterior del Club: el último no cancelado antes que él (el mismo "anterior" del Calendario). */
  anteriorId: string;
  /**
   * Todos los Partidos no cancelados del Club anteriores al abierto, del más
   * reciente al más antiguo (el primero es `anteriorId`).
   */
  partidosAnteriores: string[];
}

/**
 * La Votación abierta del Club en `ahora` y sus Partidos anteriores, o `null`
 * si no hay Votación abierta o si es el primer Partido (no cancelado) del Club.
 * `partidos` son todos los Partidos de UN Club, en cualquier orden.
 */
export function votacionAHeredar(partidos: readonly PartidoCalendario[], ahora: Date): VotacionAHeredar | null {
  // calcularVotaciones devuelve las Votaciones en el orden del Calendario.
  const votaciones = calcularVotaciones(partidos, ahora);
  const i = votaciones.findIndex((v) => v.estado === "abierta");
  if (i < 0) return null;
  const cancelados = new Set(partidos.filter((p) => p.estado === "cancelado").map((p) => p.id));
  const partidosAnteriores = votaciones
    .slice(0, i)
    .map((v) => v.partidoId)
    .filter((id) => !cancelados.has(id))
    .reverse();
  const [anteriorId] = partidosAnteriores;
  if (anteriorId === undefined) return null;
  return { partidoId: votaciones[i]!.partidoId, anteriorId, partidosAnteriores };
}

/** Alineación de un Hincha en un Partido anterior, con su Club Favorito de HOY. */
export interface AlineacionAnterior {
  hinchaId: string;
  /** Partido en el que la guardó. */
  partidoId: string;
  clubFavorito: ClubId | null;
  alineacion: Alineacion;
}

export interface EntradaHerencia {
  /** Club del Partido con la Votación abierta (y de los anteriores). */
  club: ClubId;
  /**
   * Partidos de los que se hereda, del más reciente al más antiguo
   * (`VotacionAHeredar.partidosAnteriores`). Las Alineaciones de otros
   * Partidos (cancelados, posteriores) se ignoran.
   */
  partidosAnteriores: readonly string[];
  /** Alineaciones guardadas en los Partidos anteriores (en cualquier orden; puede haber varias por Hincha). */
  anteriores: readonly AlineacionAnterior[];
  /** Hinchas que ya tienen Alineación para el Partido abierto (heredada o propia). */
  yaTienen: Iterable<string>;
  /** Jugadores del Club (incluidos no Disponibles y bajas), con su estado actual. */
  plantel: readonly JugadorDelPlantel[];
}

/** Una Alineación a crear para el Partido abierto. */
export interface Herencia {
  hinchaId: string;
  alineacion: Alineacion;
}

/**
 * Las Alineaciones heredadas que hay que crear para el Partido abierto:
 *
 * - una por Hincha: la de su Partido anterior más reciente en el que tenga
 *   Alineación, filtrada con `heredar` del Editor contra el Plantel actual
 *   (conserva horas y Esquema). Si esa queda vacía no se busca una más vieja:
 *   lo último que guardó es lo que quiso;
 * - **idempotente**: los Hinchas que ya tienen Alineación para el Partido
 *   abierto se saltean (nunca se pisa lo que hizo el Hincha);
 * - solo hereda un Hincha cuyo Club Favorito de hoy es el Club del Partido
 *   (si el Admin le cambió el Club, no arrastra la del otro Club);
 * - no crea Alineaciones vacías (sin Jugadores y sin Esquema elegido a mano):
 *   no serían voto y la pantalla arranca igual con la cancha vacía.
 */
export function alineacionesAHeredar(entrada: EntradaHerencia): Herencia[] {
  const yaTienen = new Set(entrada.yaTienen);
  const recencia = new Map(entrada.partidosAnteriores.map((id, i) => [id, i]));
  // Por Hincha, la Alineación del Partido más reciente (menor índice).
  const masReciente = new Map<string, { indice: number; anterior: AlineacionAnterior }>();
  for (const a of entrada.anteriores) {
    const indice = recencia.get(a.partidoId);
    if (indice === undefined || a.clubFavorito !== entrada.club || yaTienen.has(a.hinchaId)) continue;
    const actual = masReciente.get(a.hinchaId);
    if (!actual || indice < actual.indice) masReciente.set(a.hinchaId, { indice, anterior: a });
  }
  return [...masReciente.values()]
    .map(({ anterior: a }) => ({ hinchaId: a.hinchaId, alineacion: heredar(a.alineacion, entrada.plantel) }))
    .filter((h) => !estaVacia(h.alineacion));
}

/** Por qué un Jugador de la Alineación ya no cuenta: su Disponibilidad, o que salió del Plantel. */
export type MotivoNoDisponible = Exclude<Disponibilidad, "disponible"> | "fuera_del_plantel";

export interface JugadorNoDisponible {
  puesto: PuestoId;
  jugadorId: string;
  motivo: MotivoNoDisponible;
}

/**
 * Jugadores colocados en la Alineación que hoy no están Disponibles o que
 * salieron del Plantel (o que no figuran en `plantel`, que cuenta como baja),
 * en el orden de Puestos del Esquema. Para avisarle al Hincha que los reemplace.
 */
export function jugadoresNoDisponibles(
  alineacion: Alineacion,
  plantel: readonly JugadorDelPlantel[],
): JugadorNoDisponible[] {
  const porId = new Map(plantel.map((j) => [j.id, j]));
  return esquema(alineacion.esquema).puestos.flatMap(({ id: puesto }): JugadorNoDisponible[] => {
    const ocupado = alineacion.puestos[puesto];
    if (!ocupado) return [];
    const jugador = porId.get(ocupado.jugadorId);
    if (!jugador || !jugador.enPlantel) return [{ puesto, jugadorId: ocupado.jugadorId, motivo: "fuera_del_plantel" }];
    if (jugador.disponibilidad === "disponible") return [];
    return [{ puesto, jugadorId: ocupado.jugadorId, motivo: jugador.disponibilidad }];
  });
}

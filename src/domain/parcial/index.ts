/**
 * Parcial (ticket 11): cómo se muestra el resultado provisorio del Motor de
 * Conteo. Lógica pura: resuelve los ids de Jugadores con el Plantel y ubica el
 * 11 sobre la cancha con los Puestos del Esquema ganador.
 */
import type { OrigenAsignacion, ResultadoConteo } from "@/domain/conteo";
import { esquema, type EsquemaId, type PuestoId } from "@/domain/esquemas";

export interface JugadorParaMostrar {
  readonly id: string;
  readonly nombre: string;
  readonly numero: number;
}

export interface JugadorEnVista {
  readonly nombre: string;
  /** `null` si el Jugador no está en la lista recibida. */
  readonly numero: number | null;
}

export interface EsquemaEnVista {
  readonly esquema: EsquemaId;
  readonly votos: number;
  readonly porcentaje: number;
  readonly ganador: boolean;
}

export interface PuestoDelOnce {
  readonly puesto: PuestoId;
  readonly etiqueta: string;
  readonly sigla: string;
  /** Posición en la cancha (0..1), como en el catálogo de Esquemas. */
  readonly x: number;
  readonly y: number;
  /** `null` si el Puesto quedó vacante sin Jugador. */
  readonly jugador: JugadorEnVista | null;
  /** `vacante`: el Puesto no tenía votos asignables y se completó con otro Disponible (o quedó vacío). */
  readonly origen: OrigenAsignacion;
  /** Porcentaje de los votos del Puesto que tiene el Jugador asignado. */
  readonly porcentaje: number;
}

export interface CandidatoEnVista {
  readonly jugador: JugadorEnVista;
  readonly votos: number;
  readonly porcentaje: number;
}

export interface PuestoEnVista {
  readonly puesto: PuestoId;
  readonly etiqueta: string;
  readonly totalVotos: number;
  readonly candidatos: readonly CandidatoEnVista[];
}

export type VistaParcial =
  | { readonly vacio: true }
  | {
      readonly vacio: false;
      readonly alineacionesQueCuentan: number;
      readonly esquemaGanador: EsquemaId;
      readonly esquemas: readonly EsquemaEnVista[];
      readonly once: readonly PuestoDelOnce[];
      readonly puestos: readonly PuestoEnVista[];
    };

const DESCONOCIDO: JugadorEnVista = { nombre: "Jugador desconocido", numero: null };

export function vistaDelParcial(resultado: ResultadoConteo, jugadores: readonly JugadorParaMostrar[]): VistaParcial {
  if (resultado.vacio) return { vacio: true };
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  const mostrar = (id: string): JugadorEnVista => {
    const j = porId.get(id);
    return j ? { nombre: j.nombre, numero: j.numero } : DESCONOCIDO;
  };
  const puestosDelEsquema = new Map(esquema(resultado.esquemaGanador).puestos.map((p) => [p.id, p]));
  const votosDe = new Map(resultado.puestos.map((p) => [p.puesto, p]));

  return {
    vacio: false,
    alineacionesQueCuentan: resultado.alineacionesQueCuentan,
    esquemaGanador: resultado.esquemaGanador,
    esquemas: resultado.esquemas.map((e) => ({
      esquema: e.esquema,
      votos: e.votos,
      porcentaje: e.porcentaje,
      ganador: e.esquema === resultado.esquemaGanador,
    })),
    once: resultado.once.map((a) => {
      const p = puestosDelEsquema.get(a.puesto)!;
      const candidato = votosDe.get(a.puesto)?.candidatos.find((c) => c.jugadorId === a.jugadorId);
      return {
        puesto: a.puesto,
        etiqueta: p.etiqueta,
        sigla: p.sigla,
        x: p.x,
        y: p.y,
        jugador: a.jugadorId === null ? null : mostrar(a.jugadorId),
        origen: a.origen,
        porcentaje: candidato?.porcentaje ?? 0,
      };
    }),
    puestos: resultado.puestos.map((p) => ({
      puesto: p.puesto,
      etiqueta: puestosDelEsquema.get(p.puesto)!.etiqueta,
      totalVotos: p.totalVotos,
      candidatos: p.candidatos.map((c) => ({ jugador: mostrar(c.jugadorId), votos: c.votos, porcentaje: c.porcentaje })),
    })),
  };
}

/** "66,7 %", "100 %": un decimal (si no es entero), con coma. */
export function formatearPorcentaje(porcentaje: number): string {
  const redondeado = Math.round(porcentaje * 10) / 10;
  const texto = Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(1).replace(".", ",");
  return `${texto} %`;
}

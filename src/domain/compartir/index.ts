/**
 * Compartir (ticket 16): el modelo de la imagen que se comparte en redes, de
 * la Alineación del Hincha ("Mi 11") o del 11 Elegido. Lógica pura: arma los
 * textos y ubica a cada Jugador en su Puesto sobre la cancha; el dibujo lo
 * hace el servidor con ese modelo. No lleva datos de Hinchas.
 *
 * Sin horas de Montevideo: la fecha llega ya formateada desde el borde
 * (`@/lib/compartir/fecha`), como pide la regla de horas de docs/DESARROLLO.md.
 */
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import type { ClubId } from "@/domain/comun/tipos";
import { esquema, type EsquemaId, type PuestoId } from "@/domain/esquemas";
import { nombreCorto } from "@/domain/planteles";

export type TipoImagen = "mi_alineacion" | "once_elegido";

export interface JugadorParaImagen {
  readonly id: string;
  readonly nombre: string;
  readonly numero: number;
}

export interface EntradaImagen {
  readonly tipo: TipoImagen;
  readonly club: ClubId;
  readonly rival: string;
  /** Inicio del Partido ya formateado para mostrar (lo arma el borde, en hora de Montevideo). */
  readonly fecha: string;
  /** Día del Partido "YYYY-MM-DD" (en hora de Montevideo), para el nombre del archivo. */
  readonly dia: string;
  readonly esquema: EsquemaId;
  /** Jugador por Puesto (las de Puestos que no son del Esquema se ignoran). */
  readonly asignaciones: readonly { readonly puesto: string; readonly jugadorId: string | null }[];
  readonly jugadores: readonly JugadorParaImagen[];
}

export interface PuestoEnImagen {
  readonly puesto: PuestoId;
  readonly sigla: string;
  /** Posición horizontal en la cancha (0 izquierda .. 1 derecha). */
  readonly x: number;
  /** Posición vertical desde arriba (0 arco rival .. 1 arco propio). */
  readonly yDesdeArriba: number;
  /** Nombre para mostrar (ya acortado), o null si el Puesto quedó vacante. */
  readonly nombre: string | null;
  readonly numero: number | null;
}

export interface ModeloImagen {
  readonly titulo: string;
  readonly club: string;
  readonly rival: string;
  /** "Peñarol vs Nacional". */
  readonly partido: string;
  /** Inicio del Partido en hora de Montevideo. */
  readonly fecha: string;
  readonly esquema: string;
  readonly puestos: readonly PuestoEnImagen[];
  readonly nombreArchivo: string;
  readonly alt: string;
}

/** Caracteres que entran en el rótulo de un Jugador sobre la cancha. */
export const LARGO_MAXIMO_NOMBRE = 14;
/** Caracteres que entran del nombre del Rival en el encabezado. */
export const LARGO_MAXIMO_RIVAL = 30;

const TITULO: Record<TipoImagen, string> = {
  mi_alineacion: "Mi 11",
  once_elegido: "El 11 Elegido por la hinchada",
};

const PREFIJO_ARCHIVO: Record<TipoImagen, string> = {
  mi_alineacion: "mi-11",
  once_elegido: "11-elegido",
};

function cortar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo - 1).trimEnd()}…`;
}

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function modeloDeImagen(entrada: EntradaImagen): ModeloImagen {
  const jugadores = new Map(entrada.jugadores.map((j) => [j.id, j]));
  const porPuesto = new Map(entrada.asignaciones.map((a) => [a.puesto, a.jugadorId]));
  const definicion = esquema(entrada.esquema);
  const club = NOMBRE_CLUB[entrada.club];
  const rival = cortar(entrada.rival.trim().replace(/\s+/g, " "), LARGO_MAXIMO_RIVAL);
  const partido = `${club} vs ${rival}`;

  return {
    titulo: TITULO[entrada.tipo],
    club,
    rival,
    partido,
    fecha: entrada.fecha,
    esquema: definicion.nombre,
    puestos: definicion.puestos.map((p) => {
      const id = porPuesto.get(p.id);
      const jugador = id ? jugadores.get(id) : undefined;
      return {
        puesto: p.id,
        sigla: p.sigla,
        x: p.x,
        yDesdeArriba: 1 - p.y,
        nombre: jugador ? nombreCorto(jugador.nombre, LARGO_MAXIMO_NOMBRE) : null,
        numero: jugador?.numero ?? null,
      };
    }),
    nombreArchivo: `${PREFIJO_ARCHIVO[entrada.tipo]}-${slug(partido)}-${entrada.dia}.png`,
    alt: `${TITULO[entrada.tipo]} de ${partido} en ${definicion.nombre}`,
  };
}

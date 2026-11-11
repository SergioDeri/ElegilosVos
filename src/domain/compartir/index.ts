/**
 * Compartir (ticket 16): el modelo de la imagen que se comparte en redes, de
 * la Alineación del Hincha ("Mi 11") o del 11 Elegido. Lógica pura: arma los
 * textos y ubica a cada Jugador en su Puesto sobre la cancha; el dibujo lo
 * hace el servidor con ese modelo. No lleva datos de Hinchas.
 *
 * En la Selección (Selección, ticket 12) el rótulo es el nombre completo,
 * sin número y nunca cortado (en dos renglones si no entra en uno), y el 11
 * Elegido lleva el destacado: el Gran Ausente final, o el Más Pedido mientras
 * no hay Convocatoria. Los Clubes no cambian.
 *
 * Sin horas de Montevideo: la fecha llega ya formateada desde el borde
 * (`@/lib/compartir/fecha`), como pide la regla de horas de docs/DESARROLLO.md.
 */
import { nombreDeClubOSeleccion } from "@/domain/comun/textos";
import { SELECCION, type ClubOSeleccion } from "@/domain/comun/tipos";
import type { Destacado, TipoDestacado } from "@/domain/destacados";
import { esquema, type EsquemaId, type PuestoId } from "@/domain/esquemas";
import { formatearPorcentaje } from "@/domain/parcial";
import { nombreCorto } from "@/domain/planteles";

export type TipoImagen = "mi_alineacion" | "once_elegido";

export interface JugadorParaImagen {
  readonly id: string;
  readonly nombre: string;
  /** null en la Selección, que no lleva número. */
  readonly numero: number | null;
}

export interface EntradaImagen {
  readonly tipo: TipoImagen;
  readonly club: ClubOSeleccion;
  readonly rival: string;
  /** Inicio del Partido ya formateado para mostrar (lo arma el borde, en hora de Montevideo). */
  readonly fecha: string;
  /** Día del Partido "YYYY-MM-DD" (en hora de Montevideo), para el nombre del archivo. */
  readonly dia: string;
  readonly esquema: EsquemaId;
  /** Jugador por Puesto (las de Puestos que no son del Esquema se ignoran). */
  readonly asignaciones: readonly { readonly puesto: string; readonly jugadorId: string | null }[];
  /** Los del 11 y, si hay destacado, también los destacados (pueden no estar en el 11). */
  readonly jugadores: readonly JugadorParaImagen[];
  /**
   * Solo el 11 Elegido de la Selección: el Gran Ausente final o, sin
   * Convocatoria, el Más Pedido (`destacado(apariciones, convocados)` de
   * `@/domain/destacados`). En los Clubes y en Mi 11 se ignora.
   */
  readonly destacado?: Destacado | null;
}

export interface PuestoEnImagen {
  readonly puesto: PuestoId;
  readonly sigla: string;
  /** Posición horizontal en la cancha (0 izquierda .. 1 derecha). */
  readonly x: number;
  /** Posición vertical desde arriba (0 arco rival .. 1 arco propio). */
  readonly yDesdeArriba: number;
  /** Nombre para mostrar (en un Club, ya acortado; en la Selección, completo), o null si el Puesto quedó vacante. */
  readonly nombre: string | null;
  /**
   * El nombre como se dibuja: un renglón en los Clubes; en la Selección uno o
   * dos (cortado entre palabras, nunca acortado). Vacío si quedó vacante.
   */
  readonly renglones: readonly string[];
  readonly numero: number | null;
}

export interface DestacadoEnImagen {
  /** "Gran Ausente final" o "Más Pedido". */
  readonly titulo: string;
  /** Nombre completo y porcentaje ("66,7 %"); con empate, todos, por nombre. */
  readonly jugadores: readonly { readonly nombre: string; readonly porcentaje: string }[];
}

export interface ModeloImagen {
  readonly titulo: string;
  /** Dueño del Partido: elige las Camisetas y el escudo del dibujo. */
  readonly clubId: ClubOSeleccion;
  readonly club: string;
  readonly rival: string;
  /** "Peñarol vs Nacional". */
  readonly partido: string;
  /** Inicio del Partido en hora de Montevideo. */
  readonly fecha: string;
  readonly esquema: string;
  readonly puestos: readonly PuestoEnImagen[];
  /** Solo en el 11 Elegido de la Selección; null si no hay. */
  readonly destacado: DestacadoEnImagen | null;
  readonly nombreArchivo: string;
  readonly alt: string;
}

/** Caracteres que entran en el rótulo de un Jugador sobre la cancha. */
export const LARGO_MAXIMO_NOMBRE = 14;
/**
 * Caracteres que entran en cada renglón del rótulo en la Selección (son dos):
 * alcanza para nombres reales como "Giorgian De Arrascaeta" o "Rodrigo
 * Bentancur Colmán". Una palabra más larga no se corta: sobresale.
 */
export const LARGO_MAXIMO_RENGLON_SELECCION = 16;
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

const TITULO_DESTACADO: Record<TipoDestacado, string> = {
  gran_ausente: "Gran Ausente final",
  mas_pedido: "Más Pedido",
};

function normalizar(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ");
}

/**
 * El nombre completo en uno o dos renglones de hasta `maximo` caracteres,
 * cortando entre palabras donde el renglón más largo quede más corto. Nunca
 * se acorta: la imagen tiene lugar (la cancha, en cambio, usa
 * `rotuloCompleto` de `@/domain/cancha`, que sí acorta para no salir de la caja).
 */
export function renglonesDelNombre(nombre: string, maximo: number = LARGO_MAXIMO_RENGLON_SELECCION): string[] {
  const completo = normalizar(nombre);
  const palabras = completo.split(" ");
  if (palabras.length === 1 || completo.length <= maximo) return [completo];
  let mejor: string[] = [];
  for (let i = 1; i < palabras.length; i++) {
    const candidata = [palabras.slice(0, i).join(" "), palabras.slice(i).join(" ")];
    if (!mejor.length || Math.max(...candidata.map((r) => r.length)) < Math.max(...mejor.map((r) => r.length))) mejor = candidata;
  }
  return mejor;
}

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
  const seleccion = entrada.club === SELECCION;
  const club = nombreDeClubOSeleccion(entrada.club);
  const rival = cortar(entrada.rival.trim().replace(/\s+/g, " "), LARGO_MAXIMO_RIVAL);
  const partido = `${club} vs ${rival}`;

  return {
    titulo: TITULO[entrada.tipo],
    clubId: entrada.club,
    club,
    rival,
    partido,
    fecha: entrada.fecha,
    esquema: definicion.nombre,
    puestos: definicion.puestos.map((p) => {
      const id = porPuesto.get(p.id);
      const jugador = id ? jugadores.get(id) : undefined;
      const nombre = jugador ? (seleccion ? normalizar(jugador.nombre) : nombreCorto(jugador.nombre, LARGO_MAXIMO_NOMBRE)) : null;
      return {
        puesto: p.id,
        sigla: p.sigla,
        x: p.x,
        yDesdeArriba: 1 - p.y,
        nombre,
        renglones: nombre === null ? [] : seleccion ? renglonesDelNombre(nombre) : [nombre],
        numero: seleccion ? null : (jugador?.numero ?? null),
      };
    }),
    destacado:
      seleccion && entrada.tipo === "once_elegido" && entrada.destacado
        ? destacadoEnImagen(entrada.destacado, jugadores)
        : null,
    nombreArchivo: `${PREFIJO_ARCHIVO[entrada.tipo]}-${slug(partido)}-${entrada.dia}.png`,
    alt: `${TITULO[entrada.tipo]} de ${partido} en ${definicion.nombre}`,
  };
}

function destacadoEnImagen(destacado: Destacado, jugadores: ReadonlyMap<string, JugadorParaImagen>): DestacadoEnImagen {
  return {
    titulo: TITULO_DESTACADO[destacado.tipo],
    jugadores: destacado.jugadores
      .map((d) => ({
        nombre: normalizar(jugadores.get(d.jugadorId)?.nombre ?? "Jugador"),
        porcentaje: formatearPorcentaje(d.porcentaje),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}

// Arte pixel (spec .scratch/diseno-pixel-art, ADR 0004). Lógica pura: la
// paleta única, los temas por Club, la unidad --px y el texto bitmap. Los
// sprites son matrices de colores de la paleta; quien los dibuja (React, CSS)
// vive en la app.
import { CLUBES, type ClubId } from "@/domain/comun/tipos";

// -----------------------------------------------------------------------------
// Paleta: única fuente de colores del arte (16 bits, vivos)
// -----------------------------------------------------------------------------

export const PALETA = {
  contorno: "#14121c",
  negroSombra: "#1c1a24",
  negro: "#2a2733",
  negroLuz: "#433f4f",
  amarilloLuz: "#ffe45c",
  amarillo: "#f5c400",
  amarilloSombra: "#c08a00",
  blancoLuz: "#ffffff",
  blanco: "#e4e8ef",
  blancoSombra: "#aab3c2",
  azulLuz: "#4b8ff0",
  azul: "#1f5fc8",
  azulSombra: "#143f8a",
  rojoLuz: "#ff5b5b",
  rojo: "#d8282f",
  rojoSombra: "#8f1a22",
  cespedLuz: "#56b244",
  cesped: "#46a03a",
  cespedSombra: "#3a8c33",
  cespedOscuro: "#2a6e2a",
  cal: "#f4f4ec",
  gris: "#8a8f9c",
  grisOscuro: "#4a4f5c",
  fondo: "#10241a",
} as const;

export type ColorPaleta = keyof typeof PALETA;

/** Fila por fila; null es transparente. */
export type Matriz = (string | null)[][];

// -----------------------------------------------------------------------------
// Temas: base neutra (verde cancha) con acentos del Club Favorito
// -----------------------------------------------------------------------------

export interface Tema {
  /** Fondo del botón principal y del encabezado. */
  acento: ColorPaleta;
  /** Texto sobre el acento. */
  acentoTinta: ColorPaleta;
  /** Sombra (borde inferior) del acento. */
  acentoSombra: ColorPaleta;
  /** Segundo color del Club, para detalles. */
  detalle: ColorPaleta;
  /** Enlaces y foco sobre el fondo oscuro. */
  enlace: ColorPaleta;
}

export type NombreTema = ClubId | "neutro";

export const TEMAS: Record<NombreTema, Tema> = {
  neutro: { acento: "cesped", acentoTinta: "cal", acentoSombra: "cespedOscuro", detalle: "cespedLuz", enlace: "cespedLuz" },
  penarol: { acento: "amarillo", acentoTinta: "contorno", acentoSombra: "amarilloSombra", detalle: "negro", enlace: "amarilloLuz" },
  nacional: { acento: "azul", acentoTinta: "blancoLuz", acentoSombra: "azulSombra", detalle: "rojo", enlace: "azulLuz" },
};

/** Tema del Hincha: el de su Club Favorito, o el neutro si todavía no eligió. */
export function temaDe(club: ClubId | null): NombreTema {
  return club ?? "neutro";
}

/** Color de la barra del sistema (PWA) para un tema. */
export function colorDeSistema(tema: NombreTema): string {
  return PALETA[TEMAS[tema].acentoSombra];
}

function variablesDeTema(tema: Tema): string {
  return [
    `--acento: var(--color-${tema.acento});`,
    `--acento-tinta: var(--color-${tema.acentoTinta});`,
    `--acento-sombra: var(--color-${tema.acentoSombra});`,
    `--detalle: var(--color-${tema.detalle});`,
    `--enlace: var(--color-${tema.enlace});`,
  ].join(" ");
}

/**
 * CSS con cada color de la paleta como `--color-<nombre>` y los acentos del
 * tema: neutro en `:root`, y por Club bajo `[data-club="<club>"]`.
 */
export function cssDeLaPaleta(): string {
  const colores = Object.entries(PALETA)
    .map(([nombre, hex]) => `--color-${nombre}: ${hex};`)
    .join(" ");
  const porClub = CLUBES.map((club) => `[data-club="${club}"] { ${variablesDeTema(TEMAS[club])} }`)
    .join("\n");
  return `:root { ${colores} ${variablesDeTema(TEMAS.neutro)} }\n${porClub}`;
}

// -----------------------------------------------------------------------------
// --px: 1 píxel de arte = --px píxeles CSS, siempre entero
// -----------------------------------------------------------------------------

/** Píxeles de arte mínimos que tiene que tener el lado corto de la pantalla. */
export const LADO_CORTO_MINIMO = 220;
export const PX_MINIMO = 2;
export const PX_MAXIMO = 4;

/**
 * --px según la ventana (en px CSS): depende del lado corto, para que la
 * cancha tenga siempre alto suficiente. cssDeLaGrilla genera las media
 * queries equivalentes para el CSS.
 */
export function pxPara(ancho: number, alto: number): number {
  const porLadoCorto = Math.floor(Math.min(ancho, alto) / LADO_CORTO_MINIMO);
  return Math.min(PX_MAXIMO, Math.max(PX_MINIMO, porLadoCorto));
}

/**
 * CSS de `--px` (número) y `--u` (1 píxel de arte en px CSS) con media
 * queries equivalentes a pxPara: el lado corto llega a n × LADO_CORTO_MINIMO.
 */
export function cssDeLaGrilla(): string {
  const reglas = [`:root { --px: ${PX_MINIMO}; --u: calc(var(--px) * 1px); }`];
  for (let n = PX_MINIMO + 1; n <= PX_MAXIMO; n++) {
    const desde = n * LADO_CORTO_MINIMO;
    reglas.push(`@media (min-width: ${desde}px) and (min-height: ${desde}px) { :root { --px: ${n}; } }`);
  }
  return reglas.join("\n");
}

// -----------------------------------------------------------------------------
// Texto bitmap: mayúsculas 3x5 (M y W de 5), fila extra arriba para tildes y Ñ
// -----------------------------------------------------------------------------

const GLIFOS: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", "###", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", "..#", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
  ".": ["...", "...", "...", "...", ".#."],
  "-": ["...", "...", "###", "...", "..."],
  "·": ["...", "...", ".#.", "...", "..."],
  " ": ["...", "...", "...", "...", "..."],
};

const ACENTO = ".##";
const TILDE_ENIE = "###";
const CON_DIACRITICO: Record<string, [string, string]> = {
  Á: ["A", ACENTO],
  É: ["E", ACENTO],
  Í: ["I", ACENTO],
  Ó: ["O", ACENTO],
  Ú: ["U", ACENTO],
  Ü: ["U", "#.#"],
  Ñ: ["N", TILDE_ENIE],
};

/** Las 6 filas del glifo: diacrítico (o vacía) + 5. */
function glifo(caracter: string): string[] {
  const conDiacritico = CON_DIACRITICO[caracter];
  const base = GLIFOS[conDiacritico ? conDiacritico[0] : caracter] ?? GLIFOS[" "];
  const ancho = base[0].length;
  const arriba = conDiacritico ? conDiacritico[1] : ".".repeat(ancho);
  return [arriba, ...base];
}

function glifos(texto: string): string[][] {
  return [...texto.toUpperCase()].map(glifo);
}

/** Ancho del texto en píxeles de arte, sin contorno. */
export function anchoTexto(texto: string): number {
  const gs = glifos(texto);
  if (gs.length === 0) return 0;
  return gs.reduce((total, g) => total + g[0].length, 0) + gs.length - 1;
}

export const ALTO_TEXTO = 6;

/**
 * El texto en mayúsculas como matriz de ALTO_TEXTO filas (más 2 con
 * contorno, que es de 1 px en las 8 direcciones).
 */
export function textoBitmap(texto: string, color: ColorPaleta, opciones: { contorno?: boolean } = {}): Matriz {
  const borde = opciones.contorno ? 1 : 0;
  const ancho = anchoTexto(texto) + borde * 2;
  const alto = ALTO_TEXTO + borde * 2;
  const m: Matriz = Array.from({ length: alto }, () => Array<string | null>(ancho).fill(null));

  const encendidos: [number, number][] = [];
  let x0 = borde;
  for (const g of glifos(texto)) {
    g.forEach((fila, dy) => {
      [...fila].forEach((c, dx) => {
        if (c === "#") encendidos.push([x0 + dx, borde + dy]);
      });
    });
    x0 += g[0].length + 1;
  }

  if (borde)
    for (const [x, y] of encendidos)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m[y + dy][x + dx] = PALETA.contorno;
  for (const [x, y] of encendidos) m[y][x] = PALETA[color];
  return m;
}

// Escudos (spec .scratch/diseno-pixel-art, ticket 07). Lógica pura: el hueco
// pixelado de "falta escudo", que se muestra mientras un Club o un Rival no
// tiene escudo cargado. Mide lo mismo que un escudo (48x48). La validación del
// archivo de un escudo está en @/domain/planteles (validarEscudo).
import { LADO_ESCUDO } from "@/domain/planteles";
import { PALETA, type Matriz } from "@/domain/pixel";

/** Media anchura de la silueta en la fila `y` (sin contar el contorno), o -1 si la fila va vacía. */
function mediaAnchura(y: number): number {
  const ARRIBA = 3;
  const HOMBRO = 26;
  const ABAJO = 44;
  const MAXIMA = 19;
  if (y < ARRIBA || y > ABAJO) return -1;
  if (y <= HOMBRO) return MAXIMA;
  // Debajo del hombro, la silueta se cierra en punta (cuarto de elipse).
  const t = (y - HOMBRO) / (ABAJO - HOMBRO);
  return Math.round(MAXIMA * Math.sqrt(1 - t * t));
}

// Signo de pregunta de 5x7, que se dibuja al doble (10x14).
const PREGUNTA = [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."];

/**
 * Matriz 48x48 del hueco "falta escudo": silueta de escudo con contorno,
 * borde interior en sombra, fondo gris oscuro y un signo de pregunta.
 * Siempre la misma.
 */
export function faltaEscudo(): Matriz {
  const lado = LADO_ESCUDO;
  const centro = (lado - 1) / 2;
  const adentro = (x: number, y: number) => {
    const hw = mediaAnchura(y);
    return hw >= 0 && Math.abs(x - centro) <= hw + 0.5;
  };
  const m: Matriz = Array.from({ length: lado }, (_, y) =>
    Array.from({ length: lado }, (_, x) => (adentro(x, y) ? PALETA.grisOscuro : null)),
  );

  // Contorno: las celdas de la silueta que tocan el vacío.
  const enBorde = (x: number, y: number) =>
    adentro(x, y) && (!adentro(x - 1, y) || !adentro(x + 1, y) || !adentro(x, y - 1) || !adentro(x, y + 1));
  // Borde interior en sombra: el escudo se ve hundido, como un hueco.
  const junto = (x: number, y: number) =>
    adentro(x, y) && !enBorde(x, y) && (enBorde(x - 1, y) || enBorde(x + 1, y) || enBorde(x, y - 1) || enBorde(x, y + 1));

  for (let y = 0; y < lado; y++)
    for (let x = 0; x < lado; x++) {
      if (enBorde(x, y)) m[y][x] = PALETA.contorno;
      else if (junto(x, y)) m[y][x] = PALETA.negro;
    }

  // Signo de pregunta al doble, centrado.
  const ancho = PREGUNTA[0].length * 2;
  const x0 = Math.floor((lado - ancho) / 2);
  const y0 = 13;
  PREGUNTA.forEach((fila, dy) =>
    [...fila].forEach((c, dx) => {
      if (c !== "#") return;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) m[y0 + dy * 2 + sy][x0 + dx * 2 + sx] = PALETA.gris;
    }),
  );
  return m;
}

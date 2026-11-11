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

// -----------------------------------------------------------------------------
// Escudo de la Selección (AUF)
// -----------------------------------------------------------------------------

// Dibujo 48x48 del escudo de la AUF, pasado a pixel art desde el escudo que
// aprobó el dueño del producto. Una letra por píxel:
// . transparente · o contorno · 4/5/6 dorado (sombra/medio/luz) · 9 blanco
// h celeste · r rojo.
const DIBUJO_SELECCION = [
  ".......oooooooooooooooooooooooooooooooooo.......",
  "......oo55555555555555555555555555555555oo......",
  ".....oo5555555555555555555555555555555555oo.....",
  ".....o55oooooooooooooooooooooooooooooooo55o.....",
  ".....o55ohhhhhhhhhhhhhhhhhhhhhhhhhhhhhho55o.....",
  ".....o55oh999o999999o999999o999999o999ho55o.....",
  ".....o55oh99o5o9999o5o9999o5o9999o5o99ho55o.....",
  ".....o55oh9o555o99o555o99o555o99o555o9ho55o.....",
  ".....o55oho55555oo55555oo55555oo55555oho55o.....",
  ".....o55oh9o555o99o555o99o555o99o555o9ho55o.....",
  ".....o55oh9o5o5o99o5o5o99o5o5o99o5o5o9ho55o.....",
  ".....o55oh99o9o9999o9o9999o9o9999o9o99ho55o.....",
  ".....o55oh999h99999oo999999oo99999h999ho55o.....",
  ".....o55oh99h6h9999o6oo99oo4o9999h6h99ho55o.....",
  ".....o55oh9h565h999o65rrrr54o999h565h9ho55o.....",
  ".....o55oh9h555h999o6rr55rr4o999h555h9ho55o.....",
  ".....o55ohh5o5o5h99o6rrrrrr4o99h5o5o5hho55o.....",
  ".....o55oh9h555h999o6rr55rr4o999h555h9ho55o.....",
  ".....o55ohh5o5o5h99o6rr55rr4o99h5o5o5hho55o.....",
  ".....o55oh9h555h999o65555554o999h555h9ho55o.....",
  ".....o55ohh5o5o5h99o6rr55rr4o99h5o5o5hho55o.....",
  ".....o55oh9h555h999o6rr55rr4o999h555h9ho55o.....",
  ".....o55ohh5o5o5h99o6rr55rr4o99h5o5o5hho55o.....",
  ".....o55oh9h555h999o6rr55rr4o999h555h9ho55o.....",
  ".....o55ohh5o5o5h99o65rrrr54o99h5o5o5hho55o.....",
  ".....o55oh9h454h999o65555554o999h454h9ho55o.....",
  ".....o55oh99h4h9999o6rrrrrr4o9999h4h99ho55o.....",
  ".....o55oh99h4h9999o6rr55554o9999h4h99ho55o.....",
  ".....o55oh999h99999o6rrrrr54o99999h999ho55o.....",
  ".....o55oh999999999o6rr55554o999999999ho55o.....",
  ".....o55ooh99999999o6rr55554o99999999hoo55o.....",
  ".....oo55ohooooooooooooooooooooooooooho55oo.....",
  "......o55ohhhhhhhhhhhhhoohhhhhhhhhhhhho55o......",
  "......o55oh9999999999oo99oo9999999999ho55o......",
  "......o55oohhhhhhhhho999999ohhhhhhhhhoo55o......",
  "......oo55oh99999999o99oo99o99999999ho55oo......",
  ".......o55oohooooooo99oooo99ooooooohoo55o.......",
  ".......oo55ooho9999o999oo999o9999ohoo55oo.......",
  "........oo55oohh999oo999999oo999hhoo55oo........",
  ".........oo55ooohh9oo999999oo9hhooo55oo.........",
  "..........oo555ooohh6oo99oo4hhooo555oo..........",
  "...........oo5555ooohh9oo9hhooo5555oo...........",
  "............ooo5555ooohhhhooo5555ooo............",
  "..............ooo5555oooooo5555ooo..............",
  "................ooo5555oo5555ooo................",
  "..................ooo555555ooo..................",
  "....................ooo55ooo....................",
  "......................oooo......................",
];

const COLOR_DEL_DIBUJO: Record<string, string | null> = {
  ".": null,
  o: PALETA.contorno,
  "4": PALETA.amarilloSombra,
  "5": PALETA.amarillo,
  "6": PALETA.amarilloLuz,
  "9": PALETA.blancoLuz,
  h: PALETA.celeste,
  r: PALETA.rojo,
};

/**
 * Matriz 48x48 del escudo de la Selección (AUF): ribete dorado, cuatro
 * estrellas, la banda dorada con las letras AUF en rojo entre dos espigas,
 * la franja celeste y blanca y la pelota. Es el PNG que el Admin sube como
 * escudo de la Selección (`pngDeMatriz`), con la misma validación que los
 * escudos de los Clubes.
 */
export function escudoDeLaSeleccion(): Matriz {
  return DIBUJO_SELECCION.map((fila) => [...fila].map((letra) => COLOR_DEL_DIBUJO[letra]));
}

// -----------------------------------------------------------------------------
// PNG de una Matriz (RGBA de 8 bits, sin comprimir: para 48x48 sobra)
// -----------------------------------------------------------------------------

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const x of bytes) {
    a = (a + x) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function uint32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function chunk(tipo: string, datos: Uint8Array): number[] {
  const tipoYDatos = new Uint8Array([...[...tipo].map((c) => c.charCodeAt(0)), ...datos]);
  return [...uint32(datos.length), ...tipoYDatos, ...uint32(crc(tipoYDatos))];
}

/** zlib con bloques deflate "stored" (sin compresión), de hasta 65535 bytes. */
function zlibSinComprimir(datos: Uint8Array): Uint8Array {
  const salida = [0x78, 0x01];
  const BLOQUE = 0xffff;
  for (let i = 0; i === 0 || i < datos.length; i += BLOQUE) {
    const parte = datos.subarray(i, i + BLOQUE);
    const ultimo = i + BLOQUE >= datos.length ? 1 : 0;
    salida.push(ultimo, parte.length & 0xff, parte.length >>> 8, ~parte.length & 0xff, (~parte.length >>> 8) & 0xff, ...parte);
  }
  salida.push(...uint32(adler32(datos)));
  return new Uint8Array(salida);
}

/**
 * La Matriz como archivo PNG (RGBA; null es transparente). Sirve para generar
 * el PNG de un escudo dibujado en código, como el de la Selección.
 */
export function pngDeMatriz(m: Matriz): Uint8Array {
  const alto = m.length;
  const ancho = m[0]?.length ?? 0;
  const crudo = new Uint8Array(alto * (1 + ancho * 4));
  m.forEach((fila, y) => {
    const inicio = y * (1 + ancho * 4); // byte 0 de cada fila: filtro 0 (ninguno)
    fila.forEach((c, x) => {
      if (c === null) return;
      const i = inicio + 1 + x * 4;
      crudo.set([parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255], i);
    });
  });
  const ihdr = new Uint8Array([...uint32(ancho), ...uint32(alto), 8, 6, 0, 0, 0]);
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk("IHDR", ihdr),
    ...chunk("IDAT", zlibSinComprimir(crudo)),
    ...chunk("IEND", new Uint8Array()),
  ]);
}

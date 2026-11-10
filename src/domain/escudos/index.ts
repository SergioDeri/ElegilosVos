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

// Estrella de 5x5 (con contorno ocupa 7x7). Van cuatro arriba del escudo.
const ESTRELLA = ["..#..", ".###.", "#####", ".###.", ".#.#."];
/** Columna izquierda (con contorno) de cada estrella: simétricas respecto del centro. */
const COLUMNAS_ESTRELLAS = [6, 15, 26, 35];

// Letras AUF de 3x5, que se dibujan al doble (6x10).
const AUF = [
  [".#.", "#.#", "###", "#.#", "#.#"],
  ["#.#", "#.#", "#.#", "#.#", "###"],
  ["###", "#..", "##.", "#..", "#.."],
];

/**
 * Matriz 48x48 del escudo de la Selección: cuatro estrellas doradas arriba y
 * un escudo celeste con ribete blanco, el Sol de Mayo y las letras AUF. Es el
 * PNG que el Admin sube como escudo de la Selección (`pngDeMatriz`), con la
 * misma validación que los escudos de los Clubes.
 */
export function escudoDeLaSeleccion(): Matriz {
  const lado = LADO_ESCUDO;
  const centro = (lado - 1) / 2;
  const m: Matriz = Array.from({ length: lado }, () => Array<string | null>(lado).fill(null));

  // Silueta: recta hasta el hombro y en punta abajo (cuarto de elipse).
  const ARRIBA = 9;
  const HOMBRO = 27;
  const ABAJO = 47;
  const MAXIMA = 19;
  const mediaAnchura = (y: number) => {
    if (y < ARRIBA || y > ABAJO) return -1;
    if (y <= HOMBRO) return MAXIMA;
    const t = (y - HOMBRO) / (ABAJO - HOMBRO);
    return Math.round(MAXIMA * Math.sqrt(1 - t * t));
  };
  const adentro = (x: number, y: number) => {
    const hw = mediaAnchura(y);
    return hw >= 0 && Math.abs(x - centro) <= hw + 0.5;
  };
  const enBorde = (x: number, y: number) =>
    adentro(x, y) && (!adentro(x - 1, y) || !adentro(x + 1, y) || !adentro(x, y - 1) || !adentro(x, y + 1));
  const ribete = (x: number, y: number) =>
    adentro(x, y) && !enBorde(x, y) && (enBorde(x - 1, y) || enBorde(x + 1, y) || enBorde(x, y - 1) || enBorde(x, y + 1));

  for (let y = 0; y < lado; y++)
    for (let x = 0; x < lado; x++) {
      if (!adentro(x, y)) continue;
      if (enBorde(x, y)) m[y][x] = PALETA.contorno;
      else if (ribete(x, y)) m[y][x] = PALETA.blanco;
      // Celeste con luz arriba y sombra en la punta.
      else m[y][x] = y <= ARRIBA + 3 ? PALETA.celesteLuz : y >= 40 ? PALETA.celesteSombra : PALETA.celeste;
    }

  // Sol de Mayo: disco con borde en sombra y ocho rayos.
  const SOL_Y = 19.5;
  const RADIO = 4.2;
  for (let y = ARRIBA + 2; y <= HOMBRO; y++)
    for (let x = 0; x < lado; x++) {
      const dx = x - centro;
      const dy = y - SOL_Y;
      const d = Math.hypot(dx, dy);
      if (d <= RADIO - 1) m[y][x] = PALETA.amarilloLuz;
      else if (d <= RADIO) m[y][x] = PALETA.amarillo;
      else if (d <= RADIO + 3.6) {
        // Rayos: rectos (vertical y horizontal) y en diagonal.
        const recto = Math.abs(dx) < 1 || Math.abs(dy) < 1;
        const diagonal = Math.abs(Math.abs(dx) - Math.abs(dy)) < 1;
        if (recto || diagonal) m[y][x] = PALETA.amarillo;
      }
    }

  // Letras AUF en blanco, al doble y centradas.
  const anchoAuf = (AUF.length * 3 + AUF.length - 1) * 2;
  const xAuf = Math.round(centro - anchoAuf / 2 + 0.5);
  const Y_AUF = 30;
  AUF.forEach((letra, i) =>
    letra.forEach((fila, dy) =>
      [...fila].forEach((c, dx) => {
        if (c !== "#") return;
        for (let sy = 0; sy < 2; sy++)
          for (let sx = 0; sx < 2; sx++) m[Y_AUF + dy * 2 + sy][xAuf + (i * 4 + dx) * 2 + sx] = PALETA.blancoLuz;
      }),
    ),
  );

  // Cuatro estrellas doradas con contorno, arriba del escudo.
  for (const x0 of COLUMNAS_ESTRELLAS) {
    const encendidos: [number, number][] = [];
    ESTRELLA.forEach((fila, dy) => [...fila].forEach((c, dx) => c === "#" && encendidos.push([x0 + 1 + dx, 1 + dy])));
    for (const [x, y] of encendidos)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m[y + dy][x + dx] = PALETA.contorno;
    for (const [x, y] of encendidos) m[y][x] = PALETA.amarillo;
  }
  return m;
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

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { crc32, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CABECERA_ESCUDO, LADO_ESCUDO, validarEscudo } from "@/domain/planteles";
import { PALETA, type Matriz } from "@/domain/pixel";
import { escudoDeLaSeleccion, faltaEscudo, pngDeMatriz } from "./index";

const colores = new Set<string>(Object.values(PALETA));

describe("faltaEscudo", () => {
  const m = faltaEscudo();

  it("mide lo mismo que un escudo (48x48)", () => {
    expect(m).toHaveLength(LADO_ESCUDO);
    for (const fila of m) expect(fila).toHaveLength(LADO_ESCUDO);
  });

  it("usa solo colores de la paleta", () => {
    for (const fila of m) for (const c of fila) if (c !== null) expect(colores.has(c)).toBe(true);
  });

  it("es una silueta de escudo simétrica, con las esquinas transparentes", () => {
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) expect(m[y][47 - x] === null, `(${x},${y})`).toBe(m[y][x] === null);
    expect(m[0][0]).toBeNull();
    expect(m[47][0]).toBeNull();
    expect(m[47][47]).toBeNull();
    expect(m[24][24]).not.toBeNull();
  });

  it("tiene contorno: todo borde de la silueta es del color de contorno", () => {
    const vacio = (x: number, y: number) => m[y]?.[x] === undefined || m[y][x] === null;
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++)
        if (m[y][x] !== null && (vacio(x - 1, y) || vacio(x + 1, y) || vacio(x, y - 1) || vacio(x, y + 1)))
          expect(m[y][x], `(${x},${y})`).toBe(PALETA.contorno);
  });

  it("se ve vacío: adentro hay un signo de pregunta, sin los colores de los Clubes", () => {
    const usados = new Set(m.flat().filter((c) => c !== null));
    for (const color of [PALETA.amarillo, PALETA.azul, PALETA.rojo, PALETA.blanco]) expect(usados.has(color)).toBe(false);
    expect(usados.size).toBeGreaterThanOrEqual(3);
  });

  it("es siempre el mismo dibujo", () => {
    expect(faltaEscudo()).toEqual(m);
  });
});

describe("escudoDeLaSeleccion", () => {
  const m = escudoDeLaSeleccion();

  it("mide 48x48, usa solo colores de la paleta y su silueta es simétrica", () => {
    expect(m).toHaveLength(LADO_ESCUDO);
    for (const fila of m) expect(fila).toHaveLength(LADO_ESCUDO);
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++) {
        const c = m[y][x];
        if (c !== null) expect(colores.has(c), `(${x},${y})`).toBe(true);
        expect(m[y][47 - x] === null, `(${x},${y})`).toBe(c === null);
      }
  });

  it("es celeste, con el sol y las cuatro estrellas en dorado", () => {
    const cuenta = (color: string) => m.flat().filter((c) => c === color).length;
    const celeste = cuenta(PALETA.celesteLuz) + cuenta(PALETA.celeste) + cuenta(PALETA.celesteSombra);
    const otros = m.flat().filter((c) => c !== null).length - celeste;
    expect(celeste).toBeGreaterThan(otros);
    // Las estrellas: cuatro manchas doradas separadas en las filas de arriba del escudo.
    const arriba = m[3].map((c) => c === PALETA.amarillo);
    const manchas = arriba.filter((on, x) => on && !arriba[x - 1]).length;
    expect(manchas).toBe(4);
    // El sol, dorado, en el centro de la mitad de arriba.
    expect([PALETA.amarillo, PALETA.amarilloLuz]).toContain(m[19][23]);
  });

  it("se ve como el dibujo aprobado (si cambia, revisarlo con el dueño del producto)", () => {
    const letra = new Map<string, string>([
      [PALETA.contorno, "o"], [PALETA.blanco, "8"], [PALETA.blancoLuz, "9"],
      [PALETA.amarillo, "5"], [PALETA.amarilloLuz, "6"],
      [PALETA.celesteSombra, "g"], [PALETA.celeste, "h"], [PALETA.celesteLuz, "i"],
    ]);
    const dibujo = m.map((f) => f.map((c) => (c === null ? "." : (letra.get(c) ?? "?"))).join("")).join("\n");
    expect(dibujo).not.toContain("?");
    expect(dibujo).toMatchSnapshot();
  });

  it("como PNG pasa la validación de escudos", () => {
    const png = pngDeMatriz(m);
    expect(validarEscudo({ tamano: png.length, cabecera: png.subarray(0, CABECERA_ESCUDO) })).toEqual({ ok: true, tipo: "image/png", extension: "png" });
  });
});

describe("pngDeMatriz", () => {
  it("es un PNG válido (zlib y CRC correctos) con los mismos píxeles y transparencia", () => {
    const m: Matriz = [
      [PALETA.contorno, null],
      [PALETA.celeste, PALETA.amarillo],
    ];
    const png = Buffer.from(pngDeMatriz(m));
    const chunks: { tipo: string; datos: Buffer }[] = [];
    for (let i = 8; i < png.length; ) {
      const largo = png.readUInt32BE(i);
      const tipo = png.subarray(i + 4, i + 8).toString("ascii");
      const datos = png.subarray(i + 8, i + 8 + largo);
      expect(png.readUInt32BE(i + 8 + largo), tipo).toBe(crc32(png.subarray(i + 4, i + 8 + largo)) >>> 0);
      chunks.push({ tipo, datos });
      i += 12 + largo;
    }
    expect(chunks.map((c) => c.tipo)).toEqual(["IHDR", "IDAT", "IEND"]);
    expect(chunks[0].datos.readUInt32BE(0)).toBe(2);
    expect(chunks[0].datos.readUInt32BE(4)).toBe(2);
    const crudo = inflateSync(chunks[1].datos);
    const rgba = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
    expect([...crudo]).toEqual([0, ...rgba(PALETA.contorno), 0, 0, 0, 0, 0, ...rgba(PALETA.celeste), ...rgba(PALETA.amarillo)]);
  });
});

describe("el PNG del escudo de la Selección en el repo (assets/escudos/seleccion.png)", () => {
  it("es el dibujo de escudoDeLaSeleccion (si no, regenerarlo con ESCRIBIR_ESCUDO=1 npx vitest run src/domain/escudos)", () => {
    const ruta = fileURLToPath(new URL("../../../assets/escudos/seleccion.png", import.meta.url));
    const png = pngDeMatriz(escudoDeLaSeleccion());
    if (process.env.ESCRIBIR_ESCUDO === "1") writeFileSync(ruta, png);
    expect(new Uint8Array(readFileSync(ruta))).toEqual(png);
  });
});

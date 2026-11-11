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

  it("es la AUF: ribete dorado, cuatro estrellas, las letras en rojo y la franja celeste", () => {
    const cuenta = (color: string) => m.flat().filter((c) => c === color).length;
    // Las estrellas: cuatro manchas doradas separadas en la fila más ancha de las estrellas.
    const fila = m[8].map((c, x) => c === PALETA.amarillo && x > 9 && x < 38);
    expect(fila.filter((on, x) => on && !fila[x - 1]).length).toBe(4);
    // Ribete dorado a los costados, letras AUF en rojo y celeste en la franja.
    expect(m[20][6]).toBe(PALETA.amarillo);
    expect(m[20][41]).toBe(PALETA.amarillo);
    expect(cuenta(PALETA.rojo)).toBeGreaterThan(30);
    expect(m[32].filter((c) => c === PALETA.celeste).length).toBeGreaterThan(10);
  });

  it("se ve como el dibujo aprobado (si cambia, revisarlo con el dueño del producto)", () => {
    const letra = new Map<string, string>([
      [PALETA.contorno, "o"], [PALETA.blanco, "8"], [PALETA.blancoLuz, "9"],
      [PALETA.amarilloSombra, "4"], [PALETA.amarillo, "5"], [PALETA.amarilloLuz, "6"],
      [PALETA.celesteSombra, "g"], [PALETA.celeste, "h"], [PALETA.celesteLuz, "i"],
      [PALETA.rojo, "r"],
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

describe("los escudos estáticos de la app (public/escudos, cargados por migración)", () => {
  const leer = (ruta: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(ruta, import.meta.url))));

  it("el de la Selección es el mismo PNG del repo", () => {
    expect(leer("../../../public/escudos/seleccion.png")).toEqual(leer("../../../assets/escudos/seleccion.png"));
  });

  it.each(["seleccion", "argentina"])("%s pasa la validación de escudos (PNG 48x48)", (nombre) => {
    const png = leer(`../../../public/escudos/${nombre}.png`);
    expect(validarEscudo({ tamano: png.length, cabecera: png.subarray(0, CABECERA_ESCUDO) })).toEqual({ ok: true, tipo: "image/png", extension: "png" });
  });
});

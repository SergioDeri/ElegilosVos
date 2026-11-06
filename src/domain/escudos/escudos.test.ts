import { describe, expect, it } from "vitest";
import { LADO_ESCUDO } from "@/domain/planteles";
import { PALETA } from "@/domain/pixel";
import { faltaEscudo } from "./index";

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

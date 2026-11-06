import { describe, expect, it } from "vitest";
import { CLUBES } from "@/domain/comun/tipos";
import { PALETA, TEMAS, anchoTexto, cssDeLaGrilla, cssDeLaPaleta, pxPara, textoBitmap, type ColorPaleta } from "./index";

const coloresDeLaPaleta = new Set<string>(Object.values(PALETA));

describe("paleta", () => {
  it("tiene entre 16 y 32 colores, todos hex de 6 dígitos y distintos", () => {
    const valores = Object.values(PALETA);
    expect(valores.length).toBeGreaterThanOrEqual(16);
    expect(valores.length).toBeLessThanOrEqual(32);
    for (const v of valores) expect(v).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(valores).size).toBe(valores.length);
  });

  it("los temas solo usan colores de la paleta", () => {
    for (const tema of Object.values(TEMAS)) {
      for (const color of Object.values(tema)) expect(PALETA).toHaveProperty(color as ColorPaleta);
    }
  });

  it("hay tema neutro y uno por Club", () => {
    expect(Object.keys(TEMAS).sort()).toEqual([...CLUBES, "neutro"].sort());
  });

  it("el CSS expone cada color como variable y los acentos de cada tema", () => {
    const css = cssDeLaPaleta();
    expect(css).toContain(`--color-amarillo: ${PALETA.amarillo};`);
    for (const club of CLUBES) expect(css).toContain(`[data-club="${club}"]`);
    expect(css).toContain(`--acento: var(--color-${TEMAS.neutro.acento});`);
  });
});

describe("pxPara", () => {
  it.each([
    [390, 844, 2],
    [360, 740, 2],
    [844, 390, 2],
    [1470, 739, 3],
    [1920, 1080, 4],
    [2560, 1440, 4],
    [200, 300, 2],
  ])("%ix%i → %i", (ancho, alto, px) => {
    expect(pxPara(ancho, alto)).toBe(px);
  });

  it("siempre es entero entre 2 y 4", () => {
    for (let w = 100; w <= 3000; w += 37)
      for (let h = 100; h <= 2000; h += 41) {
        const px = pxPara(w, h);
        expect(Number.isInteger(px)).toBe(true);
        expect(px).toBeGreaterThanOrEqual(2);
        expect(px).toBeLessThanOrEqual(4);
      }
  });
});

describe("cssDeLaGrilla", () => {
  it("cada media query de --px coincide con pxPara en su borde", () => {
    const css = cssDeLaGrilla();
    expect(css).toContain("--px: 2;");
    const reglas = [...css.matchAll(/min-width: (\d+)px\) and \(min-height: (\d+)px\) \{ :root \{ --px: (\d+);/g)];
    expect(reglas.map((r) => Number(r[3]))).toEqual([3, 4]);
    for (const [, w, h, n] of reglas) {
      expect(pxPara(Number(w), Number(h))).toBe(Number(n));
      expect(pxPara(Number(w) - 1, Number(h))).toBe(Number(n) - 1);
      expect(pxPara(Number(w), Number(h) - 1)).toBe(Number(n) - 1);
    }
  });
});

describe("texto bitmap", () => {
  it("las letras miden 3 de ancho, con 1 de separación; M y W miden 5", () => {
    expect(anchoTexto("A")).toBe(3);
    expect(anchoTexto("AB")).toBe(7);
    expect(anchoTexto("M")).toBe(5);
    expect(anchoTexto("ROMERO")).toBe(3 * 5 + 5 + 5);
    expect(anchoTexto("")).toBe(0);
  });

  it("no distingue mayúsculas de minúsculas", () => {
    expect(textoBitmap("peñarol", "cal")).toEqual(textoBitmap("PEÑAROL", "cal"));
  });

  it("mide 6 de alto (fila de tilde + 5) y su ancho coincide con anchoTexto", () => {
    const m = textoBitmap("PEÑAROL", "cal");
    expect(m).toHaveLength(6);
    for (const fila of m) expect(fila).toHaveLength(anchoTexto("PEÑAROL"));
  });

  it("la Ñ y las vocales con tilde usan la fila de arriba; las demás no", () => {
    const fila0 = (t: string) => textoBitmap(t, "cal")[0];
    expect(fila0("Ñ").some(Boolean)).toBe(true);
    expect(fila0("Á").some(Boolean)).toBe(true);
    expect(fila0("N").some(Boolean)).toBe(false);
    expect(textoBitmap("Ñ", "cal").slice(1)).toEqual(textoBitmap("N", "cal").slice(1));
  });

  it("con contorno suma 1 px por lado y el contorno es del color de contorno", () => {
    const sin = textoBitmap("I", "cal");
    const con = textoBitmap("I", "cal", { contorno: true });
    expect(con).toHaveLength(sin.length + 2);
    expect(con[0]).toHaveLength(sin[0].length + 2);
    expect(con.flat()).toContain(PALETA.contorno);
  });

  it("solo usa colores de la paleta", () => {
    const m = textoBitmap("Fernández 10", "amarilloLuz", { contorno: true });
    for (const c of m.flat()) if (c) expect(coloresDeLaPaleta.has(c)).toBe(true);
  });

  it("un carácter desconocido se dibuja como espacio, sin romper", () => {
    expect(anchoTexto("A@B")).toBe(anchoTexto("A B"));
    expect(textoBitmap("A@B", "cal")).toEqual(textoBitmap("A B", "cal"));
  });
});

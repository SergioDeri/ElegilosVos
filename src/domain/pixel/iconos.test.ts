import { describe, expect, it } from "vitest";
import { ICONOS, LADO_ICONO, PALETA, icono, type NombreIcono } from "./index";

const coloresDeLaPaleta = new Set<string>(Object.values(PALETA));

describe("íconos", () => {
  it("están los de guardado, cierre de la Votación, compartir y menú", () => {
    expect([...ICONOS].sort()).toEqual(["cierre", "compartir", "guardado", "menu", "usuario"]);
  });

  it.each([...ICONOS])("%s mide 8x8 y usa solo colores de la paleta", (nombre) => {
    const m = icono(nombre, "cal");
    expect(LADO_ICONO).toBe(8);
    expect(m).toHaveLength(8);
    for (const fila of m) expect(fila).toHaveLength(8);
    for (const c of m.flat()) if (c !== null) expect(coloresDeLaPaleta.has(c)).toBe(true);
  });

  it.each([...ICONOS])("%s se pinta del color pedido y tiene fondo transparente", (nombre) => {
    const m = icono(nombre, "amarillo");
    expect(new Set(m.flat())).toEqual(new Set([null, PALETA.amarillo]));
  });

  it("cada ícono es distinto", () => {
    const dibujos = ICONOS.map((n: NombreIcono) => JSON.stringify(icono(n, "cal")));
    expect(new Set(dibujos).size).toBe(ICONOS.length);
  });

  it("el menú son tres barras horizontales", () => {
    const llenas = icono("menu", "cal").filter((f) => f.every((c) => c !== null));
    expect(llenas).toHaveLength(3);
  });

  it("los íconos (si cambian, revisarlos con el dueño del producto)", () => {
    const dibujo = ICONOS.map(
      (n) => `${n}\n${icono(n, "cal").map((f) => f.map((c) => (c ? "#" : ".")).join("")).join("\n")}`,
    ).join("\n\n");
    expect(dibujo).toMatchSnapshot();
  });
});

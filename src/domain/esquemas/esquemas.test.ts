import { describe, expect, it } from "vitest";
import { esEsquemaId, esPuestoDe, esPuestoDeArquero, esquema, esquemaPorDefecto, esquemas } from "./index";

describe("Catálogo de Esquemas", () => {
  it("tiene los seis Esquemas del MVP, en orden fijo", () => {
    expect(esquemas().map((e) => e.id)).toEqual(["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1"]);
  });

  it.each(esquemas().map((e) => [e.id, e] as const))("%s tiene 11 Puestos con ids distintos", (_, e) => {
    expect(e.puestos).toHaveLength(11);
    expect(new Set(e.puestos.map((p) => p.id)).size).toBe(11);
  });

  it.each(esquemas().map((e) => [e.id, e] as const))("%s tiene exactamente un Puesto de arquero", (_, e) => {
    const arqueros = e.puestos.filter((p) => p.esArquero);
    expect(arqueros).toHaveLength(1);
    expect(esPuestoDeArquero(arqueros[0].id)).toBe(true);
    expect(e.puestos.filter((p) => esPuestoDeArquero(p.id))).toHaveLength(1);
  });

  it.each(esquemas().map((e) => [e.id, e] as const))("%s tiene coordenadas normalizadas y sin superposiciones", (_, e) => {
    for (const p of e.puestos) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
      expect(p.etiqueta).not.toBe("");
      expect(p.sigla).not.toBe("");
    }
    expect(new Set(e.puestos.map((p) => `${p.x},${p.y}`)).size).toBe(11);
  });

  it("el arquero está abajo, junto al arco propio, y es el Puesto más atrasado", () => {
    for (const e of esquemas()) {
      const arquero = e.puestos.find((p) => p.esArquero)!;
      expect(arquero.x).toBe(0.5);
      for (const p of e.puestos) if (p !== arquero) expect(p.y).toBeGreaterThan(arquero.y);
    }
  });

  it("los Puestos con lado quedan del lado correcto de la cancha", () => {
    for (const e of esquemas()) {
      for (const p of e.puestos) {
        if (p.id.endsWith("_I") || p.id === "LI") expect(p.x, `${e.id} ${p.id}`).toBeLessThan(0.5);
        if (p.id.endsWith("_D") || p.id === "LD") expect(p.x, `${e.id} ${p.id}`).toBeGreaterThan(0.5);
      }
    }
  });

  it("busca un Esquema por id", () => {
    expect(esquema("4-4-2").nombre).toBe("4-4-2");
    expect(esquema("3-5-2").puestos.map((p) => p.id)).toContain("CAR_I");
  });

  it("el Esquema por defecto es del catálogo", () => {
    expect(esquemas().map((e) => e.id)).toContain(esquemaPorDefecto);
  });

  it("reconoce ids de Esquema válidos (por ejemplo, leídos de la base)", () => {
    expect(esEsquemaId("4-2-3-1")).toBe(true);
    expect(esEsquemaId("4-2-4")).toBe(false);
    expect(esEsquemaId("")).toBe(false);
  });

  it("reconoce si un Puesto pertenece a un Esquema", () => {
    expect(esPuestoDe("4-4-2", "DEL_I")).toBe(true);
    expect(esPuestoDe("4-3-3", "DEL_I")).toBe(false);
    expect(esPuestoDe("4-3-3", "cualquiera")).toBe(false);
  });
});

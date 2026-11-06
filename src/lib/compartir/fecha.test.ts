import { describe, expect, it } from "vitest";
import { fechaDeImagen } from "./fecha";

describe("fechaDeImagen", () => {
  it("formatea el inicio en hora de Montevideo", () => {
    const { fecha } = fechaDeImagen(new Date("2026-11-10T23:00:00Z")); // 20:00 en Montevideo
    expect(fecha).toContain("20:00");
    expect(fecha).toContain("2026");
  });

  it("toma el día de Montevideo para el nombre del archivo", () => {
    expect(fechaDeImagen(new Date("2026-11-11T02:30:00Z")).dia).toBe("2026-11-10"); // 23:30 del 10
    expect(fechaDeImagen(new Date("2026-11-10T23:00:00Z")).dia).toBe("2026-11-10");
  });
});

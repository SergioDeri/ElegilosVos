import { describe, expect, it } from "vitest";
import { aHoraUyLocal, desdeHoraUy, formatearHoraUy } from "./horario";

describe("horario de Montevideo", () => {
  it("convierte la hora local de Montevideo a UTC (UTC-3)", () => {
    expect(desdeHoraUy("2026-11-10T20:00").toISOString()).toBe("2026-11-10T23:00:00.000Z");
  });

  it("cruza la medianoche UTC", () => {
    expect(desdeHoraUy("2026-11-10T22:30").toISOString()).toBe("2026-11-11T01:30:00.000Z");
  });

  it("aHoraUyLocal es el inverso de desdeHoraUy", () => {
    const local = "2026-03-01T15:45";
    expect(aHoraUyLocal(desdeHoraUy(local))).toBe(local);
  });

  it("muestra la hora en Montevideo, no en UTC", () => {
    expect(formatearHoraUy(new Date("2026-11-10T23:00:00Z"))).toContain("20:00");
  });

  it("rechaza formatos inválidos", () => {
    expect(() => desdeHoraUy("10/11/2026 20:00")).toThrow();
  });
});

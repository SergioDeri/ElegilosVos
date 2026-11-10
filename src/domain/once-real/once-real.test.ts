import { describe, expect, it } from "vitest";
import { coincidencias, JUGADORES_DEL_ONCE_REAL, validarOnceReal } from ".";

const plantel = Array.from({ length: 14 }, (_, i) => ({ id: `j${i + 1}` }));
const once = plantel.slice(0, 11).map((j) => j.id);
const partido = { inicio: new Date("2026-11-01T20:00:00Z"), cancelado: false };
const despues = new Date("2026-11-01T22:00:00Z");

function validar(jugadores: unknown, opciones: { ahora?: Date; cancelado?: boolean } = {}) {
  return validarOnceReal({
    jugadores,
    plantel,
    partido: { ...partido, cancelado: opciones.cancelado ?? false },
    ahora: opciones.ahora ?? despues,
  });
}

describe("validarOnceReal", () => {
  it("acepta 11 Jugadores distintos del Plantel en un Partido que ya empezó", () => {
    expect(JUGADORES_DEL_ONCE_REAL).toBe(11);
    expect(validar(once)).toEqual({ ok: true, jugadores: once });
  });

  it("rechaza menos o más de 11", () => {
    expect(validar(once.slice(0, 10))).toEqual({ ok: false, motivo: "cantidad", cantidad: 10 });
    expect(validar([...once, "j12"])).toEqual({ ok: false, motivo: "cantidad", cantidad: 12 });
    expect(validar([])).toEqual({ ok: false, motivo: "cantidad", cantidad: 0 });
  });

  it("rechaza Jugadores repetidos", () => {
    expect(validar([...once.slice(0, 10), "j1"])).toEqual({ ok: false, motivo: "repetidos" });
  });

  it("rechaza Jugadores que no son del Plantel del Club", () => {
    expect(validar([...once.slice(0, 10), "otro"])).toEqual({ ok: false, motivo: "ajenos" });
  });

  it("rechaza entradas que no son una lista de ids", () => {
    expect(validar("j1")).toEqual({ ok: false, motivo: "cantidad", cantidad: 0 });
    expect(validar([...once.slice(0, 10), 7])).toEqual({ ok: false, motivo: "ajenos" });
  });

  it("solo se carga desde el inicio del Partido", () => {
    expect(validar(once, { ahora: new Date(partido.inicio.getTime() - 1) })).toEqual({ ok: false, motivo: "no_empezo" });
    expect(validar(once, { ahora: partido.inicio })).toEqual({ ok: true, jugadores: once });
  });

  it("un Partido cancelado no tiene 11 Real", () => {
    expect(validar(once, { cancelado: true })).toEqual({ ok: false, motivo: "cancelado" });
  });
});

describe("coincidencias", () => {
  const ids = (desde: number, hasta: number) => Array.from({ length: hasta - desde }, (_, i) => `j${desde + i}`);
  const elegido = ids(1, 12); // j1..j11
  const real = ids(4, 15); // j4..j14

  it("con Alineación, 11 Elegido y 11 Real, las tres Coincidencias", () => {
    const alineacion = [...ids(1, 6), ...ids(12, 15)]; // j1..j5 y j12..j14
    expect(coincidencias({ alineacion, onceElegido: elegido, onceReal: real })).toEqual({
      alineacionConElegido: 5,
      alineacionConReal: 5,
      elegidoConReal: 8,
    });
  });

  it("sin Alineación del Hincha, solo la del 11 Elegido con el 11 Real", () => {
    expect(coincidencias({ alineacion: null, onceElegido: elegido, onceReal: real })).toEqual({
      alineacionConElegido: null,
      alineacionConReal: null,
      elegidoConReal: 8,
    });
  });

  it("sin 11 Real cargado, solo la de la Alineación con el 11 Elegido", () => {
    expect(coincidencias({ alineacion: ids(1, 3), onceElegido: elegido, onceReal: null })).toEqual({
      alineacionConElegido: 2,
      alineacionConReal: null,
      elegidoConReal: null,
    });
  });

  it("sin 11 Elegido (Votación sin Alineaciones o anulada), solo la de la Alineación con el 11 Real", () => {
    expect(coincidencias({ alineacion: ids(4, 6), onceElegido: null, onceReal: real })).toEqual({
      alineacionConElegido: null,
      alineacionConReal: 2,
      elegidoConReal: null,
    });
  });

  it("no cuenta los Puestos vacantes del 11 Elegido", () => {
    expect(coincidencias({ alineacion: [null, "j1"], onceElegido: [null, "j1"], onceReal: [null, ...ids(1, 11)] })).toEqual({
      alineacionConElegido: 1,
      alineacionConReal: 1,
      elegidoConReal: 1,
    });
  });
});

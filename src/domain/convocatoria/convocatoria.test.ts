import { describe, expect, it } from "vitest";
import { validarConvocatoria } from ".";

const J1 = "11111111-1111-4111-8111-111111111111";
const J2 = "22222222-2222-4222-8222-222222222222";
const P1 = "33333333-3333-4333-8333-333333333333";

describe("validarConvocatoria", () => {
  it("acepta elegibles y Partidos de la Selección elegidos en el formulario", () => {
    expect(validarConvocatoria({ jugadores: [J1, J2], partidos: [P1] })).toEqual({
      ok: true,
      convocatoria: { jugadores: [J1, J2], partidos: [P1] },
    });
  });

  it("sin ningún Jugador convocado o sin ningún Partido no es una Convocatoria", () => {
    expect(validarConvocatoria({ jugadores: [], partidos: [] })).toEqual({
      ok: false,
      errores: { jugadores: "Elegí al menos un Jugador.", partidos: "Elegí al menos un Partido." },
    });
  });

  it("un id que no es un uuid es un error (no se descarta en silencio)", () => {
    expect(validarConvocatoria({ jugadores: [J1, "x"], partidos: [P1, 7] })).toEqual({
      ok: false,
      errores: { jugadores: "Hay un Jugador inválido.", partidos: "Hay un Partido inválido." },
    });
  });

  it("un Jugador o un Partido repetido cuenta una sola vez", () => {
    expect(validarConvocatoria({ jugadores: [J1, J2, J1], partidos: [P1, P1] })).toEqual({
      ok: true,
      convocatoria: { jugadores: [J1, J2], partidos: [P1] },
    });
  });
});

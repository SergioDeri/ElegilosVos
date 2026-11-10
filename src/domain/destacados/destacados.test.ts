import { describe, expect, it } from "vitest";
import type { EsquemaId, PuestoId } from "@/domain/esquemas";
import { contarApariciones, destacado, type AlineacionConJugadores } from "./index";

/** Alineación con los Jugadores dados en los Puestos dados. */
function alineacion(esquema: EsquemaId, puestos: Partial<Record<PuestoId, string>> = {}): AlineacionConJugadores {
  return {
    esquema,
    puestos: Object.fromEntries(Object.entries(puestos).map(([p, jugadorId]) => [p, { jugadorId }])),
  };
}

describe("destacado: Más Pedido (sin Convocatoria)", () => {
  it("es el Jugador que figura en más Alineaciones, en cualquier Puesto, con apariciones y porcentaje", () => {
    const apariciones = contarApariciones([
      alineacion("4-3-3", { ARQ: "muslera", DEL: "suarez" }),
      alineacion("4-4-2", { DEL_I: "suarez" }),
      alineacion("4-3-3", { ARQ: "rochet", EXT_D: "suarez" }),
      alineacion("4-3-3", { ARQ: "muslera" }),
    ]);
    expect(destacado(apariciones)).toEqual({
      tipo: "mas_pedido",
      jugadores: [{ jugadorId: "suarez", apariciones: 3, porcentaje: 75 }],
    });
  });
});

describe("destacado: empates", () => {
  it("con empate devuelve a todos los empatados, cada uno con sus apariciones y su porcentaje", () => {
    const apariciones = contarApariciones([
      alineacion("4-3-3", { ARQ: "muslera", DEL: "suarez" }),
      alineacion("4-3-3", { ARQ: "rochet", DEL: "nunez" }),
      alineacion("4-3-3", { ARQ: "muslera", DEL: "nunez", EXT_D: "suarez" }),
    ]);
    expect(destacado(apariciones)).toEqual({
      tipo: "mas_pedido",
      jugadores: [
        { jugadorId: "muslera", apariciones: 2, porcentaje: (2 / 3) * 100 },
        { jugadorId: "nunez", apariciones: 2, porcentaje: (2 / 3) * 100 },
        { jugadorId: "suarez", apariciones: 2, porcentaje: (2 / 3) * 100 },
      ],
    });
  });
});

describe("contarApariciones", () => {
  it("un Jugador cuenta una vez por Alineación y los Puestos que no son del Esquema no cuentan", () => {
    const a: AlineacionConJugadores = {
      esquema: "4-3-3",
      // DEL_I no es Puesto del 4-3-3 (quedó de otro Esquema).
      puestos: { DEL: { jugadorId: "suarez" }, EXT_D: { jugadorId: "suarez" }, DEL_I: { jugadorId: "nunez" } },
    };
    expect(contarApariciones([a])).toEqual({
      alineaciones: 1,
      porJugador: [{ jugadorId: "suarez", apariciones: 1 }],
    });
  });

  it("las Alineaciones vacías no cuentan para el porcentaje", () => {
    const apariciones = contarApariciones([
      alineacion("4-3-3", { DEL: "suarez" }),
      alineacion("4-4-2"),
      alineacion("4-3-3", { ARQ: "muslera" }),
      alineacion("4-3-3"),
    ]);
    expect(apariciones.alineaciones).toBe(2);
    expect(destacado(apariciones)?.jugadores.map((j) => j.porcentaje)).toEqual([50, 50]);
  });
});

describe("destacado: sin nada que destacar", () => {
  it("sin Alineaciones no hay Más Pedido", () => {
    expect(destacado(contarApariciones([]))).toBeNull();
  });

  it("si todas las Alineaciones están vacías no hay Más Pedido", () => {
    expect(destacado(contarApariciones([alineacion("4-3-3"), alineacion("4-4-2")]))).toBeNull();
  });
});

describe("destacado: Gran Ausente (con Convocatoria)", () => {
  const apariciones = contarApariciones([
    alineacion("4-3-3", { ARQ: "muslera", DEL: "suarez", EXT_D: "cavani" }),
    alineacion("4-3-3", { ARQ: "muslera", DEL: "suarez" }),
    alineacion("4-3-3", { ARQ: "muslera", DEL: "nunez", EXT_D: "cavani" }),
    alineacion("4-3-3", { ARQ: "rochet", DEL: "nunez" }),
  ]);

  it("es el no convocado que figura en más Alineaciones, aunque un convocado figure en más", () => {
    expect(destacado(apariciones, ["muslera", "rochet", "nunez"])).toEqual({
      tipo: "gran_ausente",
      jugadores: [
        { jugadorId: "cavani", apariciones: 2, porcentaje: 50 },
        { jugadorId: "suarez", apariciones: 2, porcentaje: 50 },
      ],
    });
  });

  it("si ningún no convocado figura en ninguna Alineación, no hay Gran Ausente (tampoco Más Pedido)", () => {
    expect(destacado(apariciones, ["muslera", "rochet", "nunez", "suarez", "cavani"])).toBeNull();
  });

  it("con una Convocatoria vacía, todos son no convocados", () => {
    expect(destacado(apariciones, [])).toEqual({
      tipo: "gran_ausente",
      jugadores: [{ jugadorId: "muslera", apariciones: 3, porcentaje: 75 }],
    });
  });

  it("sin Alineaciones no hay Gran Ausente", () => {
    expect(destacado(contarApariciones([]), ["muslera"])).toBeNull();
  });

  it("con Convocatoria null es como si no la hubiera: el Más Pedido", () => {
    expect(destacado(apariciones, null)?.tipo).toBe("mas_pedido");
  });
});

import { describe, expect, it } from "vitest";
import type { ResultadoConteo } from "@/domain/conteo";
import { esquema } from "@/domain/esquemas";
import { formatearPorcentaje, vistaDelDestacado, vistaDelParcial, type JugadorParaMostrar } from "./index";

const jugadores: JugadorParaMostrar[] = [
  { id: "a", nombre: "Arquero Uno", numero: 1 },
  { id: "b", nombre: "Arquero Dos", numero: 12 },
];

const puestos433 = esquema("4-3-3").puestos;

const resultado: ResultadoConteo = {
  vacio: false,
  alineacionesQueCuentan: 3,
  esquemas: [
    { esquema: "4-3-3", votos: 2, porcentaje: 200 / 3 },
    { esquema: "4-4-2", votos: 1, porcentaje: 100 / 3 },
  ],
  esquemaGanador: "4-3-3",
  puestos: puestos433.map((p) =>
    p.id === "ARQ"
      ? {
          puesto: "ARQ",
          totalVotos: 3,
          candidatos: [
            { jugadorId: "a", votos: 2, porcentaje: 200 / 3 },
            { jugadorId: "b", votos: 1, porcentaje: 100 / 3 },
          ],
        }
      : { puesto: p.id, totalVotos: 0, candidatos: [] },
  ),
  once: puestos433.map((p) =>
    p.id === "ARQ"
      ? { puesto: "ARQ", jugadorId: "a", origen: "votos", votos: 2 }
      : { puesto: p.id, jugadorId: null, origen: "vacante", votos: 0 },
  ),
};

describe("vistaDelParcial", () => {
  it("sin votos, vista vacía", () => {
    expect(vistaDelParcial({ vacio: true, alineacionesQueCuentan: 0 }, jugadores)).toEqual({ vacio: true });
  });

  it("el 11 usa los Puestos del Esquema ganador (con posición en la cancha) y resuelve nombre y número", () => {
    const v = vistaDelParcial(resultado, jugadores);
    if (v.vacio) throw new Error("se esperaba vista con datos");
    expect(v.alineacionesQueCuentan).toBe(3);
    expect(v.esquemaGanador).toBe("4-3-3");
    expect(v.once).toHaveLength(11);
    const arco = v.once[0]!;
    expect(arco).toMatchObject({
      puesto: "ARQ",
      etiqueta: "Arquero",
      x: puestos433[0]!.x,
      y: puestos433[0]!.y,
      jugador: { nombre: "Arquero Uno", numero: 1 },
      origen: "votos",
      porcentaje: 200 / 3,
    });
    expect(v.once[1]).toMatchObject({ jugador: null, origen: "vacante", porcentaje: 0 });
  });

  it("porcentajes por Esquema (marca el ganador) y candidatos por Puesto con nombre", () => {
    const v = vistaDelParcial(resultado, jugadores);
    if (v.vacio) throw new Error("se esperaba vista con datos");
    expect(v.esquemas.map((e) => [e.esquema, e.votos, e.ganador])).toEqual([
      ["4-3-3", 2, true],
      ["4-4-2", 1, false],
    ]);
    const arco = v.puestos.find((p) => p.puesto === "ARQ")!;
    expect(arco.etiqueta).toBe("Arquero");
    expect(arco.candidatos.map((c) => [c.jugador.nombre, c.votos])).toEqual([
      ["Arquero Uno", 2],
      ["Arquero Dos", 1],
    ]);
  });

  it("un Jugador que no está en la lista se muestra como desconocido", () => {
    const v = vistaDelParcial(resultado, [jugadores[1]!]);
    if (v.vacio) throw new Error("se esperaba vista con datos");
    expect(v.once[0]!.jugador).toEqual({ nombre: "Jugador desconocido", numero: null });
  });
});

describe("vistaDelDestacado (el Más Pedido o el Gran Ausente del Parcial de la Selección)", () => {
  const elegibles: JugadorParaMostrar[] = [
    { id: "s", nombre: "Luis Suárez", numero: null },
    { id: "c", nombre: "Edinson Cavani", numero: null },
  ];

  it("sin destacado, nada", () => {
    expect(vistaDelDestacado(null, elegibles)).toBeNull();
  });

  it("resuelve el nombre completo y deja apariciones y porcentaje; los empatados, por nombre", () => {
    expect(
      vistaDelDestacado(
        {
          tipo: "mas_pedido",
          jugadores: [
            { jugadorId: "s", apariciones: 2, porcentaje: 50 },
            { jugadorId: "c", apariciones: 2, porcentaje: 50 },
          ],
        },
        elegibles,
      ),
    ).toEqual({
      tipo: "mas_pedido",
      titulo: "Más Pedido",
      jugadores: [
        { jugador: { nombre: "Edinson Cavani", numero: null }, apariciones: 2, porcentaje: 50 },
        { jugador: { nombre: "Luis Suárez", numero: null }, apariciones: 2, porcentaje: 50 },
      ],
    });
  });

  it("el Gran Ausente lleva su título; un Jugador que no está en la lista se muestra como desconocido", () => {
    const v = vistaDelDestacado({ tipo: "gran_ausente", jugadores: [{ jugadorId: "x", apariciones: 1, porcentaje: 100 }] }, elegibles);
    expect(v?.titulo).toBe("Gran Ausente");
    expect(v?.jugadores[0]?.jugador).toEqual({ nombre: "Jugador desconocido", numero: null });
  });
});

describe("formatearPorcentaje", () => {
  it("un decimal con coma, sin decimal si es entero", () => {
    expect(formatearPorcentaje(200 / 3)).toBe("66,7 %");
    expect(formatearPorcentaje(100)).toBe("100 %");
    expect(formatearPorcentaje(0)).toBe("0 %");
  });
});

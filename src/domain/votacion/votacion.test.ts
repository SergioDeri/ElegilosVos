import { describe, expect, it } from "vitest";
import type { FilaAlineacion } from "@/domain/armado";
import type { ResultadoConteo } from "@/domain/conteo";
import { contarVotacion, soloAgregados, type FilaJugadorParaConteo } from "./index";

const jugadores: FilaJugadorParaConteo[] = [
  { id: "arq", numero: 1, posicion_natural: "ARQ", disponibilidad: "disponible", en_plantel: true },
  { id: "arq2", numero: 12, posicion_natural: "ARQ", disponibilidad: "disponible", en_plantel: true },
  { id: "lesionado", numero: 25, posicion_natural: "ARQ", disponibilidad: "lesionado", en_plantel: true },
  { id: "def", numero: 2, posicion_natural: "DEF", disponibilidad: "disponible", en_plantel: true },
];

const HORA = "2026-11-10T12:00:00+00:00";

function fila(puestos: Record<string, string>, extra: Partial<FilaAlineacion> = {}): FilaAlineacion {
  return {
    esquema: "4-3-3",
    esquema_elegido_a_mano: false,
    esquema_modificado_en: null,
    puestos: Object.fromEntries(Object.entries(puestos).map(([p, j]) => [p, { jugadorId: j, modificadoEn: HORA }])),
    ...extra,
  };
}

describe("contarVotacion (filas de la base → Motor de Conteo)", () => {
  it("sin filas, el resultado es vacío", () => {
    expect(contarVotacion([], jugadores)).toEqual({ vacio: true, alineacionesQueCuentan: 0 });
  });

  it("cuenta las Alineaciones con Jugadores y lee los puestos del jsonb", () => {
    const r = contarVotacion([fila({ ARQ: "arq" }), fila({ ARQ: "arq" }), fila({ ARQ: "arq2" })], jugadores);
    if (r.vacio) throw new Error("se esperaba resultado");
    expect(r.alineacionesQueCuentan).toBe(3);
    expect(r.esquemaGanador).toBe("4-3-3");
    const arco = r.puestos.find((p) => p.puesto === "ARQ")!;
    expect(arco.candidatos.map((c) => [c.jugadorId, c.votos])).toEqual([
      ["arq", 2],
      ["arq2", 1],
    ]);
    expect(r.once.find((a) => a.puesto === "ARQ")?.jugadorId).toBe("arq");
  });

  it("una fila sin Jugadores ni Esquema elegido a mano no cuenta; con Esquema elegido a mano, sí", () => {
    const r = contarVotacion(
      [
        fila({}),
        fila({}, { esquema: "4-4-2", esquema_elegido_a_mano: true, esquema_modificado_en: HORA }),
      ],
      jugadores,
    );
    expect(r.alineacionesQueCuentan).toBe(1);
    if (r.vacio) throw new Error("se esperaba resultado");
    expect(r.esquemaGanador).toBe("4-4-2");
  });

  it("aplica la Disponibilidad de las filas de Jugadores (votos a no Disponibles se descartan)", () => {
    const r = contarVotacion([fila({ ARQ: "lesionado" }), fila({ ARQ: "lesionado" }), fila({ ARQ: "arq2" })], jugadores);
    if (r.vacio) throw new Error("se esperaba resultado");
    expect(r.once.find((a) => a.puesto === "ARQ")?.jugadorId).toBe("arq2");
  });

  it("una fila ilegible no rompe el conteo (se lee como Alineación vacía)", () => {
    const r = contarVotacion([fila({ ARQ: "arq" }), { ...fila({}), esquema: "9-9-9", puestos: "basura" }], jugadores);
    expect(r.alineacionesQueCuentan).toBe(1);
  });
});

describe("soloAgregados", () => {
  it("deja solo los campos agregados conocidos (nada que identifique a un Hincha)", () => {
    const r = contarVotacion([fila({ ARQ: "arq" }), fila({ ARQ: "arq2" })], jugadores);
    if (r.vacio) throw new Error("se esperaba resultado");
    const contaminado = {
      ...r,
      hincha_id: "h1",
      alineaciones: [{ hincha_id: "h1" }],
      esquemas: r.esquemas.map((e) => ({ ...e, hinchas: ["h1"] })),
      puestos: r.puestos.map((p) => ({
        ...p,
        votantes: ["h1"],
        candidatos: p.candidatos.map((c) => ({ ...c, modificadoEn: HORA, hinchaId: "h1" })),
      })),
      once: r.once.map((a) => ({ ...a, hincha_id: "h1" })),
    } as unknown as ResultadoConteo;
    const limpio = soloAgregados(contaminado);
    expect(limpio).toEqual(r);
    expect(JSON.stringify(limpio)).not.toContain("h1");
    expect(JSON.stringify(limpio)).not.toContain("2026-");
  });

  it("el resultado vacío queda igual", () => {
    expect(soloAgregados({ vacio: true, alineacionesQueCuentan: 0 })).toEqual({ vacio: true, alineacionesQueCuentan: 0 });
  });
});

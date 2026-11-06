import { describe, expect, it } from "vitest";
import { contar, type JugadorParaConteo } from "@/domain/conteo";
import {
  coincidencia,
  decidirCierre,
  disponibilidadAlCierre,
  esEstadoResultado,
  estadoResultadoDeLaBase,
  onceDesdeJson,
  resultadoDelConteo,
} from "./index";

const T = Date.parse("2026-11-10T20:00:00Z");
const en = (min: number) => new Date(T + min * 60_000);

describe("decidirCierre", () => {
  const votacion = (estado: "pendiente" | "abierta" | "cerrada" | "anulada", abre = en(-600), cierra = en(0)) => ({
    estado,
    abre,
    cierra,
  });

  it("espera mientras la Votación no cerró", () => {
    expect(decidirCierre(votacion("pendiente"), en(-700))).toEqual({ accion: "esperar" });
    expect(decidirCierre(votacion("abierta"), en(-1))).toEqual({ accion: "esperar" });
  });

  it("cuenta una Votación cerrada que estuvo abierta", () => {
    expect(decidirCierre(votacion("cerrada"), en(0))).toEqual({ accion: "contar" });
  });

  it("no espera al cálculo del estado: con `ahora` antes del cierre espera aunque digan cerrada", () => {
    expect(decidirCierre(votacion("cerrada"), en(-1))).toEqual({ accion: "esperar" });
  });

  it("registra 'nunca_abrio' si la ventana estuvo vacía (abre >= cierra)", () => {
    expect(decidirCierre(votacion("cerrada", en(0), en(0)), en(5))).toEqual({ accion: "registrar", estado: "nunca_abrio" });
    expect(decidirCierre(votacion("cerrada", en(30), en(0)), en(5))).toEqual({ accion: "registrar", estado: "nunca_abrio" });
  });

  it("un Partido cancelado queda 'anulada' recién cuando pasó la hora de cierre", () => {
    expect(decidirCierre(votacion("anulada"), en(-1))).toEqual({ accion: "esperar" });
    expect(decidirCierre(votacion("anulada"), en(0))).toEqual({ accion: "registrar", estado: "anulada" });
  });
});

describe("disponibilidadAlCierre", () => {
  const jugadores = [
    { id: "a", disponibilidad: "disponible" as const, otro: 1 },
    { id: "b", disponibilidad: "lesionado" as const, otro: 2 },
    { id: "c", disponibilidad: "suspendido" as const, otro: 3 },
  ];

  it("sin cambios posteriores al cierre, es la Disponibilidad actual", () => {
    const eventos = [{ jugadorId: "b", disponibilidadAnterior: "disponible" as const, momento: en(-10) }];
    expect(disponibilidadAlCierre(jugadores, eventos, en(0))).toEqual(jugadores);
  });

  it("deshace los cambios posteriores al cierre (vale la anterior del primero)", () => {
    const eventos = [
      // b se lesionó después del cierre; c: suspendido → no_disponible → suspendido.
      { jugadorId: "b", disponibilidadAnterior: "disponible" as const, momento: en(5) },
      { jugadorId: "c", disponibilidadAnterior: "no_disponible" as const, momento: en(20) },
      { jugadorId: "c", disponibilidadAnterior: "disponible" as const, momento: en(10) },
    ];
    expect(disponibilidadAlCierre(jugadores, eventos, en(0))).toEqual([
      { id: "a", disponibilidad: "disponible", otro: 1 },
      { id: "b", disponibilidad: "disponible", otro: 2 },
      { id: "c", disponibilidad: "disponible", otro: 3 },
    ]);
  });

  it("un cambio exactamente a la hora de cierre ya no cuenta para el cierre", () => {
    const eventos = [{ jugadorId: "b", disponibilidadAnterior: "disponible" as const, momento: en(0) }];
    expect(disponibilidadAlCierre(jugadores, eventos, en(0))[1]!.disponibilidad).toBe("disponible");
  });
});

describe("resultadoDelConteo", () => {
  const jugadores: JugadorParaConteo[] = [
    { id: "arq", numero: 1, posicionNatural: "ARQ", disponibilidad: "disponible", enPlantel: true },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `j${i}`,
      numero: i + 2,
      posicionNatural: "DEF" as const,
      disponibilidad: "disponible" as const,
      enPlantel: true,
    })),
  ];

  it("sin Alineaciones que cuentan: 'sin_alineaciones', sin 11", () => {
    expect(resultadoDelConteo(contar({ alineaciones: [], jugadores }))).toEqual({
      estado: "sin_alineaciones",
      esquema: null,
      once: null,
      detalle: { vacio: true, alineacionesQueCuentan: 0 },
      alineacionesQueCuentan: 0,
    });
  });

  it("con votos: 'con_once' con el Esquema ganador, el 11 y el detalle completo", () => {
    const conteo = contar({
      alineaciones: [
        { esquema: "4-4-2", esquemaElegidoAMano: true, puestos: { ARQ: { jugadorId: "arq", modificadoEn: en(0) } } },
      ],
      jugadores,
    });
    const r = resultadoDelConteo(conteo);
    expect(r.estado).toBe("con_once");
    expect(r.esquema).toBe("4-4-2");
    expect(r.alineacionesQueCuentan).toBe(1);
    expect(r.once).toHaveLength(11);
    expect(r.once![0]).toEqual({ puesto: "ARQ", jugadorId: "arq", origen: "votos", votos: 1 });
    // El detalle es JSON puro (se guarda en jsonb) e igual al conteo.
    expect(JSON.parse(JSON.stringify(r.detalle))).toEqual(conteo);
  });
});

describe("coincidencia", () => {
  it("cuenta los Jugadores en común sin importar el Puesto", () => {
    expect(coincidencia(["a", "b", "c", "d"], ["d", "c", "x", "y"])).toBe(2);
  });

  it("ignora vacíos y repetidos", () => {
    expect(coincidencia(["a", null, "a", undefined], [null, "a", "a"])).toBe(1);
    expect(coincidencia([], ["a"])).toBe(0);
  });
});

describe("onceDesdeJson", () => {
  it("lee el 11 guardado", () => {
    const once = [
      { puesto: "ARQ", jugadorId: "x", origen: "votos", votos: 3 },
      { puesto: "LI", jugadorId: null, origen: "vacante", votos: 0 },
    ];
    expect(onceDesdeJson(once)).toEqual(once);
  });

  it("descarta lo que no tiene forma de Asignación", () => {
    expect(onceDesdeJson(null)).toEqual([]);
    expect(onceDesdeJson({})).toEqual([]);
    expect(onceDesdeJson([{ puesto: "NADA", jugadorId: "x", origen: "votos", votos: 1 }, 3])).toEqual([]);
  });
});

describe("estado del resultado leído de la base", () => {
  it("reconoce los cuatro estados", () => {
    for (const e of ["con_once", "sin_alineaciones", "anulada", "nunca_abrio"]) expect(esEstadoResultado(e)).toBe(true);
    expect(esEstadoResultado("abierta")).toBe(false);
    expect(esEstadoResultado(null)).toBe(false);
  });

  it("estadoResultadoDeLaBase devuelve el estado y lanza con uno desconocido", () => {
    expect(estadoResultadoDeLaBase("anulada")).toBe("anulada");
    expect(() => estadoResultadoDeLaBase("abierta")).toThrow();
  });
});

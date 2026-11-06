import { describe, expect, it } from "vitest";
import type { PartidoCalendario } from "@/domain/calendario";
import type { PosicionNatural } from "@/domain/comun/tipos";
import type { Alineacion, JugadorDelPlantel } from "@/domain/editor";
import { alineacionesAHeredar, jugadoresNoDisponibles, votacionAHeredar, type AlineacionAnterior } from "./index";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2026, 10, 1, 12);
const en = (ms: number) => new Date(T + ms);

function partido(id: string, inicio: Date, extra: Partial<PartidoCalendario> = {}): PartidoCalendario {
  return { id, inicio, estado: "programado", creadoEn: en(-30 * DIA), ...extra };
}

describe("votacionAHeredar", () => {
  it("sin Votación abierta no hay nada que heredar", () => {
    const partidos = [partido("a", en(0)), partido("b", en(7 * DIA))];
    // Durante el Partido "a": la de "a" cerró y la de "b" todavía no abrió.
    expect(votacionAHeredar(partidos, en(HORA))).toBeNull();
  });

  it("la Votación abierta hereda del Partido anterior del Club", () => {
    const partidos = [partido("b", en(7 * DIA)), partido("a", en(0))];
    expect(votacionAHeredar(partidos, en(3 * HORA))).toEqual({ partidoId: "b", anteriorId: "a", partidosAnteriores: ["a"] });
  });

  it("saltea los Partidos cancelados: hereda del último no cancelado", () => {
    const partidos = [
      partido("a", en(0)),
      partido("x", en(3 * DIA), { estado: "cancelado" }),
      partido("b", en(7 * DIA)),
    ];
    expect(votacionAHeredar(partidos, en(4 * DIA))).toEqual({ partidoId: "b", anteriorId: "a", partidosAnteriores: ["a"] });
  });

  it("lista todos los Partidos anteriores no cancelados, del más reciente al más antiguo (incluidos los que nunca abrieron)", () => {
    const partidos = [
      partido("c", en(7 * DIA)),
      partido("a", en(0)),
      // Empieza menos de 3 h después del inicio de "b": su Votación nunca abre.
      partido("n", en(3 * DIA + 2 * HORA)),
      partido("x", en(2 * DIA), { estado: "cancelado" }),
      partido("b", en(3 * DIA)),
      partido("despues", en(14 * DIA)),
    ];
    expect(votacionAHeredar(partidos, en(4 * DIA))).toEqual({
      partidoId: "c",
      anteriorId: "n",
      partidosAnteriores: ["n", "b", "a"],
    });
  });

  it("el primer Partido del Club no hereda de nadie", () => {
    const partidos = [partido("x", en(-DIA), { estado: "cancelado" }), partido("a", en(DIA))];
    expect(votacionAHeredar(partidos, en(0))).toBeNull();
  });
});

function jugador(id: string, posicionNatural: PosicionNatural, extra: Partial<JugadorDelPlantel> = {}): JugadorDelPlantel {
  return { id, posicionNatural, disponibilidad: "disponible", enPlantel: true, ...extra };
}

const plantel: JugadorDelPlantel[] = [
  jugador("arq", "ARQ"),
  jugador("def", "DEF"),
  jugador("med", "MED"),
  jugador("lesionado", "MED", { disponibilidad: "lesionado" }),
  jugador("seFue", "DEL", { enPlantel: false }),
];

const t1 = en(-5 * DIA);
const t2 = en(-4 * DIA);

const anteriorCompleta: Alineacion = {
  esquema: "4-4-2",
  esquemaElegidoAMano: true,
  esquemaModificadoEn: t1,
  puestos: {
    ARQ: { jugadorId: "arq", modificadoEn: t1 },
    LI: { jugadorId: "def", modificadoEn: t2 },
    MC_I: { jugadorId: "lesionado", modificadoEn: t1 },
    MC_D: { jugadorId: "med", modificadoEn: t2 },
    DEL_I: { jugadorId: "seFue", modificadoEn: t1 },
  },
};

function anterior(hinchaId: string, alineacion: Alineacion = anteriorCompleta, extra: Partial<AlineacionAnterior> = {}): AlineacionAnterior {
  return { hinchaId, partidoId: "p1", clubFavorito: "penarol", alineacion, ...extra };
}

/** Partidos anteriores al abierto, del más reciente al más antiguo. */
const partidosAnteriores = ["p1", "p0"];

describe("alineacionesAHeredar", () => {
  it("hereda la Alineación anterior sin no Disponibles ni bajas, conservando horas y Esquema elegido a mano", () => {
    const herencias = alineacionesAHeredar({ club: "penarol", partidosAnteriores, anteriores: [anterior("h1")], yaTienen: [], plantel });
    expect(herencias).toEqual([
      {
        hinchaId: "h1",
        alineacion: {
          esquema: "4-4-2",
          esquemaElegidoAMano: true,
          esquemaModificadoEn: t1,
          puestos: {
            ARQ: { jugadorId: "arq", modificadoEn: t1 },
            LI: { jugadorId: "def", modificadoEn: t2 },
            MC_D: { jugadorId: "med", modificadoEn: t2 },
          },
        },
      },
    ]);
  });

  it("no toca a los Hinchas que ya tienen Alineación para el Partido abierto", () => {
    const herencias = alineacionesAHeredar({
      club: "penarol",
      partidosAnteriores,
      anteriores: [anterior("h1"), anterior("h2")],
      yaTienen: new Set(["h1"]),
      plantel,
    });
    expect(herencias.map((h) => h.hinchaId)).toEqual(["h2"]);
  });

  it("no hereda a un Hincha que hoy es de otro Club (o que no tiene Club)", () => {
    const herencias = alineacionesAHeredar({
      club: "penarol",
      partidosAnteriores,
      anteriores: [anterior("h1", anteriorCompleta, { clubFavorito: "nacional" }), anterior("h2", anteriorCompleta, { clubFavorito: null }), anterior("h3")],
      yaTienen: [],
      plantel,
    });
    expect(herencias.map((h) => h.hinchaId)).toEqual(["h3"]);
  });

  it("no crea Alineaciones vacías (no serían voto): sin Jugadores que queden y sin Esquema elegido a mano", () => {
    const soloBajas: Alineacion = {
      esquema: "4-3-3",
      esquemaElegidoAMano: false,
      puestos: { CINCO: { jugadorId: "lesionado", modificadoEn: t1 } },
    };
    const soloEsquema: Alineacion = { ...soloBajas, esquema: "3-5-2", esquemaElegidoAMano: true, esquemaModificadoEn: t1, puestos: {} };
    const herencias = alineacionesAHeredar({
      club: "penarol",
      partidosAnteriores,
      anteriores: [anterior("vacia", soloBajas), anterior("conEsquema", soloEsquema)],
      yaTienen: [],
      plantel,
    });
    expect(herencias).toEqual([{ hinchaId: "conEsquema", alineacion: soloEsquema }]);
  });
});

describe("alineacionesAHeredar: la Alineación más reciente de cada Hincha", () => {
  const vieja: Alineacion = { esquema: "4-3-3", esquemaElegidoAMano: false, puestos: { ARQ: { jugadorId: "arq", modificadoEn: t1 } } };
  const nueva: Alineacion = { esquema: "4-4-2", esquemaElegidoAMano: false, puestos: { LI: { jugadorId: "def", modificadoEn: t2 } } };

  it("un Hincha sin Alineación en el último Partido hereda la de un Partido más viejo (ADR-0002)", () => {
    const herencias = alineacionesAHeredar({
      club: "penarol",
      partidosAnteriores,
      anteriores: [anterior("inactivo", vieja, { partidoId: "p0" })],
      yaTienen: [],
      plantel,
    });
    expect(herencias).toEqual([{ hinchaId: "inactivo", alineacion: vieja }]);
  });

  it("si tiene varias, hereda la del Partido más reciente (sin importar el orden de entrada)", () => {
    const herencias = alineacionesAHeredar({
      club: "penarol",
      partidosAnteriores,
      anteriores: [anterior("h1", vieja, { partidoId: "p0" }), anterior("h1", nueva, { partidoId: "p1" }), anterior("h2", nueva, { partidoId: "p1" }), anterior("h2", vieja, { partidoId: "p0" })],
      yaTienen: [],
      plantel,
    });
    expect(herencias).toEqual([
      { hinchaId: "h1", alineacion: nueva },
      { hinchaId: "h2", alineacion: nueva },
    ]);
  });

  it("ignora Alineaciones de Partidos que no están entre los anteriores (cancelados, posteriores)", () => {
    const herencias = alineacionesAHeredar({
      club: "penarol",
      partidosAnteriores,
      anteriores: [anterior("h1", nueva, { partidoId: "cancelado" }), anterior("h1", vieja, { partidoId: "p0" }), anterior("h2", nueva, { partidoId: "cancelado" })],
      yaTienen: [],
      plantel,
    });
    expect(herencias).toEqual([{ hinchaId: "h1", alineacion: vieja }]);
  });
});

describe("jugadoresNoDisponibles", () => {
  it("lista, en el orden del Esquema, los Jugadores colocados que no están Disponibles o salieron del Plantel, con el motivo", () => {
    const conDesconocido: Alineacion = {
      ...anteriorCompleta,
      puestos: { ...anteriorCompleta.puestos, DEL_D: { jugadorId: "fantasma", modificadoEn: t1 } },
    };
    expect(jugadoresNoDisponibles(conDesconocido, plantel)).toEqual([
      { puesto: "MC_I", jugadorId: "lesionado", motivo: "lesionado" },
      { puesto: "DEL_I", jugadorId: "seFue", motivo: "fuera_del_plantel" },
      { puesto: "DEL_D", jugadorId: "fantasma", motivo: "fuera_del_plantel" },
    ]);
  });

  it("una Alineación con todos Disponibles no tiene avisos", () => {
    const sana = alineacionesAHeredar({ club: "penarol", partidosAnteriores, anteriores: [anterior("h1")], yaTienen: [], plantel })[0]!.alineacion;
    expect(jugadoresNoDisponibles(sana, plantel)).toEqual([]);
  });
});

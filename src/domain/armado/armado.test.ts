import { describe, expect, it } from "vitest";
import { SELECCION, type PosicionNatural } from "@/domain/comun/tipos";
import type { PartidoCalendario } from "@/domain/calendario";
import { alineacionNueva, type Alineacion, type JugadorDelPlantel } from "@/domain/editor";
import {
  alineacionDesdeFila,
  filaDesdeAlineacion,
  textoCuentaRegresiva,
  validarAlineacion,
  votacionEnPantalla,
  votacionesEnPantalla,
} from "./index";

const t = (iso: string) => new Date(iso);

function partido(id: string, inicio: string, estado: PartidoCalendario["estado"] = "programado"): PartidoCalendario {
  return { id, inicio: t(inicio), creadoEn: t("2026-10-01T00:00:00Z"), estado };
}

describe("votacionEnPantalla", () => {
  const ahora = t("2026-11-10T12:00:00Z");

  it("sin Partidos no hay nada que mostrar", () => {
    expect(votacionEnPantalla([], ahora)).toBeNull();
  });

  it("si todos los Partidos terminaron no hay nada que mostrar", () => {
    expect(votacionEnPantalla([partido("viejo", "2026-11-09T23:00:00Z")], ahora)).toBeNull();
  });

  it("muestra la Votación abierta", () => {
    const partidos = [partido("pasado", "2026-11-05T23:00:00Z"), partido("proximo", "2026-11-12T23:00:00Z"), partido("despues", "2026-11-19T23:00:00Z")];
    expect(votacionEnPantalla(partidos, ahora)).toMatchObject({ partidoId: "proximo", estado: "abierta" });
  });

  it("durante el Partido muestra su Votación cerrada (no la del siguiente, que abre al terminar)", () => {
    const partidos = [partido("enJuego", "2026-11-10T11:00:00Z"), partido("siguiente", "2026-11-14T23:00:00Z")];
    expect(votacionEnPantalla(partidos, ahora)).toMatchObject({ partidoId: "enJuego", estado: "cerrada" });
  });

  it("entre el cierre y el inicio muestra la Votación cerrada", () => {
    const partidos = [partido("yaCerro", "2026-11-10T12:30:00Z")];
    expect(votacionEnPantalla(partidos, ahora)).toMatchObject({ partidoId: "yaCerro", estado: "cerrada" });
  });

  it("si el próximo Partido está cancelado y no hay Votación abierta, muestra la anulada", () => {
    const partidos = [partido("enJuego", "2026-11-10T11:00:00Z"), partido("cancelado", "2026-11-10T13:00:00Z", "cancelado")];
    const conCancelado = [partido("cancelado", "2026-11-10T20:00:00Z", "cancelado")];
    expect(votacionEnPantalla(partidos, ahora)).toMatchObject({ partidoId: "enJuego" });
    expect(votacionEnPantalla(conCancelado, ahora)).toMatchObject({ partidoId: "cancelado", estado: "anulada" });
  });

  it("la abierta tiene prioridad sobre un cancelado anterior", () => {
    const partidos = [partido("cancelado", "2026-11-11T23:00:00Z", "cancelado"), partido("proximo", "2026-11-12T23:00:00Z")];
    expect(votacionEnPantalla(partidos, ahora)).toMatchObject({ partidoId: "proximo", estado: "abierta" });
  });

  it("muestra una Votación pendiente con su hora de apertura", () => {
    const cargadoDespues = { ...partido("futuro", "2026-11-12T23:00:00Z"), creadoEn: t("2026-11-10T13:00:00Z") };
    expect(votacionEnPantalla([cargadoDespues], ahora)).toEqual({
      partidoId: "futuro",
      estado: "pendiente",
      abre: t("2026-11-10T13:00:00Z"),
      cierra: t("2026-11-12T22:00:00Z"),
    });
  });

  describe("con 11 Elegido congelado (la Votación ya cerró y el Partido se postergó)", () => {
    it("aunque el Calendario la vea abierta, la muestra cerrada: no se reabre", () => {
      // Se suspendió en la última hora y pasó al 12: el Calendario la ve abierta.
      const postergado = partido("postergado", "2026-11-12T23:00:00Z");
      const siguiente = partido("siguiente", "2026-11-19T23:00:00Z");
      expect(votacionEnPantalla([postergado, siguiente], ahora)).toMatchObject({ partidoId: "postergado", estado: "abierta" });
      expect(votacionEnPantalla([postergado, siguiente], ahora, new Set(["postergado"]))).toMatchObject({
        partidoId: "postergado",
        estado: "cerrada",
      });
    });

    it("aunque el Calendario la vea pendiente, la muestra cerrada", () => {
      const enJuego = partido("enJuego", "2026-11-10T11:00:00Z");
      const postergado = partido("postergado", "2026-11-12T23:00:00Z");
      expect(votacionEnPantalla([enJuego, postergado], t("2026-11-10T14:00:00Z"), new Set(["postergado"]))).toMatchObject({
        partidoId: "postergado",
        estado: "cerrada",
      });
    });

    it("si se canceló, la sigue mostrando anulada (la pantalla aclara que el 11 Elegido quedó igual)", () => {
      const cancelado = partido("cancelado", "2026-11-10T20:00:00Z", "cancelado");
      expect(votacionEnPantalla([cancelado], ahora, new Set(["cancelado"]))).toMatchObject({
        partidoId: "cancelado",
        estado: "anulada",
      });
    });
  });
});

describe("votacionesEnPantalla", () => {
  const ahora = t("2026-11-10T12:00:00Z");
  const ida = partido("ida", "2026-11-14T23:00:00Z");
  const vuelta = partido("vuelta", "2026-11-19T23:00:00Z");

  it("en la Selección, con una fecha doble, muestra las dos Votaciones abiertas en orden", () => {
    expect(votacionesEnPantalla([vuelta, ida], ahora, new Set(), SELECCION)).toMatchObject([
      { partidoId: "ida", estado: "abierta" },
      { partidoId: "vuelta", estado: "abierta" },
    ]);
  });

  it("en la Selección, sin Votaciones abiertas, muestra solo el próximo Partido", () => {
    const lejos = partido("lejos", "2026-12-30T23:00:00Z");
    expect(votacionesEnPantalla([lejos], ahora, new Set(), SELECCION)).toMatchObject([{ partidoId: "lejos", estado: "pendiente" }]);
    expect(votacionesEnPantalla([], ahora, new Set(), SELECCION)).toEqual([]);
  });

  it("en la Selección, una Votación con 11 Elegido congelado no cuenta como abierta", () => {
    expect(votacionesEnPantalla([ida, vuelta], ahora, new Set(["ida"]), SELECCION)).toMatchObject([{ partidoId: "vuelta" }]);
  });

  it("en un Club es a lo sumo una, la de votacionEnPantalla", () => {
    expect(votacionesEnPantalla([ida, vuelta], ahora, new Set(), "penarol")).toEqual([votacionEnPantalla([ida, vuelta], ahora)]);
  });
});

describe("textoCuentaRegresiva", () => {
  const s = 1000;
  const min = 60 * s;
  const h = 60 * min;
  const d = 24 * h;

  it("muestra desde la unidad más grande hasta los segundos", () => {
    expect(textoCuentaRegresiva(2 * d + 3 * h + 5 * min + 9 * s)).toBe("2 d 3 h 5 min 9 s");
    expect(textoCuentaRegresiva(3 * h + 9 * s)).toBe("3 h 0 min 9 s");
    expect(textoCuentaRegresiva(5 * min)).toBe("5 min 0 s");
    expect(textoCuentaRegresiva(42 * s)).toBe("42 s");
  });

  it("redondea hacia abajo los milisegundos y no baja de cero", () => {
    expect(textoCuentaRegresiva(1999)).toBe("1 s");
    expect(textoCuentaRegresiva(0)).toBe("0 s");
    expect(textoCuentaRegresiva(-5000)).toBe("0 s");
  });
});

function jugador(id: string, posicionNatural: PosicionNatural, extra: Partial<JugadorDelPlantel> = {}): JugadorDelPlantel {
  return { id, posicionNatural, disponibilidad: "disponible", enPlantel: true, ...extra };
}

const plantel = [
  jugador("arq", "ARQ"),
  jugador("def", "DEF"),
  jugador("med", "MED"),
  jugador("lesionado", "MED", { disponibilidad: "lesionado" }),
  jugador("seFue", "DEL", { enPlantel: false }),
];

const t0 = t("2026-11-10T12:00:00Z");

function con(puestos: Record<string, string>, base: Alineacion = alineacionNueva()): Alineacion {
  return {
    ...base,
    puestos: Object.fromEntries(Object.entries(puestos).map(([p, jugadorId]) => [p, { jugadorId, modificadoEn: t0 }])),
  };
}

describe("validarAlineacion", () => {
  it("acepta una Alineación vacía o con Jugadores Disponibles en Puestos válidos", () => {
    expect(validarAlineacion(alineacionNueva(), null, plantel)).toEqual({ ok: true });
    expect(validarAlineacion(con({ ARQ: "arq", LI: "def", CINCO: "med" }), null, plantel)).toEqual({ ok: true });
  });

  it("rechaza Jugadores que no son del Plantel del Club", () => {
    expect(validarAlineacion(con({ LI: "otroClub" }), null, plantel)).toEqual({ ok: false, motivo: "jugador_desconocido" });
  });

  it("aplica la regla del arquero", () => {
    expect(validarAlineacion(con({ LI: "arq" }), null, plantel)).toEqual({ ok: false, motivo: "arquero_fuera_del_arco" });
    expect(validarAlineacion(con({ ARQ: "def" }), null, plantel)).toEqual({ ok: false, motivo: "arco_solo_para_arqueros" });
  });

  it("rechaza elegir a un Jugador no Disponible o que salió del Plantel", () => {
    expect(validarAlineacion(con({ CINCO: "lesionado" }), null, plantel)).toEqual({ ok: false, motivo: "jugador_no_disponible" });
    expect(validarAlineacion(con({ DEL: "seFue" }), null, plantel)).toEqual({ ok: false, motivo: "jugador_fuera_del_plantel" });
  });

  it("deja conservar (y mover) a un Jugador que ya estaba guardado aunque haya dejado de estar Disponible", () => {
    const guardada = con({ CINCO: "lesionado", DEL: "seFue" });
    expect(validarAlineacion(con({ INT_I: "lesionado", EXT_I: "seFue" }), guardada, plantel)).toEqual({ ok: true });
  });
});

describe("filas de la tabla alineacion", () => {
  const alineacion: Alineacion = {
    esquema: "4-4-2",
    esquemaElegidoAMano: true,
    esquemaModificadoEn: t0,
    puestos: { ARQ: { jugadorId: "arq", modificadoEn: t0 } },
  };

  it("ida y vuelta conserva la Alineación", () => {
    const fila = filaDesdeAlineacion(alineacion);
    expect(fila).toEqual({
      esquema: "4-4-2",
      esquema_elegido_a_mano: true,
      esquema_modificado_en: "2026-11-10T12:00:00.000Z",
      puestos: { ARQ: { jugadorId: "arq", modificadoEn: "2026-11-10T12:00:00.000Z" } },
    });
    expect(alineacionDesdeFila(fila)).toEqual(alineacion);
  });

  it("lee las horas como las devuelve Postgres (con +00:00)", () => {
    const leida = alineacionDesdeFila({
      esquema: "4-4-2",
      esquema_elegido_a_mano: true,
      esquema_modificado_en: "2026-11-10T12:00:00+00:00",
      puestos: { ARQ: { jugadorId: "arq", modificadoEn: "2026-11-10T12:00:00.000Z" } },
    });
    expect(leida).toEqual(alineacion);
  });

  it("sin esquema de modificación, no lo inventa", () => {
    const fila = filaDesdeAlineacion(alineacionNueva());
    expect(fila.esquema_modificado_en).toBeNull();
    expect(alineacionDesdeFila(fila)).toEqual(alineacionNueva());
  });

  it("una fila ilegible se lee como Alineación nueva", () => {
    expect(alineacionDesdeFila({ esquema: "9-9-9", esquema_elegido_a_mano: true, esquema_modificado_en: null, puestos: null })).toEqual(
      alineacionNueva(),
    );
  });
});

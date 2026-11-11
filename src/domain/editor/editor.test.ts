import { describe, expect, it } from "vitest";
import type { PosicionNatural } from "@/domain/comun/tipos";
import { ESQUEMA_IDS, esPuestoDe, esquema } from "@/domain/esquemas";
import {
  aJson,
  alineacionNueva,
  desdeJson,
  banco,
  buscarPorNombre,
  estaVacia,
  heredar,
  cambiarEsquema,
  colocar,
  mover,
  quitar,
  type Alineacion,
  type JugadorDelPlantel,
  type ResultadoOperacion,
} from "./index";

const t0 = new Date("2026-11-10T12:00:00Z");
const t1 = new Date("2026-11-10T12:05:00Z");
const t2 = new Date("2026-11-10T12:10:00Z");

function jugador(id: string, posicionNatural: PosicionNatural, extra: Partial<JugadorDelPlantel> = {}): JugadorDelPlantel {
  return { id, posicionNatural, disponibilidad: "disponible", enPlantel: true, ...extra };
}

const plantel: JugadorDelPlantel[] = [
  jugador("arq1", "ARQ"),
  jugador("arq2", "ARQ"),
  jugador("def1", "DEF"),
  jugador("def2", "DEF"),
  jugador("def3", "DEF"),
  jugador("med1", "MED"),
  jugador("med2", "MED"),
  jugador("del1", "DEL"),
  jugador("del2", "DEL"),
  jugador("lesionado", "MED", { disponibilidad: "lesionado" }),
  jugador("suspendido", "DEL", { disponibilidad: "suspendido" }),
  jugador("seFue", "DEF", { enPlantel: false }),
];

/** Desenvuelve un resultado que se espera exitoso. */
function ok(r: ResultadoOperacion): Alineacion {
  if (!r.ok) throw new Error(`Se esperaba ok, vino rechazo: ${r.motivo}`);
  return r.estado;
}

/** Copia profunda para verificar que una operación no muta su entrada. */
function copia(a: Alineacion): Alineacion {
  return structuredClone(a);
}

describe("Editor de Alineación", () => {
  describe("alineación nueva", () => {
    it("empieza con el Esquema por defecto, sin elegir a mano y sin Jugadores", () => {
      expect(alineacionNueva()).toEqual({ esquema: "4-3-3", esquemaElegidoAMano: false, puestos: {} });
    });
  });

  describe("colocar desde el Plantel", () => {
    it("ubica al Jugador en un Puesto vacío con la hora de modificación", () => {
      const a = ok(colocar(alineacionNueva(), "def1", "LI", plantel, t0));
      expect(a.puestos).toEqual({ LI: { jugadorId: "def1", modificadoEn: t0 } });
    });

    it("si el Puesto está ocupado, reemplaza al anterior (vuelve al Plantel)", () => {
      const a = ok(colocar(alineacionNueva(), "def1", "LI", plantel, t0));
      const b = ok(colocar(a, "def2", "LI", plantel, t1));
      expect(b.puestos).toEqual({ LI: { jugadorId: "def2", modificadoEn: t1 } });
    });

    it("solo actualiza la hora del Puesto afectado", () => {
      const a = ok(colocar(alineacionNueva(), "def1", "LI", plantel, t0));
      const b = ok(colocar(a, "def2", "LD", plantel, t1));
      expect(b.puestos.LI).toEqual({ jugadorId: "def1", modificadoEn: t0 });
      expect(b.puestos.LD).toEqual({ jugadorId: "def2", modificadoEn: t1 });
    });

    it("no muta la Alineación original", () => {
      const a = ok(colocar(alineacionNueva(), "def1", "LI", plantel, t0));
      const antes = copia(a);
      ok(colocar(a, "def2", "LI", plantel, t1));
      expect(a).toEqual(antes);
    });

    it("no cambia la marca de Esquema elegido a mano", () => {
      const a = ok(colocar(alineacionNueva(), "def1", "LI", plantel, t0));
      expect(a.esquemaElegidoAMano).toBe(false);
    });

    it.each([
      ["un Jugador que ya está en otro Puesto", "def1", "LD", "jugador_ya_colocado"],
      ["un Jugador que ya está en ese mismo Puesto", "def1", "LI", "jugador_ya_colocado"],
      ["un Puesto que no es del Esquema", "def2", "ZAG_C", "puesto_fuera_del_esquema"],
      ["un Jugador que no está en la lista", "nadie", "LD", "jugador_desconocido"],
      ["un Jugador que salió del Plantel", "seFue", "LD", "jugador_fuera_del_plantel"],
      ["un Jugador Lesionado", "lesionado", "INT_I", "jugador_no_disponible"],
      ["un Jugador Suspendido", "suspendido", "DEL", "jugador_no_disponible"],
      ["un arquero fuera del arco", "arq1", "LD", "arquero_fuera_del_arco"],
      ["un jugador de campo en el arco", "def2", "ARQ", "arco_solo_para_arqueros"],
    ] as const)("rechaza %s sin cambiar el estado", (_, jugadorId, puesto, motivo) => {
      const a = ok(colocar(alineacionNueva(), "def1", "LI", plantel, t0));
      const antes = copia(a);
      expect(colocar(a, jugadorId, puesto, plantel, t1)).toEqual({ ok: false, motivo });
      expect(a).toEqual(antes);
    });

    it("un arquero entra al arco", () => {
      const a = ok(colocar(alineacionNueva(), "arq1", "ARQ", plantel, t2));
      expect(a.puestos.ARQ).toEqual({ jugadorId: "arq1", modificadoEn: t2 });
    });
  });

  describe("mover entre Puestos", () => {
    // ARQ arq1 (t0), LI def1 (t0), LD def2 (t1)
    const base = ok(colocar(ok(colocar(ok(colocar(alineacionNueva(), "arq1", "ARQ", plantel, t0)), "def1", "LI", plantel, t0)), "def2", "LD", plantel, t1));

    it("mueve a un Puesto vacío: el origen queda vacío y el destino toma la hora", () => {
      const a = ok(mover(base, "LI", "ZAG_I", plantel, t2));
      expect(a.puestos.LI).toBeUndefined();
      expect(a.puestos.ZAG_I).toEqual({ jugadorId: "def1", modificadoEn: t2 });
      expect(a.puestos.LD).toEqual({ jugadorId: "def2", modificadoEn: t1 });
      expect(a.puestos.ARQ).toEqual({ jugadorId: "arq1", modificadoEn: t0 });
    });

    it("si el destino está ocupado, se intercambian y los dos Puestos toman la hora", () => {
      const a = ok(mover(base, "LI", "LD", plantel, t2));
      expect(a.puestos.LI).toEqual({ jugadorId: "def2", modificadoEn: t2 });
      expect(a.puestos.LD).toEqual({ jugadorId: "def1", modificadoEn: t2 });
      expect(a.puestos.ARQ).toEqual({ jugadorId: "arq1", modificadoEn: t0 });
    });

    it("mover a su mismo Puesto no cambia nada", () => {
      expect(mover(base, "LI", "LI", plantel, t2)).toEqual({ ok: true, estado: base });
    });

    it("se puede mover a un Jugador que dejó de estar Disponible", () => {
      const lesionadoDespues = plantel.map((j) => (j.id === "def1" ? { ...j, disponibilidad: "lesionado" as const } : j));
      const a = ok(mover(base, "LI", "ZAG_D", lesionadoDespues, t2));
      expect(a.puestos.ZAG_D?.jugadorId).toBe("def1");
    });

    it.each([
      ["desde un Puesto vacío", "ZAG_I", "LI", plantel, "puesto_vacio"],
      ["a un Puesto que no es del Esquema", "LI", "ZAG_C", plantel, "puesto_fuera_del_esquema"],
      ["el arquero fuera del arco", "ARQ", "ZAG_I", plantel, "arquero_fuera_del_arco"],
      ["un jugador de campo al arco (intercambio con el arquero)", "LI", "ARQ", plantel, "arco_solo_para_arqueros"],
      ["un Jugador que no está en la lista", "LI", "ZAG_I", plantel.filter((j) => j.id !== "def1"), "jugador_desconocido"],
    ] as const)("rechaza %s sin cambiar el estado", (_, origen, destino, lista, motivo) => {
      const antes = copia(base);
      expect(mover(base, origen, destino, lista, t2)).toEqual({ ok: false, motivo });
      expect(base).toEqual(antes);
    });

    it("un Jugador nunca queda en dos Puestos", () => {
      const a = ok(mover(ok(mover(base, "LI", "LD", plantel, t1)), "LD", "ZAG_I", plantel, t2));
      const ids = Object.values(a.puestos).map((p) => p.jugadorId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.sort()).toEqual(["arq1", "def1", "def2"]);
    });
  });

  describe("quitar", () => {
    const base = ok(colocar(ok(colocar(alineacionNueva(), "def1", "LI", plantel, t0)), "def2", "LD", plantel, t0));

    it("deja el Puesto vacío y no toca los demás", () => {
      const a = ok(quitar(base, "LI"));
      expect(a.puestos).toEqual({ LD: { jugadorId: "def2", modificadoEn: t0 } });
      expect(base.puestos.LI).toBeDefined();
    });

    it.each([
      ["un Puesto vacío", "ZAG_I", "puesto_vacio"],
      ["un Puesto que no es del Esquema", "ZAG_C", "puesto_fuera_del_esquema"],
    ] as const)("rechaza quitar de %s", (_, puesto, motivo) => {
      expect(quitar(base, puesto)).toEqual({ ok: false, motivo });
    });
  });

  describe("cambiar de Esquema", () => {
    /** Arma una Alineación directamente (los Jugadores pueden repetir hora). */
    function armada(esquema: Alineacion["esquema"], puestos: Alineacion["puestos"]): Alineacion {
      return { esquema, esquemaElegidoAMano: false, puestos };
    }
    const en = (jugadorId: string, modificadoEn = t0) => ({ jugadorId, modificadoEn });

    it("reubica por la Tabla de Equivalencias y marca el Esquema como elegido a mano", () => {
      const a = armada("4-4-2", { ARQ: en("arq1"), LI: en("def1"), DEL_I: en("del1"), MC_I: en("med1") });
      const b = ok(cambiarEsquema(a, "4-3-3", t2));
      expect(b).toEqual({
        esquema: "4-3-3",
        esquemaElegidoAMano: true,
        esquemaModificadoEn: t2,
        puestos: {
          // Los que se quedan en el mismo Puesto conservan su hora.
          ARQ: en("arq1"),
          LI: en("def1"),
          // Los que cambian de Puesto toman la hora del cambio.
          INT_I: en("del1", t2),
          CINCO: en("med1", t2),
        },
      });
    });

    it("si dos caen en el mismo Puesto, se queda el que va antes en el Esquema de origen y el otro vuelve al Plantel", () => {
      // 4-3-3 → 4-4-2: el cinco y el interior izquierdo van los dos al volante central izquierdo.
      const a = armada("4-3-3", { CINCO: en("med1"), INT_I: en("med2") });
      const b = ok(cambiarEsquema(a, "4-4-2", t2));
      expect(b.puestos).toEqual({ MC_I: en("med1", t2) });
    });

    it("en una colisión gana el que ya estaba en ese mismo Puesto, aunque vaya después", () => {
      // 3-5-2 → 4-3-3: el zaguero central va al zaguero derecho, donde ya está el zaguero derecho.
      const a = armada("3-5-2", { ZAG_C: en("def1"), ZAG_D: en("def2") });
      const b = ok(cambiarEsquema(a, "4-3-3", t2));
      expect(b.puestos).toEqual({ ZAG_D: en("def2") });
    });

    it("con dos delanteros a un solo 9 se queda el izquierdo (va antes en el 3-5-2)", () => {
      const a = armada("3-5-2", { DEL_I: en("del1"), DEL_D: en("del2") });
      expect(ok(cambiarEsquema(a, "4-3-3", t2)).puestos).toEqual({ DEL: en("del1", t2) });
    });

    it("elegir el mismo Esquema que se mostraba por defecto lo marca como elegido a mano", () => {
      const a = armada("4-3-3", { LI: en("def1") });
      expect(ok(cambiarEsquema(a, "4-3-3", t2))).toEqual({
        esquema: "4-3-3",
        esquemaElegidoAMano: true,
        esquemaModificadoEn: t2,
        puestos: { LI: en("def1") },
      });
    });

    it("elegir de nuevo el Esquema ya elegido a mano no cambia nada", () => {
      const a = ok(cambiarEsquema(alineacionNueva(), "4-4-2", t1));
      expect(cambiarEsquema(a, "4-4-2", t2)).toEqual({ ok: true, estado: a });
    });

    it.each(ESQUEMA_IDS.flatMap((o) => ESQUEMA_IDS.filter((d) => d !== o).map((d) => [o, d] as const)))(
      "de %s a %s con los 11 Puestos ocupados: nadie repetido, todos en Puestos del destino y el arquero en el arco",
      (origen, destino) => {
        const puestos = Object.fromEntries(esquema(origen).puestos.map((p) => [p.id, en(`j-${p.id}`)]));
        const b = ok(cambiarEsquema(armada(origen, puestos), destino, t2));
        const entradas = Object.entries(b.puestos);
        const ids = entradas.map(([, o]) => o.jugadorId);
        expect(new Set(ids).size).toBe(ids.length);
        expect(entradas.every(([p]) => esPuestoDe(destino, p))).toBe(true);
        expect(b.puestos.ARQ?.jugadorId).toBe("j-ARQ");
      },
    );

    it("no muta la Alineación original", () => {
      const a = armada("4-3-3", { CINCO: en("med1"), INT_I: en("med2") });
      const antes = copia(a);
      ok(cambiarEsquema(a, "4-4-2", t2));
      expect(a).toEqual(antes);
    });
  });

  describe("heredar", () => {
    const anterior: Alineacion = {
      esquema: "4-4-2",
      esquemaElegidoAMano: true,
      esquemaModificadoEn: t0,
      puestos: {
        ARQ: { jugadorId: "arq1", modificadoEn: t0 },
        LI: { jugadorId: "seFue", modificadoEn: t0 },
        MC_I: { jugadorId: "lesionado", modificadoEn: t1 },
        VOL_D: { jugadorId: "med1", modificadoEn: t1 },
        DEL_D: { jugadorId: "noExiste", modificadoEn: t1 },
        DEL_I: { jugadorId: "del1", modificadoEn: t2 },
      },
    };

    it("quita a los no Disponibles y a los que salieron del Plantel, y conserva todo lo demás con sus horas", () => {
      expect(heredar(anterior, plantel)).toEqual({
        esquema: "4-4-2",
        esquemaElegidoAMano: true,
        esquemaModificadoEn: t0,
        puestos: {
          ARQ: { jugadorId: "arq1", modificadoEn: t0 },
          VOL_D: { jugadorId: "med1", modificadoEn: t1 },
          DEL_I: { jugadorId: "del1", modificadoEn: t2 },
        },
      });
    });

    it("quita a un Jugador que ya no cumple la regla del arquero (cambió su posición natural)", () => {
      const cambio = plantel.map((j) => (j.id === "arq1" ? { ...j, posicionNatural: "DEF" as const } : j));
      expect(heredar(anterior, cambio).puestos.ARQ).toBeUndefined();
    });

    it("no muta la Alineación anterior", () => {
      const antes = copia(anterior);
      heredar(anterior, plantel);
      expect(anterior).toEqual(antes);
    });

    it("si no queda nadie y el Esquema no se eligió a mano, la heredada está vacía", () => {
      const a: Alineacion = { esquema: "4-3-3", esquemaElegidoAMano: false, puestos: { INT_I: { jugadorId: "lesionado", modificadoEn: t0 } } };
      expect(estaVacia(heredar(a, plantel))).toBe(true);
    });
  });

  describe("estaVacia", () => {
    it("una Alineación nueva está vacía (no cuenta como voto)", () => {
      expect(estaVacia(alineacionNueva())).toBe(true);
    });

    it("con un Jugador colocado no está vacía", () => {
      expect(estaVacia(ok(colocar(alineacionNueva(), "def1", "LI", plantel, t0)))).toBe(false);
    });

    it("con el Esquema elegido a mano no está vacía, aunque no tenga Jugadores", () => {
      expect(estaVacia(ok(cambiarEsquema(alineacionNueva(), "4-4-2", t0)))).toBe(false);
    });
  });

  describe("banco", () => {
    it("son los Jugadores Disponibles del Plantel que no están en la cancha, en el orden recibido", () => {
      const a = ok(colocar(ok(colocar(alineacionNueva(), "def1", "LI", plantel, t0)), "arq1", "ARQ", plantel, t0));
      expect(banco(a, plantel).map((j) => j.id)).toEqual(["arq2", "def2", "def3", "med1", "med2", "del1", "del2"]);
    });

    it("conserva los datos extra de cada Jugador", () => {
      const conNombre = [{ ...jugador("def1", "DEF"), nombre: "Pérez", numero: 2 }];
      expect(banco(alineacionNueva(), conNombre)).toEqual(conNombre);
    });
  });

  describe("serialización", () => {
    const completa: Alineacion = {
      esquema: "4-4-2",
      esquemaElegidoAMano: true,
      esquemaModificadoEn: new Date("2026-11-10T11:59:59.123Z"),
      puestos: {
        ARQ: { jugadorId: "arq1", modificadoEn: t0 },
        MC_I: { jugadorId: "med1", modificadoEn: t1 },
        DEL_D: { jugadorId: "del1", modificadoEn: t2 },
      },
    };

    it("serializa con las horas en ISO UTC", () => {
      expect(aJson(completa)).toEqual({
        esquema: "4-4-2",
        esquemaElegidoAMano: true,
        esquemaModificadoEn: "2026-11-10T11:59:59.123Z",
        puestos: {
          ARQ: { jugadorId: "arq1", modificadoEn: "2026-11-10T12:00:00.000Z" },
          MC_I: { jugadorId: "med1", modificadoEn: "2026-11-10T12:05:00.000Z" },
          DEL_D: { jugadorId: "del1", modificadoEn: "2026-11-10T12:10:00.000Z" },
        },
      });
    });

    it.each([
      ["completa", completa],
      ["nueva", alineacionNueva()],
    ])("serializar y deserializar devuelve la misma Alineación (%s)", (_, a) => {
      expect(desdeJson(aJson(a))).toEqual({ ok: true, estado: a });
      expect(desdeJson(JSON.parse(JSON.stringify(aJson(a))))).toEqual({ ok: true, estado: a });
      expect(desdeJson(JSON.stringify(aJson(a)))).toEqual({ ok: true, estado: a });
    });

    it("acepta horas ISO con desfasaje (como las devuelve Postgres)", () => {
      const r = desdeJson({ esquema: "4-3-3", esquemaElegidoAMano: false, puestos: { LI: { jugadorId: "def1", modificadoEn: "2026-11-10T09:00:00-03:00" } } });
      expect(r).toEqual({ ok: true, estado: { esquema: "4-3-3", esquemaElegidoAMano: false, puestos: { LI: { jugadorId: "def1", modificadoEn: t0 } } } });
    });

    describe("entrada no confiable", () => {
      it.each([
        ["null", null],
        ["un número", 3],
        ["un array", []],
        ["un string que no es JSON", "{nope"],
        ["sin Esquema", { esquemaElegidoAMano: true, puestos: {} }],
        ["un Esquema desconocido", { esquema: "2-3-5", esquemaElegidoAMano: true, puestos: {} }],
      ])("rechaza %s", (_, valor) => {
        expect(desdeJson(valor)).toEqual({ ok: false, motivo: "formato_invalido" });
      });

      it("descarta los Puestos inválidos y se queda con los válidos", () => {
        const r = desdeJson(
          JSON.parse(`{
            "esquema": "4-3-3",
            "esquemaElegidoAMano": "si",
            "esquemaModificadoEn": "ayer",
            "extra": 1,
            "puestos": {
              "LI": { "jugadorId": "def1", "modificadoEn": "2026-11-10T12:00:00Z", "extra": true },
              "MC_I": { "jugadorId": "med1", "modificadoEn": "2026-11-10T12:00:00Z" },
              "INVENTADO": { "jugadorId": "med2", "modificadoEn": "2026-11-10T12:00:00Z" },
              "__proto__": { "jugadorId": "med2", "modificadoEn": "2026-11-10T12:00:00Z" },
              "LD": { "jugadorId": "", "modificadoEn": "2026-11-10T12:00:00Z" },
              "ZAG_I": { "jugadorId": 7, "modificadoEn": "2026-11-10T12:00:00Z" },
              "ZAG_D": { "jugadorId": "def2", "modificadoEn": "no es fecha" },
              "CINCO": { "jugadorId": "med2", "modificadoEn": "2026-13-45T99:00:00Z" },
              "INT_I": { "jugadorId": "med2", "modificadoEn": 1762776000000 },
              "INT_D": null,
              "DEL": "del1",
              "ARQ": { "jugadorId": "arq1", "modificadoEn": "2026-11-10T12:00:00Z" }
            }
          }`),
        );
        expect(r).toEqual({
          ok: true,
          estado: {
            esquema: "4-3-3",
            esquemaElegidoAMano: false,
            puestos: { ARQ: { jugadorId: "arq1", modificadoEn: t0 }, LI: { jugadorId: "def1", modificadoEn: t0 } },
          },
        });
        expect(({} as Record<string, unknown>).jugadorId).toBeUndefined();
      });

      it("si un Jugador aparece en dos Puestos, se queda en el primero del Esquema", () => {
        const r = desdeJson({
          esquema: "4-3-3",
          esquemaElegidoAMano: true,
          puestos: {
            EXT_D: { jugadorId: "del1", modificadoEn: "2026-11-10T12:00:00Z" },
            DEL: { jugadorId: "del1", modificadoEn: "2026-11-10T12:00:00Z" },
          },
        });
        expect(r.ok && r.estado.puestos).toEqual({ DEL: { jugadorId: "del1", modificadoEn: t0 } });
      });

      it("puestos que no son un objeto cuentan como sin Jugadores", () => {
        expect(desdeJson({ esquema: "4-3-3", esquemaElegidoAMano: true, puestos: [1, 2] })).toEqual({
          ok: true,
          estado: { esquema: "4-3-3", esquemaElegidoAMano: true, puestos: {} },
        });
      });
    });
  });
});

describe("buscarPorNombre", () => {
  const jugadores = [{ nombre: "Darwin Núñez" }, { nombre: "Federico Valverde" }, { nombre: "Federico Viñas" }, { nombre: "Ronald Araújo" }];

  it("con la búsqueda vacía (o solo espacios) devuelve todos, en el mismo orden", () => {
    expect(buscarPorNombre(jugadores, "")).toEqual(jugadores);
    expect(buscarPorNombre(jugadores, "   ")).toEqual(jugadores);
  });

  it("no distingue mayúsculas ni tildes", () => {
    expect(buscarPorNombre(jugadores, "nunez")).toEqual([{ nombre: "Darwin Núñez" }]);
    expect(buscarPorNombre(jugadores, "ARAUJO")).toEqual([{ nombre: "Ronald Araújo" }]);
    expect(buscarPorNombre(jugadores, "viñas")).toEqual([{ nombre: "Federico Viñas" }]);
  });

  it("busca dentro del nombre y exige todas las palabras", () => {
    expect(buscarPorNombre(jugadores, "fede")).toEqual([{ nombre: "Federico Valverde" }, { nombre: "Federico Viñas" }]);
    expect(buscarPorNombre(jugadores, "fede  val")).toEqual([{ nombre: "Federico Valverde" }]);
    expect(buscarPorNombre(jugadores, "suárez")).toEqual([]);
  });

  it("devuelve los mismos objetos y no modifica la lista", () => {
    const copia = [...jugadores];
    expect(buscarPorNombre(jugadores, "darwin")[0]).toBe(jugadores[0]);
    expect(jugadores).toEqual(copia);
  });
});

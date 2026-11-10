import { describe, expect, it } from "vitest";
import type { PartidoCalendario } from "@/domain/calendario";
import {
  analizarCambio,
  rivalesParaPartido,
  validarAccion,
  validarPartido,
  validarRival,
  type RivalParaPartido,
  type SituacionPartido,
} from "./index";

describe("analizarCambio: avisos antes de guardar", () => {
  const ahora = new Date("2026-11-10T12:00:00Z");
  const t = (iso: string) => new Date(iso);
  const creadoHaceUnMes = "2026-10-10T12:00:00Z";
  const partido = (id: string, inicio: string, extra: Partial<PartidoCalendario> = {}): PartidoCalendario => ({
    id,
    inicio: t(inicio),
    creadoEn: t(creadoHaceUnMes),
    estado: "programado",
    ...extra,
  });
  // A ya se jugó; B tiene la Votación abierta (abre al terminar A).
  const a = partido("A", "2026-11-05T23:00:00Z");
  const b = partido("B", "2026-11-12T23:00:00Z");

  it("en la Selección usa su regla: con una fecha doble, postergar la vuelta afecta una Votación abierta", () => {
    const ida = partido("ida", "2026-11-14T23:00:00Z");
    const vuelta = partido("vuelta", "2026-11-19T23:00:00Z");
    const postergada = { ...vuelta, inicio: t("2026-11-29T23:00:00Z") };
    // Con la regla de los Clubes la vuelta está pendiente: no hay aviso.
    expect(analizarCambio([ida, vuelta], [ida, postergada], ahora)).toEqual([]);
    expect(analizarCambio([ida, vuelta], [ida, postergada], ahora, new Set(), "seleccion")).toMatchObject([
      { tipo: "afecta_votacion_abierta", partidoId: "vuelta", despues: { estado: "pendiente" } },
    ]);
  });

  it("sin efecto sobre Votaciones abiertas ni ventanas vacías, no avisa", () => {
    const c = partido("C", "2026-11-20T23:00:00Z", { creadoEn: ahora });
    expect(analizarCambio([a, b], [a, b, c], ahora)).toEqual([]);
  });

  it("avisa que la Votación nunca abriría si el Partido se carga menos de 1 hora antes de su inicio", () => {
    const tarde = partido("T", "2026-11-10T12:30:00Z", { creadoEn: ahora });
    expect(analizarCambio([], [tarde], ahora)).toEqual([{ tipo: "nunca_abre", partidoId: "T" }]);
  });

  it("avisa si la ventana queda vacía por empezar menos de 3 horas después del anterior", () => {
    const pegado = partido("P", "2026-11-13T01:30:00Z", { creadoEn: ahora });
    expect(analizarCambio([a, b], [a, b, pegado], ahora)).toEqual([{ tipo: "nunca_abre", partidoId: "P" }]);
  });

  it("no repite el aviso de una ventana que ya estaba vacía", () => {
    const tarde = partido("T", "2026-11-10T12:30:00Z", { creadoEn: ahora });
    expect(analizarCambio([tarde], [{ ...tarde, estado: "programado" }], ahora)).toEqual([]);
  });

  it("postergar el Partido con la Votación abierta la afecta (se mueve el cierre)", () => {
    const postergado = { ...b, inicio: t("2026-11-15T23:00:00Z") };
    expect(analizarCambio([a, b], [a, postergado], ahora)).toEqual([
      {
        tipo: "afecta_votacion_abierta",
        partidoId: "B",
        antes: { partidoId: "B", estado: "abierta", abre: t("2026-11-06T01:00:00Z"), cierra: t("2026-11-12T22:00:00Z") },
        despues: { partidoId: "B", estado: "abierta", abre: t("2026-11-06T01:00:00Z"), cierra: t("2026-11-15T22:00:00Z") },
      },
    ]);
  });

  it("cancelar el Partido con la Votación abierta la anula", () => {
    const avisos = analizarCambio([a, b], [a, { ...b, estado: "cancelado" }], ahora);
    expect(avisos).toMatchObject([{ tipo: "afecta_votacion_abierta", partidoId: "B", despues: { estado: "anulada" } }]);
  });

  it("cargar un Partido antes del que tiene la Votación abierta la vuelve pendiente", () => {
    const intermedio = partido("I", "2026-11-11T23:00:00Z", { creadoEn: ahora });
    const avisos = analizarCambio([a, b], [a, intermedio, b], ahora);
    expect(avisos).toMatchObject([{ tipo: "afecta_votacion_abierta", partidoId: "B", despues: { estado: "pendiente" } }]);
  });

  it("avisa si un cambio reabre una Votación que ya había cerrado", () => {
    const cerrado = partido("X", "2026-11-10T12:30:00Z"); // cerró a las 11:30
    const avisos = analizarCambio([a, cerrado], [a, { ...cerrado, inicio: t("2026-11-14T23:00:00Z") }], ahora);
    expect(avisos).toEqual([{ tipo: "reabre_votacion", partidoId: "X" }]);
  });

  describe("con Partidos que ya tienen 11 Elegido (resultado congelado)", () => {
    const cerrado = partido("X", "2026-11-10T12:30:00Z"); // cerró a las 11:30 y tiene resultado
    const conResultado = new Set(["X"]);

    it("postergarlo no avisa que se reabre ni que nunca abre: su Votación no se reabre", () => {
      const postergado = { ...cerrado, inicio: t("2026-11-10T12:45:00Z") };
      expect(analizarCambio([a, cerrado], [a, postergado], ahora, conResultado)).toEqual([]);
      const lejos = { ...cerrado, inicio: t("2026-11-11T20:00:00Z") };
      expect(analizarCambio([a, cerrado], [a, lejos], ahora, conResultado)).toEqual([]);
    });

    it("cancelarlo no avisa nada sobre su propia Votación", () => {
      expect(analizarCambio([a, cerrado], [a, { ...cerrado, estado: "cancelado" }], ahora, conResultado)).toEqual([]);
    });

    it("sigue avisando lo que el cambio provoca en las Votaciones de los demás Partidos", () => {
      // Y se jugó ayer y B tiene la Votación abierta desde que terminó; Y se
      // posterga a mañana: B espera a que termine Y.
      const ayer = partido("Y", "2026-11-09T12:00:00Z");
      const manana = { ...ayer, inicio: t("2026-11-11T20:00:00Z") };
      const avisos = analizarCambio([a, ayer, b], [a, manana, b], ahora, new Set(["Y"]));
      expect(avisos).toMatchObject([{ tipo: "afecta_votacion_abierta", partidoId: "B", despues: { estado: "pendiente" } }]);
    });
  });
});

describe("validarAccion: qué se le puede hacer a un Partido", () => {
  const ahora = new Date("2026-11-10T12:00:00Z");
  const programado: SituacionPartido = {
    estado: "programado",
    inicio: new Date("2026-11-12T23:00:00Z"),
    tieneAlineaciones: true,
    tieneOnceElegido: false,
  };
  const cancelado: SituacionPartido = { ...programado, estado: "cancelado" };
  const enDosDias = new Date("2026-11-12T23:00:00Z");

  it("un Partido programado se puede postergar o cambiar de horario y cancelar", () => {
    expect(validarAccion(programado, { tipo: "reprogramar", inicio: new Date("2026-11-20T23:00:00Z") }, ahora)).toEqual({ ok: true });
    expect(validarAccion(programado, { tipo: "cancelar" }, ahora)).toEqual({ ok: true });
  });

  it("no se cancela dos veces ni se cambia el horario de uno cancelado (primero se reactiva)", () => {
    expect(validarAccion(cancelado, { tipo: "cancelar" }, ahora)).toEqual({ ok: false, motivo: "ya_cancelado" });
    expect(validarAccion(cancelado, { tipo: "reprogramar", inicio: enDosDias }, ahora)).toEqual({ ok: false, motivo: "cancelado" });
  });

  it("un cancelado se reactiva solo con un inicio cuya Votación todavía no cerró", () => {
    expect(validarAccion(cancelado, { tipo: "reactivar", inicio: enDosDias }, ahora)).toEqual({ ok: true });
    // Cierra justo ahora (inicio - 1 h = ahora): ya no.
    expect(validarAccion(cancelado, { tipo: "reactivar", inicio: new Date("2026-11-10T13:00:00Z") }, ahora)).toEqual({
      ok: false,
      motivo: "cierre_pasado",
    });
    expect(validarAccion(programado, { tipo: "reactivar", inicio: enDosDias }, ahora)).toEqual({ ok: false, motivo: "no_cancelado" });
  });

  it("solo se borra un Partido sin Alineaciones (si tiene, se cancela)", () => {
    expect(validarAccion(programado, { tipo: "borrar" }, ahora)).toEqual({ ok: false, motivo: "con_alineaciones" });
    expect(validarAccion({ ...cancelado, tieneAlineaciones: false }, { tipo: "borrar" }, ahora)).toEqual({ ok: true });
  });

  describe("con 11 Elegido (la Votación ya cerró y quedó congelada)", () => {
    const definitivo: SituacionPartido = { ...programado, tieneAlineaciones: false, tieneOnceElegido: true };
    const canceladoDefinitivo: SituacionPartido = { ...definitivo, estado: "cancelado" };

    it("se puede postergar o cambiar el horario (por ejemplo, se suspendió en la última hora)", () => {
      expect(validarAccion(definitivo, { tipo: "reprogramar", inicio: new Date("2026-11-20T23:00:00Z") }, ahora)).toEqual({
        ok: true,
      });
    });

    it("se puede cancelar", () => {
      expect(validarAccion(definitivo, { tipo: "cancelar" }, ahora)).toEqual({ ok: true });
    });

    it("cancelado, se reactiva con cualquier inicio: la Votación no se reabre igual", () => {
      expect(validarAccion(canceladoDefinitivo, { tipo: "reactivar", inicio: new Date("2026-11-10T13:00:00Z") }, ahora)).toEqual({
        ok: true,
      });
    });

    it("mantiene las reglas de estado (no se cancela dos veces ni se reprograma uno cancelado)", () => {
      expect(validarAccion(canceladoDefinitivo, { tipo: "cancelar" }, ahora)).toEqual({ ok: false, motivo: "ya_cancelado" });
      expect(validarAccion(canceladoDefinitivo, { tipo: "reprogramar", inicio: enDosDias }, ahora)).toEqual({
        ok: false,
        motivo: "cancelado",
      });
    });

    it("no se puede borrar, aunque no tenga Alineaciones", () => {
      expect(validarAccion(definitivo, { tipo: "borrar" }, ahora)).toEqual({ ok: false, motivo: "once_elegido" });
      expect(validarAccion(canceladoDefinitivo, { tipo: "borrar" }, ahora)).toEqual({ ok: false, motivo: "once_elegido" });
    });
  });
});

const rivales: RivalParaPartido[] = [
  { id: "r-def", activo: true, clubId: null },
  { id: "r-pen", activo: true, clubId: "penarol" },
  { id: "r-nac", activo: true, clubId: "nacional" },
  { id: "r-baja", activo: false, clubId: null },
];

describe("rivalesParaPartido", () => {
  it("ofrece los Rivales activos salvo el propio Club", () => {
    expect(rivalesParaPartido(rivales, "penarol").map((r) => r.id)).toEqual(["r-def", "r-nac"]);
    expect(rivalesParaPartido(rivales, "nacional").map((r) => r.id)).toEqual(["r-def", "r-pen"]);
  });

  it("al editar, sigue ofreciendo el Rival actual aunque esté dado de baja", () => {
    expect(rivalesParaPartido(rivales, "penarol", "r-baja").map((r) => r.id)).toEqual(["r-def", "r-nac", "r-baja"]);
  });
});

describe("validarPartido", () => {
  const valido = { clubId: "penarol", rivalId: "r-def", inicio: "2026-11-10T20:00" };

  it("toma el inicio en hora de Montevideo y lo devuelve en UTC", () => {
    expect(validarPartido(valido, rivales)).toEqual({
      ok: true,
      partido: { clubId: "penarol", rivalId: "r-def", inicio: new Date("2026-11-10T23:00:00Z") },
    });
  });

  it("el Clásico: cada Club juega contra el otro", () => {
    expect(validarPartido({ ...valido, rivalId: "r-nac" }, rivales).ok).toBe(true);
    expect(validarPartido({ clubId: "nacional", rivalId: "r-pen", inicio: valido.inicio }, rivales).ok).toBe(true);
  });

  it.each([
    ["el propio Club", "r-pen"],
    ["un Rival dado de baja", "r-baja"],
    ["un Rival inexistente", "r-x"],
    ["ningún Rival", ""],
  ])("rechaza %s como Rival", (_, rivalId) => {
    const r = validarPartido({ ...valido, rivalId }, rivales);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(["rivalId"]);
  });

  it("acepta mantener el Rival actual dado de baja al editar", () => {
    expect(validarPartido({ ...valido, rivalId: "r-baja" }, rivales, "r-baja").ok).toBe(true);
  });

  it.each(["", "mañana", "2026-13-40T20:00", "2026-02-30T20:00", null])("rechaza el inicio %j", (inicio) => {
    const r = validarPartido({ ...valido, inicio }, rivales);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(["inicio"]);
  });

  it("rechaza un Club inexistente", () => {
    const r = validarPartido({ ...valido, clubId: "defensor" }, rivales);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.clubId).toBeDefined();
  });
});

describe("Partidos de la Selección", () => {
  const inicio = "2026-11-13T20:00";

  it("la Selección juega contra los Rivales activos que no representan a un Club", () => {
    expect(rivalesParaPartido(rivales, "seleccion").map((r) => r.id)).toEqual(["r-def"]);
    expect(rivalesParaPartido(rivales, "seleccion", "r-baja").map((r) => r.id)).toEqual(["r-def", "r-baja"]);
  });

  it("acepta un Partido de la Selección contra otra selección", () => {
    expect(validarPartido({ clubId: "seleccion", rivalId: "r-def", inicio }, rivales)).toEqual({
      ok: true,
      partido: { clubId: "seleccion", rivalId: "r-def", inicio: new Date("2026-11-13T23:00:00Z") },
    });
  });

  it.each(["r-pen", "r-nac"])("rechaza a un Club (%s) como Rival de la Selección", (rivalId) => {
    const r = validarPartido({ clubId: "seleccion", rivalId, inicio }, rivales);
    expect(r).toEqual({ ok: false, errores: { rivalId: "La Selección no juega contra un Club." } });
  });
});

describe("validarRival", () => {
  it("acepta un nombre y normaliza espacios; sin Club es un Rival común", () => {
    expect(validarRival({ nombre: "  Defensor   Sporting ", clubId: "" })).toEqual({
      ok: true,
      rival: { nombre: "Defensor Sporting", clubId: null },
    });
  });

  it("el Rival puede ser uno de los Clubes (para el Clásico)", () => {
    expect(validarRival({ nombre: "Nacional", clubId: "nacional" })).toEqual({
      ok: true,
      rival: { nombre: "Nacional", clubId: "nacional" },
    });
  });

  it.each([["   "], [""], [null], ["a".repeat(61)]])("rechaza el nombre %j", (nombre) => {
    const r = validarRival({ nombre, clubId: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(["nombre"]);
  });

  it("rechaza un Club inexistente", () => {
    const r = validarRival({ nombre: "Defensor", clubId: "defensor" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(["clubId"]);
  });
});

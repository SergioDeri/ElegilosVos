import { describe, expect, it } from "vitest";
import { aHoraUyLocal, desdeHoraUy } from "@/domain/comun/horario";
import {
  CIERRE_ANTES_DEL_INICIO_MS,
  DURACION_PARTIDO_MS,
  calcularVotaciones,
  cierreDeVotacion,
  finDePartido,
  votacionAbierta,
  type PartidoCalendario,
} from "./index";

const ahora = new Date("2026-11-10T12:00:00Z");
const t = (iso: string) => new Date(iso);
const masSegundos = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

function partido(id: string, inicio: string, creadoEn: string, estado: PartidoCalendario["estado"] = "programado"): PartidoCalendario {
  return { id, inicio: t(inicio), creadoEn: t(creadoEn), estado };
}

describe("Calendario de Votación", () => {
  it("un Club sin Partidos no tiene Votación abierta", () => {
    expect(votacionAbierta([], ahora)).toBeNull();
    expect(calcularVotaciones([], ahora)).toEqual([]);
  });

  describe("un único Partido", () => {
    const p = partido("p1", "2026-11-10T23:00:00Z", "2026-11-08T15:00:00Z");

    it("abre cuando se carga y cierra en el inicio menos 1 hora", () => {
      const [v] = calcularVotaciones([p], ahora);
      expect(v).toEqual({
        partidoId: "p1",
        estado: "abierta",
        abre: t("2026-11-08T15:00:00Z"),
        cierra: t("2026-11-10T22:00:00Z"),
      });
      expect(votacionAbierta([p], ahora)?.partidoId).toBe("p1");
    });

    it("está abierta hasta un segundo antes del cierre y cerrada exactamente en el cierre", () => {
      const cierre = t("2026-11-10T22:00:00Z");
      expect(calcularVotaciones([p], masSegundos(cierre, -1))[0].estado).toBe("abierta");
      expect(calcularVotaciones([p], cierre)[0].estado).toBe("cerrada");
      expect(calcularVotaciones([p], masSegundos(cierre, 1))[0].estado).toBe("cerrada");
      expect(votacionAbierta([p], cierre)).toBeNull();
    });

    it("está pendiente antes de cargarse y abierta exactamente al cargarse", () => {
      const carga = t("2026-11-08T15:00:00Z");
      expect(calcularVotaciones([p], masSegundos(carga, -1))[0].estado).toBe("pendiente");
      expect(calcularVotaciones([p], carga)[0].estado).toBe("abierta");
    });
  });

  describe("Partidos consecutivos cargados por adelantado", () => {
    const p1 = partido("p1", "2026-11-10T23:00:00Z", "2026-11-01T10:00:00Z");
    const p2 = partido("p2", "2026-11-17T23:00:00Z", "2026-11-01T10:05:00Z");
    const p3 = partido("p3", "2026-11-24T23:00:00Z", "2026-11-01T10:10:00Z");

    it("la Votación del segundo abre exactamente en el inicio del primero más 2 horas", () => {
      const v2 = calcularVotaciones([p1, p2], ahora).find((v) => v.partidoId === "p2");
      expect(v2?.abre).toEqual(t("2026-11-11T01:00:00Z"));
      expect(v2?.cierra).toEqual(t("2026-11-17T22:00:00Z"));
    });

    it("el segundo está pendiente un segundo antes del fin del primero y abierto en el fin exacto", () => {
      const fin1 = t("2026-11-11T01:00:00Z");
      expect(votacionAbierta([p1, p2], masSegundos(fin1, -1))).toBeNull();
      expect(calcularVotaciones([p1, p2], masSegundos(fin1, -1)).map((v) => v.estado)).toEqual(["cerrada", "pendiente"]);
      expect(votacionAbierta([p1, p2], fin1)?.partidoId).toBe("p2");
    });

    it("nunca hay más de una Votación abierta por Club", () => {
      const partidos = [p3, p1, p2];
      const desde = t("2026-11-01T09:00:00Z").getTime();
      const hasta = t("2026-11-25T03:00:00Z").getTime();
      for (let ms = desde; ms <= hasta; ms += 15 * 60 * 1000) {
        const abiertas = calcularVotaciones(partidos, new Date(ms)).filter((v) => v.estado === "abierta");
        expect(abiertas.length).toBeLessThanOrEqual(1);
      }
      expect(votacionAbierta(partidos, ahora)?.partidoId).toBe("p1");
    });

    it("devuelve una Votación por Partido, en orden cronológico", () => {
      expect(calcularVotaciones([p3, p1, p2], ahora).map((v) => [v.partidoId, v.estado])).toEqual([
        ["p1", "abierta"],
        ["p2", "pendiente"],
        ["p3", "pendiente"],
      ]);
    });
  });

  describe("Partido cancelado", () => {
    const p1 = partido("p1", "2026-11-03T23:00:00Z", "2026-11-01T10:00:00Z");
    const p2 = partido("p2", "2026-11-10T23:00:00Z", "2026-11-01T10:05:00Z", "cancelado");
    const p3 = partido("p3", "2026-11-17T23:00:00Z", "2026-11-01T10:10:00Z");

    it("queda anulado, sea cual sea la hora", () => {
      for (const momento of ["2026-11-01T00:00:00Z", "2026-11-08T00:00:00Z", "2026-12-01T00:00:00Z"]) {
        const v2 = calcularVotaciones([p1, p2, p3], t(momento)).find((v) => v.partidoId === "p2");
        expect(v2?.estado).toBe("anulada");
      }
    });

    it("la Votación del siguiente abre cuando termina el anterior no cancelado", () => {
      const v3 = calcularVotaciones([p1, p2, p3], ahora).find((v) => v.partidoId === "p3");
      expect(v3?.abre).toEqual(t("2026-11-04T01:00:00Z"));
      expect(votacionAbierta([p1, p2, p3], ahora)?.partidoId).toBe("p3");
    });

    it("si no queda ningún anterior no cancelado, el siguiente abre cuando se cargó", () => {
      const p1Cancelado = { ...p1, estado: "cancelado" as const };
      const v3 = calcularVotaciones([p1Cancelado, p2, p3], ahora).find((v) => v.partidoId === "p3");
      expect(v3?.abre).toEqual(p3.creadoEn);
    });

    it("un Partido cancelado nunca es la Votación abierta", () => {
      expect(votacionAbierta([p2], ahora)).toBeNull();
    });
  });

  describe("momento de carga", () => {
    const p1 = partido("p1", "2026-11-03T23:00:00Z", "2026-11-01T10:00:00Z");

    it("un Partido cargado después de que terminó el anterior abre al cargarse", () => {
      const p2 = partido("p2", "2026-11-10T23:00:00Z", "2026-11-06T09:30:00Z");
      const [, v2] = calcularVotaciones([p1, p2], t("2026-11-06T09:29:59Z"));
      expect(v2.abre).toEqual(t("2026-11-06T09:30:00Z"));
      expect(v2.estado).toBe("pendiente");
      expect(votacionAbierta([p1, p2], t("2026-11-06T09:30:00Z"))?.partidoId).toBe("p2");
    });

    it("un Partido cargado mientras se juega el anterior abre cuando el anterior termina", () => {
      const p2 = partido("p2", "2026-11-10T23:00:00Z", "2026-11-04T00:00:00Z");
      expect(calcularVotaciones([p1, p2], ahora)[1].abre).toEqual(t("2026-11-04T01:00:00Z"));
    });
  });

  describe("ventana vacía: la apertura calculada no es anterior al cierre", () => {
    it("un Partido cargado menos de 1 hora antes de su inicio no abre nunca", () => {
      const p = partido("p", "2026-11-10T23:00:00Z", "2026-11-10T22:30:00Z");
      const [v] = calcularVotaciones([p], t("2026-11-10T22:00:00Z"));
      expect(v.abre.getTime()).toBeGreaterThanOrEqual(v.cierra.getTime());
      expect(v.estado).toBe("cerrada");
      expect(calcularVotaciones([p], t("2026-11-10T21:59:59Z"))[0].estado).toBe("pendiente");
      expect(calcularVotaciones([p], t("2026-11-10T22:30:00Z"))[0].estado).toBe("cerrada");
    });

    it("un Partido que empieza menos de 3 horas después del anterior no abre nunca", () => {
      const p1 = partido("p1", "2026-11-10T20:00:00Z", "2026-11-01T10:00:00Z");
      const p2 = partido("p2", "2026-11-10T22:30:00Z", "2026-11-01T10:05:00Z");
      const [, v2] = calcularVotaciones([p1, p2], ahora);
      expect(v2.abre).toEqual(t("2026-11-10T22:00:00Z"));
      expect(v2.cierra).toEqual(t("2026-11-10T21:30:00Z"));
      for (let ms = t("2026-11-01T00:00:00Z").getTime(); ms <= t("2026-11-11T03:00:00Z").getTime(); ms += 60 * 1000) {
        expect(votacionAbierta([p1, p2], new Date(ms))?.partidoId).not.toBe("p2");
      }
      expect(calcularVotaciones([p1, p2], t("2026-11-10T21:30:00Z"))[1].estado).toBe("cerrada");
    });

    it("con exactamente 3 horas entre inicios la ventana queda vacía (el fin coincide con el cierre)", () => {
      const p1 = partido("p1", "2026-11-10T20:00:00Z", "2026-11-01T10:00:00Z");
      const p2 = partido("p2", "2026-11-10T23:00:00Z", "2026-11-01T10:05:00Z");
      const [, v2] = calcularVotaciones([p1, p2], t("2026-11-10T22:00:00Z"));
      expect(v2.abre).toEqual(v2.cierra);
      expect(v2.estado).toBe("cerrada");
    });
  });

  it("dos Partidos con el mismo inicio: solo puede abrir el primero cargado", () => {
    const a = partido("a", "2026-11-10T23:00:00Z", "2026-11-01T10:00:00Z");
    const b = partido("b", "2026-11-10T23:00:00Z", "2026-11-01T09:00:00Z");
    const vs = calcularVotaciones([a, b], ahora);
    expect(vs.map((v) => [v.partidoId, v.estado])).toEqual([
      ["b", "abierta"],
      ["a", "pendiente"],
    ]);
  });

  describe("postergación", () => {
    const p1 = partido("p1", "2026-11-10T23:00:00Z", "2026-11-01T10:00:00Z");
    const p2 = partido("p2", "2026-11-17T23:00:00Z", "2026-11-01T10:05:00Z");

    it("mueve el cierre y mantiene abierta la misma Votación", () => {
      const p1Postergado = { ...p1, inicio: t("2026-11-12T22:00:00Z") };
      const v = votacionAbierta([p1Postergado, p2], ahora);
      expect(v?.partidoId).toBe("p1");
      expect(v?.cierra).toEqual(t("2026-11-12T21:00:00Z"));
    });

    it("mueve la apertura del Partido siguiente al nuevo fin", () => {
      const p1Postergado = { ...p1, inicio: t("2026-11-12T22:00:00Z") };
      const [, v2] = calcularVotaciones([p1Postergado, p2], ahora);
      expect(v2.abre).toEqual(t("2026-11-13T00:00:00Z"));
    });

    it("reabre una Votación cerrada si el nuevo cierre todavía no llegó", () => {
      const enPartido = t("2026-11-10T22:30:00Z");
      expect(votacionAbierta([p1, p2], enPartido)).toBeNull();
      const p1Postergado = { ...p1, inicio: t("2026-11-11T23:00:00Z") };
      expect(votacionAbierta([p1Postergado, p2], enPartido)?.partidoId).toBe("p1");
    });

    it("si queda después del siguiente, cambia cuál abre según la regla", () => {
      const p1Postergado = { ...p1, inicio: t("2026-11-20T23:00:00Z") };
      const vs = calcularVotaciones([p1Postergado, p2], ahora);
      expect(vs.map((v) => [v.partidoId, v.estado])).toEqual([
        ["p2", "abierta"],
        ["p1", "pendiente"],
      ]);
      expect(vs[1].abre).toEqual(t("2026-11-18T01:00:00Z"));
    });
  });

  describe("horario de Montevideo (UTC-3)", () => {
    it("un Partido a las 20:00 de Uruguay cierra a las 19:00 y el siguiente abre a las 22:00, hora de Uruguay", () => {
      const p1: PartidoCalendario = {
        id: "p1",
        inicio: desdeHoraUy("2026-11-10T20:00"),
        creadoEn: desdeHoraUy("2026-11-01T10:00"),
        estado: "programado",
      };
      const p2: PartidoCalendario = {
        id: "p2",
        inicio: desdeHoraUy("2026-11-15T17:00"),
        creadoEn: desdeHoraUy("2026-11-01T10:05"),
        estado: "programado",
      };
      const [v1, v2] = calcularVotaciones([p1, p2], ahora);
      expect(aHoraUyLocal(v1.cierra)).toBe("2026-11-10T19:00");
      expect(v1.cierra.toISOString()).toBe("2026-11-10T22:00:00.000Z");
      expect(aHoraUyLocal(v2.abre)).toBe("2026-11-10T22:00");
      expect(aHoraUyLocal(v2.cierra)).toBe("2026-11-15T16:00");
    });

    it("un Partido a las 23:00 de Uruguay termina a la 01:00 del día siguiente", () => {
      const p1: PartidoCalendario = {
        id: "p1",
        inicio: desdeHoraUy("2026-11-10T23:00"),
        creadoEn: desdeHoraUy("2026-11-01T10:00"),
        estado: "programado",
      };
      const p2: PartidoCalendario = { ...p1, id: "p2", inicio: desdeHoraUy("2026-11-15T00:30") };
      const [v1, v2] = calcularVotaciones([p1, p2], ahora);
      expect(aHoraUyLocal(v1.cierra)).toBe("2026-11-10T22:00");
      expect(aHoraUyLocal(v2.abre)).toBe("2026-11-11T01:00");
      expect(aHoraUyLocal(v2.cierra)).toBe("2026-11-14T23:30");
    });
  });

  it("exporta las constantes de la regla y sus helpers", () => {
    expect(CIERRE_ANTES_DEL_INICIO_MS).toBe(60 * 60 * 1000);
    expect(DURACION_PARTIDO_MS).toBe(2 * 60 * 60 * 1000);
    expect(cierreDeVotacion(t("2026-11-10T23:00:00Z"))).toEqual(t("2026-11-10T22:00:00Z"));
    expect(finDePartido(t("2026-11-10T23:00:00Z"))).toEqual(t("2026-11-11T01:00:00Z"));
  });
});

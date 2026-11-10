import { describe, expect, it } from "vitest";
import type { PosicionNatural } from "@/domain/comun/tipos";
import { esquema, type EsquemaId, type PuestoId } from "@/domain/esquemas";
import {
  contar,
  type AlineacionParaConteo,
  type JugadorParaConteo,
  type PuestoOcupadoParaConteo,
  type ResultadoConteo,
  type ResultadoConteoConDatos,
} from "./index";

// ---------- Helpers ----------

const T0 = Date.parse("2026-11-10T12:00:00Z");
/** Hora a `min` minutos de T0. */
const hora = (min: number) => new Date(T0 + min * 60_000);

function jugador(
  id: string,
  numero: number,
  posicionNatural: PosicionNatural,
  extra: Partial<JugadorParaConteo> = {},
): JugadorParaConteo {
  return { id, numero, posicionNatural, disponibilidad: "disponible", enPlantel: true, ...extra };
}

/** Puestos: `{ PUESTO: "jugadorId" }` (hora 0) o `{ PUESTO: ["jugadorId", minutos] }`. */
function alineacion(
  esquemaId: EsquemaId,
  puestos: Partial<Record<PuestoId, string | [string, number]>> = {},
  extra: Partial<AlineacionParaConteo> = {},
): AlineacionParaConteo {
  const p: Partial<Record<PuestoId, PuestoOcupadoParaConteo>> = {};
  for (const [puesto, valor] of Object.entries(puestos) as [PuestoId, string | [string, number]][]) {
    const [jugadorId, min] = typeof valor === "string" ? [valor, 0] : valor;
    p[puesto] = { jugadorId, modificadoEn: hora(min) };
  }
  return { esquema: esquemaId, esquemaElegidoAMano: false, puestos: p, ...extra };
}

function veces<T>(n: number, f: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => f(i));
}

function conDatos(r: ResultadoConteo): ResultadoConteoConDatos {
  if (r.vacio) throw new Error("se esperaba un resultado con datos");
  return r;
}

function onceDe(r: ResultadoConteo): Partial<Record<PuestoId, string | null>> {
  return Object.fromEntries(conDatos(r).once.map((a) => [a.puesto, a.jugadorId]));
}

function origenDe(r: ResultadoConteo, puesto: PuestoId) {
  return conDatos(r).once.find((a) => a.puesto === puesto)?.origen;
}

function candidatosDe(r: ResultadoConteo, puesto: PuestoId) {
  return conDatos(r).puestos.find((p) => p.puesto === puesto)?.candidatos;
}

/** Barajado determinístico (LCG) para no depender de Math.random. */
function barajar<T>(xs: readonly T[], semilla: number): T[] {
  const r = [...xs];
  let s = semilla;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// Un plantel completo de 4-3-3, más suplentes.
const titulares433 = {
  ARQ: "arq1",
  LI: "li",
  ZAG_I: "zi",
  ZAG_D: "zd",
  LD: "ld",
  CINCO: "cinco",
  INT_I: "ii",
  INT_D: "id",
  EXT_I: "ei",
  DEL: "dc",
  EXT_D: "ed",
} satisfies Partial<Record<PuestoId, string>>;

const plantel: JugadorParaConteo[] = [
  jugador("arq1", 1, "ARQ"),
  jugador("arq2", 12, "ARQ"),
  jugador("li", 3, "DEF"),
  jugador("zi", 2, "DEF"),
  jugador("zd", 6, "DEF"),
  jugador("ld", 4, "DEF"),
  jugador("def5", 13, "DEF"),
  jugador("cinco", 5, "MED"),
  jugador("ii", 8, "MED"),
  jugador("id", 10, "MED"),
  jugador("med5", 14, "MED"),
  jugador("ei", 11, "DEL"),
  jugador("dc", 9, "DEL"),
  jugador("ed", 7, "DEL"),
  jugador("del5", 19, "DEL"),
];

// ---------- Tests ----------

describe("Motor de Conteo", () => {
  describe("resultado vacío", () => {
    it("sin Alineaciones devuelve un resultado vacío explícito", () => {
      expect(contar({ alineaciones: [], jugadores: plantel })).toEqual({ vacio: true, alineacionesQueCuentan: 0 });
    });

    it("las Alineaciones sin Jugadores y sin Esquema elegido a mano no cuentan", () => {
      const r = contar({ alineaciones: [alineacion("4-4-2"), alineacion("3-5-2")], jugadores: plantel });
      expect(r).toEqual({ vacio: true, alineacionesQueCuentan: 0 });
    });
  });

  describe("Esquema ganador", () => {
    it("gana el Esquema con más votos, y las Alineaciones vacías no suman", () => {
      const r = conDatos(
        contar({
          alineaciones: [
            alineacion("4-4-2", { DEL_I: "dc" }),
            alineacion("4-4-2", {}, { esquemaElegidoAMano: true }),
            alineacion("3-5-2", { ARQ: "arq1" }),
            // Vacías: no suman aunque sean muchas.
            ...veces(5, () => alineacion("4-3-3")),
          ],
          jugadores: plantel,
        }),
      );
      expect(r.alineacionesQueCuentan).toBe(3);
      expect(r.esquemaGanador).toBe("4-4-2");
      const porEsquema = Object.fromEntries(r.esquemas.map((e) => [e.esquema, [e.votos, e.porcentaje]]));
      expect(porEsquema["4-4-2"]).toEqual([2, (2 / 3) * 100]);
      expect(porEsquema["3-5-2"]).toEqual([1, (1 / 3) * 100]);
      expect(porEsquema["4-3-3"]).toEqual([0, 0]);
      // Todos los Esquemas, en el orden del catálogo.
      expect(r.esquemas.map((e) => e.esquema)).toEqual(["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1", "4-3-1-2"]);
    });

    it("una Alineación con un Jugador colocado cuenta aunque ese Jugador ya no esté Disponible", () => {
      const r = conDatos(
        contar({
          alineaciones: [alineacion("5-3-2", { DEL_I: "dc" })],
          jugadores: plantel.map((j) => (j.id === "dc" ? { ...j, disponibilidad: "lesionado" } : j)),
        }),
      );
      expect(r.alineacionesQueCuentan).toBe(1);
      expect(r.esquemaGanador).toBe("5-3-2");
    });

    it("empate de Esquemas: gana el que llegó antes a ese total (menor hora de su último voto)", () => {
      const r = contar({
        alineaciones: [
          alineacion("4-4-2", { DEL_I: ["dc", 10] }),
          alineacion("4-4-2", { DEL_I: ["dc", 50] }),
          alineacion("3-5-2", { DEL_I: ["dc", 0] }),
          alineacion("3-5-2", { DEL_I: ["dc", 40] }),
        ],
        jugadores: plantel,
      });
      expect(conDatos(r).esquemaGanador).toBe("3-5-2");
    });

    it("la hora de una Alineación es la de su última modificación (o esquemaModificadoEn si viene)", () => {
      const r = contar({
        alineaciones: [
          // Último cambio a los 30.
          alineacion("4-4-2", { DEL_I: ["dc", 0], DEL_D: ["ei", 30] }),
          // Último cambio de Puesto a los 5, pero cambió el Esquema a los 60.
          alineacion("3-5-2", { DEL_I: ["dc", 5] }, { esquemaModificadoEn: hora(60) }),
        ],
        jugadores: plantel,
      });
      expect(conDatos(r).esquemaGanador).toBe("4-4-2");
    });

    it("empate de Esquemas también en hora: decide el orden del catálogo", () => {
      const r = contar({
        alineaciones: [alineacion("3-5-2", { DEL_I: "dc" }), alineacion("4-4-2", { DEL_I: "dc" })],
        jugadores: plantel,
      });
      expect(conDatos(r).esquemaGanador).toBe("4-4-2");
    });
  });

  describe("votos por Puesto", () => {
    it("una Alineación de otro Esquema aporta votos a los Puestos equivalentes del Esquema ganador", () => {
      const r = contar({
        alineaciones: [
          alineacion("4-3-3", titulares433),
          alineacion("4-3-3", titulares433),
          // 3-5-2: el carrilero izquierdo equivale al lateral izquierdo del 4-3-3.
          alineacion("3-5-2", { CAR_I: "def5", DEL_D: "del5" }),
        ],
        jugadores: plantel,
      });
      expect(conDatos(r).esquemaGanador).toBe("4-3-3");
      expect(candidatosDe(r, "LI")).toEqual([
        { jugadorId: "li", votos: 2, porcentaje: (2 / 3) * 100 },
        { jugadorId: "def5", votos: 1, porcentaje: (1 / 3) * 100 },
      ]);
      // El delantero derecho del 3-5-2 va al centrodelantero del 4-3-3.
      expect(candidatosDe(r, "DEL")?.map((c) => c.jugadorId)).toEqual(["dc", "del5"]);
      expect(conDatos(r).puestos.find((p) => p.puesto === "LI")?.totalVotos).toBe(3);
    });

    it("si dos Puestos de origen caen en el mismo Puesto de destino, los dos Jugadores suman voto ahí", () => {
      const r = contar({
        alineaciones: [
          alineacion("4-4-2", { DEL_I: "dc" }),
          alineacion("4-4-2", { DEL_I: "dc" }),
          // En el 3-5-2, ZAG_C y ZAG_D van los dos al ZAG_D del 4-4-2.
          alineacion("3-5-2", { ZAG_C: "zi", ZAG_D: "zd" }),
        ],
        jugadores: plantel,
      });
      expect(conDatos(r).esquemaGanador).toBe("4-4-2");
      expect(candidatosDe(r, "ZAG_D")?.map((c) => [c.jugadorId, c.votos])).toEqual([
        ["zi", 1],
        ["zd", 1],
      ]);
    });

    it("los Puestos se listan en el orden del Esquema ganador", () => {
      const r = contar({ alineaciones: [alineacion("4-2-3-1", { DEL: "dc" })], jugadores: plantel });
      expect(conDatos(r).puestos.map((p) => p.puesto)).toEqual(esquema("4-2-3-1").puestos.map((p) => p.id));
    });

    it("los votos a Jugadores no Disponibles, fuera del Plantel o desconocidos se descartan", () => {
      const jugadores = plantel.map((j) =>
        j.id === "dc" ? { ...j, disponibilidad: "suspendido" as const } : j.id === "ei" ? { ...j, enPlantel: false } : j,
      );
      const r = contar({
        alineaciones: [
          alineacion("4-3-3", { DEL: "dc", EXT_I: "ei", EXT_D: "fantasma" }),
          alineacion("4-3-3", { DEL: "del5" }),
        ],
        jugadores,
      });
      expect(candidatosDe(r, "DEL")).toEqual([{ jugadorId: "del5", votos: 1, porcentaje: 100 }]);
      expect(candidatosDe(r, "EXT_I")).toEqual([]);
      expect(candidatosDe(r, "EXT_D")).toEqual([]);
      expect(onceDe(r).DEL).toBe("del5");
      expect(Object.values(onceDe(r))).not.toContain("dc");
      expect(Object.values(onceDe(r))).not.toContain("ei");
    });

    it("se descartan los votos que violan la regla del arquero (posición natural cambiada)", () => {
      const jugadores = plantel.map((j) => (j.id === "arq1" ? { ...j, posicionNatural: "DEF" as const } : j));
      const r = contar({ alineaciones: [alineacion("4-3-3", { ARQ: "arq1", LI: "arq2" })], jugadores });
      expect(candidatosDe(r, "ARQ")).toEqual([]);
      expect(candidatosDe(r, "LI")).toEqual([]);
      expect(onceDe(r).ARQ).toBe("arq2");
    });
  });

  describe("asignación óptima", () => {
    it("si un Jugador es el más votado en dos Puestos, maximiza el total y el 11 queda con Jugadores distintos", () => {
      const r = contar({
        alineaciones: [
          ...veces(4, () => alineacion("4-3-3", { INT_I: "med5", INT_D: "ii" })),
          alineacion("4-3-3", { INT_I: "ii", INT_D: "id" }),
          ...veces(4, () => alineacion("4-3-3", { INT_I: "ii" })),
        ],
        jugadores: plantel,
      });
      // INT_I: ii 5, med5 4. INT_D: ii 4, id 1. "ii" gana los dos.
      // Recorriendo los Puestos y quedándose con el más votado: ii→INT_I + id→INT_D = 6.
      // Óptimo: med5→INT_I + ii→INT_D = 8.
      const once = onceDe(r);
      expect(once.INT_I).toBe("med5");
      expect(once.INT_D).toBe("ii");
      expect(origenDe(r, "INT_I")).toBe("votos");
      const ids = conDatos(r).once.map((a) => a.jugadorId).filter((x) => x !== null);
      expect(ids).toHaveLength(11);
      expect(new Set(ids).size).toBe(11);
    });

    it("el total de votos asignado coincide con el máximo por fuerza bruta (casos al azar)", () => {
      const puestosEnJuego: PuestoId[] = ["INT_I", "INT_D", "EXT_I", "DEL", "EXT_D"];
      const ids = ["ii", "id", "med5", "ei", "dc", "ed"];
      let s = 99;
      const azar = (n: number) => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s % n;
      };
      for (let caso = 0; caso < 40; caso++) {
        const alineaciones = veces(1 + azar(12), () => {
          const libres = barajar(ids, azar(1000) + 1);
          const puestos: Partial<Record<PuestoId, [string, number]>> = {};
          for (const p of puestosEnJuego) if (azar(2)) puestos[p] = [libres.pop()!, azar(3)];
          return alineacion("4-3-3", puestos, { esquemaElegidoAMano: true });
        });
        const r = conDatos(contar({ alineaciones, jugadores: plantel }));
        const votos = new Map(r.puestos.map((p) => [p.puesto, new Map(p.candidatos.map((c) => [c.jugadorId, c.votos]))]));
        const mejor = (k: number, usados: Set<string>): number => {
          if (k === puestosEnJuego.length) return 0;
          let max = mejor(k + 1, usados);
          for (const [id, v] of votos.get(puestosEnJuego[k])!) {
            if (usados.has(id)) continue;
            usados.add(id);
            max = Math.max(max, v + mejor(k + 1, usados));
            usados.delete(id);
          }
          return max;
        };
        const asignado = r.once.reduce((acc, a) => acc + a.votos, 0);
        expect(asignado).toBe(mejor(0, new Set()));
      }
    });

    it("el arquero solo va al arco y los de campo nunca al arco", () => {
      const r = contar({
        alineaciones: [alineacion("4-3-3", { ARQ: "arq2", LI: "li" })],
        jugadores: plantel,
      });
      const once = onceDe(r);
      expect(once.ARQ).toBe("arq2");
      const porId = new Map(plantel.map((j) => [j.id, j]));
      for (const a of conDatos(r).once) {
        if (a.jugadorId === null) continue;
        expect(porId.get(a.jugadorId)?.posicionNatural === "ARQ").toBe(a.puesto === "ARQ");
      }
    });

    it("informa los votos con que se asignó cada Puesto", () => {
      const r = contar({
        alineaciones: veces(3, () => alineacion("4-3-3", { DEL: "dc" })),
        jugadores: plantel,
      });
      expect(conDatos(r).once.find((a) => a.puesto === "DEL")).toEqual({
        puesto: "DEL",
        jugadorId: "dc",
        origen: "votos",
        votos: 3,
      });
    });
  });

  describe("vacantes", () => {
    it("un Puesto sin votos válidos se completa con el Disponible con más votos en otros Puestos", () => {
      const r = contar({
        alineaciones: [
          ...veces(3, () => alineacion("4-3-3", { DEL: "dc" })),
          ...veces(2, () => alineacion("4-3-3", { DEL: "del5" })),
          alineacion("4-3-3", { DEL: "ed" }),
        ],
        jugadores: plantel,
      });
      // DEL lo gana dc. del5 (2 votos en otro Puesto) es el primer relleno, ed (1) el segundo.
      const once = onceDe(r);
      expect(once.DEL).toBe("dc");
      // Las vacantes de campo se completan en el orden del Esquema: LI es la primera.
      expect(once.LI).toBe("del5");
      expect(origenDe(r, "LI")).toBe("vacante");
      expect(once.ZAG_I).toBe("ed");
      expect(conDatos(r).once.find((a) => a.puesto === "LI")?.votos).toBe(0);
    });

    it("como último recurso, cualquier Disponible de la posición adecuada (por número de camiseta)", () => {
      const r = contar({ alineaciones: [alineacion("4-3-3", { DEL: "dc" })], jugadores: plantel });
      const once = onceDe(r);
      expect(once.ARQ).toBe("arq1"); // número 1 antes que el 12
      // DEF por número (2, 3, 4, 6), en el orden del Esquema: LI, ZAG_I, ZAG_D, LD.
      expect(once.LI).toBe("zi");
      expect(once.ZAG_I).toBe("li");
      expect(once.ZAG_D).toBe("ld");
      expect(once.LD).toBe("zd");
      expect(once.CINCO).toBe("cinco"); // MED: 5, 8, 10, 14
      expect(once.INT_I).toBe("ii");
      expect(once.INT_D).toBe("id");
      expect(once.EXT_I).toBe("ed"); // DEL: 7, 11, 19 (el 9 ya está)
      expect(once.EXT_D).toBe("ei");
    });

    it("no se rellena con Jugadores no Disponibles ni fuera del Plantel", () => {
      const jugadores = plantel.map((j) =>
        j.id === "arq1" ? { ...j, disponibilidad: "lesionado" as const } : j.id === "arq2" ? { ...j, enPlantel: false } : j,
      );
      const r = contar({ alineaciones: [alineacion("4-3-3", { DEL: "dc" })], jugadores });
      expect(onceDe(r).ARQ).toBeNull();
      expect(origenDe(r, "ARQ")).toBe("vacante");
    });

    it("el relleno por votos en otros Puestos respeta la regla del arquero", () => {
      // arq2 tiene votos (en el arco) pero arq1 tiene más: arq2 no puede rellenar un Puesto de campo.
      const r = contar({
        alineaciones: [
          alineacion("4-3-3", { ARQ: "arq1" }),
          alineacion("4-3-3", { ARQ: "arq1" }),
          alineacion("4-3-3", { ARQ: "arq2" }),
        ],
        jugadores: plantel,
      });
      expect(onceDe(r).ARQ).toBe("arq1");
      expect(Object.values(onceDe(r))).not.toContain("arq2");
    });
  });

  describe("desempates de asignación", () => {
    it("entre candidatos con los mismos votos gana el que llegó antes a ese total", () => {
      const r = contar({
        alineaciones: [
          alineacion("4-3-3", { DEL: ["del5", 5] }),
          alineacion("4-3-3", { DEL: ["del5", 30] }),
          alineacion("4-3-3", { DEL: ["dc", 0] }),
          alineacion("4-3-3", { DEL: ["dc", 40] }),
        ],
        jugadores: plantel,
      });
      expect(onceDe(r).DEL).toBe("del5");
      // Los candidatos se listan con el mismo criterio.
      expect(candidatosDe(r, "DEL")?.map((c) => c.jugadorId)).toEqual(["del5", "dc"]);
    });

    it("con votos y horas iguales decide el número de camiseta (y después el id)", () => {
      const jugadores = [...plantel, jugador("otro9", 9, "DEL")];
      const r = contar({
        alineaciones: [
          alineacion("4-3-3", { DEL: "del5" }),
          alineacion("4-3-3", { DEL: "dc" }),
          alineacion("4-3-3", { DEL: "otro9" }),
        ],
        jugadores,
      });
      expect(onceDe(r).DEL).toBe("dc"); // 9 antes que 19; "dc" antes que "otro9"
      expect(candidatosDe(r, "DEL")?.map((c) => c.jugadorId)).toEqual(["dc", "otro9", "del5"]);
    });

    it("en la Selección (sin número de camiseta) con votos y horas iguales decide el id", () => {
      const sinNumero = (id: string) => jugador(id, 0, "DEL", { numero: null });
      const jugadores = [jugador("arq", 0, "ARQ", { numero: null }), sinNumero("del-b"), sinNumero("del-a"), sinNumero("del-c")];
      const alineaciones = [
        alineacion("4-3-3", { DEL: "del-c" }),
        alineacion("4-3-3", { DEL: "del-b" }),
        alineacion("4-3-3", { DEL: "del-a" }),
      ];
      const r = contar({ alineaciones, jugadores });
      expect(onceDe(r).DEL).toBe("del-a");
      expect(candidatosDe(r, "DEL")?.map((c) => c.jugadorId)).toEqual(["del-a", "del-b", "del-c"]);
      // El orden no depende del orden de entrada.
      expect(contar({ alineaciones: [...alineaciones].reverse(), jugadores: [...jugadores].reverse() })).toEqual(r);
    });

    it("un Jugador sin número va después de los que tienen número", () => {
      const jugadores = [...plantel, jugador("aaa-sin-numero", 0, "DEL", { numero: null })];
      const r = contar({
        alineaciones: [alineacion("4-3-3", { DEL: "aaa-sin-numero" }), alineacion("4-3-3", { DEL: "del5" })],
        jugadores,
      });
      expect(candidatosDe(r, "DEL")?.map((c) => c.jugadorId)).toEqual(["del5", "aaa-sin-numero"]);
    });

    it("empate de asignaciones completas: gana la de votos consolidados antes", () => {
      // dc tiene 1 voto en DEL y 1 en EXT_D; del5 1 en DEL; ed 1 en EXT_D.
      // dc→DEL + ed→EXT_D y dc→EXT_D + del5→DEL suman 2 votos las dos.
      const base = (minEd: number, minDel5: number) =>
        contar({
          alineaciones: [
            alineacion("4-3-3", { DEL: ["dc", 0], EXT_D: ["ed", minEd] }),
            alineacion("4-3-3", { EXT_D: ["dc", 0], DEL: ["del5", minDel5] }),
          ],
          jugadores: plantel,
        });
      expect(onceDe(base(10, 20))).toMatchObject({ DEL: "dc", EXT_D: "ed" });
      expect(onceDe(base(20, 10))).toMatchObject({ DEL: "del5", EXT_D: "dc" });
    });

    it("empate total de asignaciones: orden fijo (Puestos del catálogo, menor número de camiseta primero)", () => {
      // Igual que arriba, sin diferencia de horas: DEL va antes que EXT_D en
      // el 4-3-3, y en DEL el de menor número entre dc (9) y del5 (19) es dc.
      const r = contar({
        alineaciones: [
          alineacion("4-3-3", { DEL: "dc", EXT_D: "ed" }),
          alineacion("4-3-3", { EXT_D: "dc", DEL: "del5" }),
        ],
        jugadores: plantel,
      });
      expect(onceDe(r)).toMatchObject({ DEL: "dc", EXT_D: "ed" });
    });
  });

  describe("determinismo", () => {
    it("con la misma entrada da la misma salida, aunque cambie el orden de Alineaciones, Puestos y Jugadores", () => {
      const ids = plantel.map((j) => j.id);
      const deCampo = plantel.filter((j) => j.posicionNatural !== "ARQ").map((j) => j.id);
      const esquemasIds: EsquemaId[] = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2", "4-1-4-1", "4-3-1-2"];
      let s = 7;
      const azar = (n: number) => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s % n;
      };
      const alineaciones = veces(300, (i) => {
        const e = esquemasIds[azar(esquemasIds.length)];
        const puestos: Partial<Record<PuestoId, [string, number]>> = {};
        const libres = barajar(deCampo, i + 1);
        for (const p of esquema(e).puestos) {
          if (azar(4) === 0) continue; // deja vacantes
          const j = p.esArquero ? (azar(2) ? "arq1" : "arq2") : libres.pop()!;
          puestos[p.id] = [j, azar(5)]; // pocas horas distintas: muchos empates
        }
        return alineacion(e, puestos, { esquemaElegidoAMano: azar(3) === 0 });
      });
      expect(ids.length).toBeGreaterThan(11);

      const esperado = contar({ alineaciones, jugadores: plantel });
      for (let k = 1; k <= 5; k++) {
        const alineacionesBarajadas = barajar(alineaciones, k).map((a) => ({
          ...a,
          puestos: Object.fromEntries(barajar(Object.entries(a.puestos), k)),
        }));
        expect(contar({ alineaciones: alineacionesBarajadas, jugadores: barajar(plantel, k * 13) })).toEqual(esperado);
      }
    });
  });

  describe("rendimiento", () => {
    it("cuenta 50.000 Alineaciones en tiempo razonable", () => {
      const esquemasIds: EsquemaId[] = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2", "4-1-4-1", "4-3-1-2"];
      const deCampo = plantel.filter((j) => j.posicionNatural !== "ARQ").map((j) => j.id);
      const plantelGrande = [
        ...plantel,
        ...veces(15, (i) => jugador(`extra${i}`, 20 + i, (["DEF", "MED", "DEL"] as const)[i % 3])),
      ];
      const campo = [...deCampo, ...plantelGrande.slice(plantel.length).map((j) => j.id)];
      const alineaciones = veces(50_000, (i) => {
        const e = esquemasIds[i % esquemasIds.length];
        const puestos: Partial<Record<PuestoId, PuestoOcupadoParaConteo>> = {};
        esquema(e).puestos.forEach((p, k) => {
          const jugadorId = p.esArquero ? (i % 3 ? "arq1" : "arq2") : campo[(i * 7 + k * 3) % campo.length];
          puestos[p.id] = { jugadorId, modificadoEn: hora(i % 1000) };
        });
        return { esquema: e, esquemaElegidoAMano: true, puestos };
      });
      const inicio = performance.now();
      const r = conDatos(contar({ alineaciones, jugadores: plantelGrande }));
      const ms = performance.now() - inicio;
      expect(r.alineacionesQueCuentan).toBe(50_000);
      expect(r.once).toHaveLength(11);
      expect(ms).toBeLessThan(2000);
    });
  });
});

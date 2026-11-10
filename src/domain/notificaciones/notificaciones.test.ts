import { describe, expect, it } from "vitest";
import type { ClubId } from "@/domain/comun/tipos";
import type { Alineacion } from "@/domain/editor";
import {
  AVISO_DE_CIERRE_MS,
  avisosPendientes,
  type DatosDelClub,
  type EntradaAvisos,
  type JugadorParaAvisos,
  type PartidoParaAvisos,
} from "./index";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2026, 10, 1, 12);
const en = (ms: number) => new Date(T + ms);

// Peñarol: "a" ya se jugó; la Votación de "b" abre al terminar "a" (T + 2 h)
// y cierra a las T + 7 días - 1 h.
function partido(id: string, inicio: Date, extra: Partial<PartidoParaAvisos> = {}): PartidoParaAvisos {
  return { id, inicio, estado: "programado", creadoEn: en(-30 * DIA), rival: `Rival de ${id}`, ...extra };
}

const partidosPenarol = [partido("a", en(0)), partido("b", en(7 * DIA))];
const partidosNacional = [partido("n", en(10 * DIA), { creadoEn: en(30 * DIA) })]; // cargado después de su cierre: su Votación nunca abre

function jugador(id: string, extra: Partial<JugadorParaAvisos> = {}): JugadorParaAvisos {
  return { id, nombre: `Jugador ${id}`, posicionNatural: "MED", disponibilidad: "disponible", enPlantel: true, ...extra };
}

function alineacionCon(...jugadores: string[]): Alineacion {
  const puestos = ["CINCO", "INT_I", "INT_D"] as const;
  return {
    esquema: "4-3-3",
    esquemaElegidoAMano: false,
    puestos: Object.fromEntries(jugadores.map((j, i) => [puestos[i], { jugadorId: j, modificadoEn: en(3 * HORA) }])),
  };
}

function club(club: ClubId, extra: Partial<DatosDelClub> = {}): DatosDelClub {
  return {
    club,
    partidos: club === "penarol" ? partidosPenarol : partidosNacional,
    resultados: [],
    eventos: [],
    plantel: [],
    alineaciones: [],
    ...extra,
  };
}

function entrada(ahora: Date, extra: Partial<EntradaAvisos> = {}): EntradaAvisos {
  return {
    ahora,
    hinchas: [
      { id: "h1", club: "penarol" },
      { id: "h2", club: "penarol" },
      { id: "h3", club: "nacional" },
    ],
    clubes: [club("penarol"), club("nacional")],
    yaEnviadas: [],
    ...extra,
  };
}

const claves = (avisos: ReturnType<typeof avisosPendientes>) =>
  avisos.map((a) => `${a.hinchaId} ${a.tipo} ${a.referencia}`).sort();

describe("abrió la Votación", () => {
  it("avisa a los Hinchas del Club cuya Votación está abierta, y a nadie más", () => {
    const avisos = avisosPendientes(entrada(en(3 * HORA)));
    expect(claves(avisos)).toEqual(["h1 votacion_abierta b", "h2 votacion_abierta b"]);
    expect(avisos[0]!.mensaje).toMatchObject({ url: "/mi-alineacion" });
    expect(avisos[0]!.mensaje.cuerpo).toContain("Rival de b");
  });

  it("sin Votación abierta no avisa", () => {
    expect(avisosPendientes(entrada(en(HORA)))).toEqual([]);
  });
});

describe("registro de enviados", () => {
  it("no repite lo que ya se envió a ese Hincha", () => {
    const avisos = avisosPendientes(
      entrada(en(3 * HORA), { yaEnviadas: [{ hinchaId: "h1", tipo: "votacion_abierta", referencia: "b" }] }),
    );
    expect(claves(avisos)).toEqual(["h2 votacion_abierta b"]);
  });

  it("un Hincha repetido en la entrada recibe un solo aviso", () => {
    const hinchas = [
      { id: "h1", club: "penarol" as const },
      { id: "h1", club: "penarol" as const },
    ];
    expect(claves(avisosPendientes(entrada(en(3 * HORA), { hinchas })))).toEqual(["h1 votacion_abierta b"]);
  });
});

describe("cierra pronto", () => {
  // La Votación de "b" cierra a las T + 7 días - 1 h.
  const cierreB = 7 * DIA - HORA;

  it("con más de 3 horas para el cierre no avisa", () => {
    const enviadas = [
      { hinchaId: "h1", tipo: "votacion_abierta" as const, referencia: "b" },
      { hinchaId: "h2", tipo: "votacion_abierta" as const, referencia: "b" },
    ];
    expect(avisosPendientes(entrada(en(cierreB - 3 * HORA - 1), { yaEnviadas: enviadas }))).toEqual([]);
  });

  it("a 3 horas o menos del cierre avisa a los Hinchas del Club", () => {
    const enviadas = [{ hinchaId: "h1", tipo: "votacion_abierta" as const, referencia: "b" }];
    const avisos = avisosPendientes(entrada(en(cierreB - 3 * HORA), { yaEnviadas: enviadas }));
    // h2 nunca recibió "abrió": como ya cierra pronto, recibe solo este aviso.
    expect(claves(avisos)).toEqual(["h1 cierra_pronto b", "h2 cierra_pronto b"]);
    expect(avisos[0]!.mensaje.url).toBe("/mi-alineacion");
  });

  it("después del cierre ya no avisa", () => {
    expect(avisosPendientes(entrada(en(cierreB)))).toEqual([]);
  });
});

describe("salió el 11 Elegido", () => {
  // La Votación de "a" cerró a las T - 1 h. Durante el Partido "a" no hay Votación abierta.
  const cierreA = en(-HORA);
  const conResultado = (estado: "con_once" | "sin_alineaciones" | "anulada" | "nunca_abrio", cierre = cierreA) =>
    club("penarol", { resultados: [{ partidoId: "a", estado, cierre }] });

  it("avisa a los Hinchas del Club cuando hay 11 Elegido", () => {
    const avisos = avisosPendientes(entrada(en(HORA), { clubes: [conResultado("con_once"), club("nacional")] }));
    expect(claves(avisos)).toEqual(["h1 once_elegido a", "h2 once_elegido a"]);
    expect(avisos[0]!.mensaje.url).toBe("/resultados/a");
    expect(avisos[0]!.mensaje.cuerpo).toContain("Rival de a");
  });

  it("sin 11 Elegido (sin Alineaciones, anulada, nunca abrió) no avisa", () => {
    for (const estado of ["sin_alineaciones", "anulada", "nunca_abrio"] as const) {
      expect(avisosPendientes(entrada(en(HORA), { clubes: [conResultado(estado)] }))).toEqual([]);
    }
  });

  it("no avisa resultados viejos (cierre de hace más de 48 horas)", () => {
    const clubes = [conResultado("con_once")];
    const onces = (ahora: Date) => avisosPendientes(entrada(ahora, { clubes })).filter((a) => a.tipo === "once_elegido");
    expect(onces(new Date(cierreA.getTime() + 2 * DIA))).toHaveLength(2);
    expect(onces(new Date(cierreA.getTime() + 2 * DIA + 1))).toEqual([]);
  });
});

describe("jugador tuyo no disponible", () => {
  // La Votación de "b" abre a las T + 2 h. Todos los Hinchas ya recibieron "abrió".
  const ahora = en(DIA);
  const yaEnviadas = ["h1", "h2", "h3"].map((h) => ({ hinchaId: h, tipo: "votacion_abierta" as const, referencia: "b" }));
  const plantel = [
    jugador("x", { disponibilidad: "lesionado" }),
    jugador("y"),
    jugador("z", { disponibilidad: "suspendido" }),
  ];
  const evento = (id: string, jugadorId: string, momento: Date, nueva: JugadorParaAvisos["disponibilidad"] = "lesionado") => ({
    id,
    jugadorId,
    disponibilidadNueva: nueva,
    momento,
  });
  const conEventos = (eventos: DatosDelClub["eventos"], alineaciones?: DatosDelClub["alineaciones"]) =>
    entrada(ahora, {
      yaEnviadas,
      clubes: [
        club("penarol", {
          plantel,
          eventos,
          alineaciones: alineaciones ?? [
            { hinchaId: "h1", alineacion: alineacionCon("x", "y") },
            { hinchaId: "h2", alineacion: alineacionCon("y") },
          ],
        }),
        club("nacional"),
      ],
    });

  it("avisa solo a los Hinchas que tienen a ese Jugador en su Alineación", () => {
    const avisos = avisosPendientes(conEventos([evento("e1", "x", en(5 * HORA))]));
    expect(claves(avisos)).toEqual(["h1 jugador_no_disponible e1"]);
    expect(avisos[0]!.mensaje.titulo).toBe("Jugador x está lesionado");
    expect(avisos[0]!.mensaje.url).toBe("/mi-alineacion");
  });

  it("no avisa si el Jugador volvió a estar Disponible", () => {
    expect(avisosPendientes(conEventos([evento("e1", "y", en(5 * HORA))]))).toEqual([]);
    expect(avisosPendientes(conEventos([evento("e2", "y", en(5 * HORA), "disponible")]))).toEqual([]);
  });

  it("no avisa cambios anteriores a la apertura de la Votación ni posteriores a ahora", () => {
    expect(avisosPendientes(conEventos([evento("e1", "x", en(HORA))]))).toEqual([]);
    expect(avisosPendientes(conEventos([evento("e1", "x", en(2 * DIA))]))).toEqual([]);
  });

  it("si el Jugador cambió varias veces, avisa solo por el último cambio", () => {
    const avisos = avisosPendientes(
      conEventos([evento("e2", "x", en(8 * HORA), "lesionado"), evento("e1", "x", en(5 * HORA), "suspendido")]),
    );
    expect(claves(avisos)).toEqual(["h1 jugador_no_disponible e2"]);
  });

  it("un aviso por cada Jugador afectado", () => {
    const avisos = avisosPendientes(
      conEventos(
        [evento("e1", "x", en(5 * HORA)), evento("e3", "z", en(6 * HORA), "suspendido")],
        [{ hinchaId: "h1", alineacion: alineacionCon("x", "z") }],
      ),
    );
    expect(claves(avisos)).toEqual(["h1 jugador_no_disponible e1", "h1 jugador_no_disponible e3"]);
  });

  it("no avisa a un Hincha que hoy es de otro Club ni sin Votación abierta", () => {
    const alineaciones = [{ hinchaId: "h3", alineacion: alineacionCon("x") }];
    expect(avisosPendientes(conEventos([evento("e1", "x", en(5 * HORA))], alineaciones))).toEqual([]);
    const cerrada = { ...conEventos([evento("e1", "x", en(5 * HORA))]), ahora: en(7 * DIA) };
    expect(avisosPendientes(cerrada).filter((a) => a.tipo === "jugador_no_disponible")).toEqual([]);
  });
});

describe("corridas frecuentes (el cron corre cada minuto)", () => {
  const MIN = 60 * 1000;
  const abre = en(2 * HORA); // termina "a"
  const cierra = en(7 * DIA - HORA);
  const lesion = en(DIA + 17 * MIN + 30 * 1000); // el Admin lesiona a "x" a mitad de un minuto

  /** Corre el proceso cada minuto entre `desde` y `hasta` y anota cuándo salió cada aviso. */
  function simular(desde: Date, hasta: Date): Map<string, Date> {
    const enviados = new Map<string, Date>();
    const yaEnviadas: EntradaAvisos["yaEnviadas"][number][] = [];
    for (let t = desde.getTime(); t <= hasta.getTime(); t += MIN) {
      const ahora = new Date(t);
      const lesionado = t >= lesion.getTime();
      const datos = club("penarol", {
        plantel: [jugador("x", { disponibilidad: lesionado ? "lesionado" : "disponible" }), jugador("y")],
        eventos: lesionado ? [{ id: "e1", jugadorId: "x", disponibilidadNueva: "lesionado", momento: lesion }] : [],
        alineaciones: [
          { hinchaId: "h1", alineacion: alineacionCon("x", "y") },
          { hinchaId: "h2", alineacion: alineacionCon("y") },
        ],
      });
      const avisos = avisosPendientes(entrada(ahora, { clubes: [datos, club("nacional")], yaEnviadas: [...yaEnviadas] }));
      for (const a of avisos) {
        const k = `${a.hinchaId} ${a.tipo} ${a.referencia}`;
        expect(enviados.has(k), `${k} se repitió a las ${ahora.toISOString()}`).toBe(false);
        enviados.set(k, ahora);
        yaEnviadas.push({ hinchaId: a.hinchaId, tipo: a.tipo, referencia: a.referencia });
      }
    }
    return enviados;
  }

  it("cada aviso sale una sola vez y a tiempo: abrió al abrir, no disponible ≤ 1 min, cierra pronto a 3 horas", () => {
    const enviados = simular(en(HORA), en(7 * DIA));
    expect([...enviados.keys()].sort()).toEqual([
      "h1 cierra_pronto b",
      "h1 jugador_no_disponible e1",
      "h1 votacion_abierta b",
      "h2 cierra_pronto b",
      "h2 votacion_abierta b",
    ]);
    expect(enviados.get("h1 votacion_abierta b")).toEqual(abre);
    const demoraNoDisponible = enviados.get("h1 jugador_no_disponible e1")!.getTime() - lesion.getTime();
    expect(demoraNoDisponible).toBeGreaterThanOrEqual(0);
    expect(demoraNoDisponible).toBeLessThanOrEqual(MIN);
    expect(enviados.get("h1 cierra_pronto b")).toEqual(new Date(cierra.getTime() - AVISO_DE_CIERRE_MS));
  });
});

describe("Votación con resultado congelado y Partido postergado", () => {
  // "b" se suspendió en la última hora y ya tenía 11 Elegido; el Admin lo pasó
  // a otra fecha y el Calendario lo ve abierto, pero la Votación no se reabre.
  it("no avisa que abrió, que cierra pronto ni que un Jugador no está disponible", () => {
    const ahora = en(7 * DIA - 2 * HORA);
    const datos = club("penarol", {
      partidosConResultado: ["b"],
      plantel: [jugador("x", { disponibilidad: "lesionado" })],
      eventos: [{ id: "e1", jugadorId: "x", disponibilidadNueva: "lesionado", momento: en(DIA) }],
      alineaciones: [{ hinchaId: "h1", alineacion: alineacionCon("x") }],
    });
    expect(avisosPendientes(entrada(ahora, { clubes: [datos, club("nacional")] }))).toEqual([]);
  });
});

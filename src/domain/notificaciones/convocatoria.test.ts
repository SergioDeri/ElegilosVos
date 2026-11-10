// Notificaciones de la Selección (feature Selección, ticket 14): Convocatoria
// cargada con el Gran Ausente provisorio y Gran Ausente final con el 11
// Elegido (al cierre, o al cargar la Convocatoria tarde), una sola vez por
// Partido, nombrando al Rival.
import { describe, expect, it } from "vitest";
import type { Apariciones } from "@/domain/destacados";
import {
  avisosPendientes,
  TIPOS_DE_NOTIFICACION,
  type DatosDeLaSeleccion,
  type EntradaAvisos,
  type HinchaConSuscripcion,
  type NotificacionEnviada,
  type PartidoParaAvisos,
} from "./index";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2026, 10, 1, 12);
const en = (ms: number) => new Date(T + ms);

function partido(id: string, inicio: Date, rival: string): PartidoParaAvisos {
  return { id, inicio, estado: "programado", creadoEn: en(-60 * DIA), rival };
}

// Fecha doble: "peru" abre en T - 4 días y cierra en T + 10 días - 1 h;
// "vene" abre en T + 1 día y cierra en T + 15 días - 1 h.
const fechaDoble = [partido("peru", en(10 * DIA), "Perú"), partido("vene", en(15 * DIA), "Venezuela")];
const CIERRE_PERU = 10 * DIA - HORA;

const plantel = [
  { id: "suarez", nombre: "Luis Suárez" },
  { id: "cavani", nombre: "Edinson Cavani" },
  { id: "valverde", nombre: "Federico Valverde" },
];

// Suárez figura en 3 de 4 Alineaciones, Cavani en 2, Valverde en 4.
const apariciones: Apariciones = {
  alineaciones: 4,
  porJugador: [
    { jugadorId: "cavani", apariciones: 2 },
    { jugadorId: "suarez", apariciones: 3 },
    { jugadorId: "valverde", apariciones: 4 },
  ],
};
// Convocados: Valverde y Cavani. Gran Ausente: Suárez.
const convocados = ["cavani", "valverde"];

const conClub: HinchaConSuscripcion = { id: "con-club", club: "penarol" };
const sinClub: HinchaConSuscripcion = { id: "sin-club", club: null };

function entrada(
  ahora: Date,
  seleccion: Partial<DatosDeLaSeleccion>,
  extra: Partial<EntradaAvisos> = {},
): EntradaAvisos {
  return {
    ahora,
    hinchas: [conClub, sinClub],
    clubes: [],
    seleccion: { partidos: fechaDoble, plantel, ...seleccion },
    yaEnviadas: [],
    ...extra,
  };
}

// Ya se avisó la apertura de las dos Votaciones: así cada test ve solo lo suyo.
const aperturasAvisadas = (hinchas: readonly string[] = ["con-club", "sin-club"]): NotificacionEnviada[] =>
  hinchas.flatMap((hinchaId) =>
    ["peru", "vene"].map((referencia) => ({ hinchaId, tipo: "votacion_abierta" as const, referencia })),
  );

const claves = (avisos: ReturnType<typeof avisosPendientes>) =>
  avisos.map((a) => `${a.hinchaId} ${a.tipo} ${a.referencia}`).sort();

describe("tipos de notificación", () => {
  it("agrega Convocatoria cargada y Gran Ausente final", () => {
    expect(TIPOS_DE_NOTIFICACION).toContain("convocatoria_cargada");
    expect(TIPOS_DE_NOTIFICACION).toContain("gran_ausente_final");
  });
});

describe("Convocatoria cargada", () => {
  const conConvocatoria = { convocatorias: [{ partidoId: "peru", convocados, actualizadaEn: en(-HORA) }] };

  it("avisa a los Hinchas con Club y sin Club, con el Gran Ausente provisorio y el Rival", () => {
    const avisos = avisosPendientes(
      entrada(en(0), { ...conConvocatoria, apariciones: [{ partidoId: "peru", apariciones }] }, {
        yaEnviadas: aperturasAvisadas(),
      }),
    );
    expect(claves(avisos)).toEqual(["con-club convocatoria_cargada peru", "sin-club convocatoria_cargada peru"]);
    const { mensaje } = avisos[0]!;
    expect(mensaje.titulo).toBe("Salió la Convocatoria de la Selección");
    expect(mensaje.cuerpo).toContain("Perú");
    expect(mensaje.cuerpo).toContain("Gran Ausente");
    expect(mensaje.cuerpo).toContain("Luis Suárez");
    expect(mensaje.url).toBe("/seleccion/parcial?partido=peru");
    expect(mensaje.etiqueta).toBe("convocatoria:peru");
  });

  it("sin no convocados elegidos (o sin Alineaciones) sale sin Gran Ausente", () => {
    const todos = { convocatorias: [{ partidoId: "peru", convocados: ["cavani", "suarez", "valverde"], actualizadaEn: en(0) }] };
    for (const seleccion of [{ ...todos, apariciones: [{ partidoId: "peru", apariciones }] }, todos]) {
      const avisos = avisosPendientes(entrada(en(0), seleccion, { hinchas: [sinClub], yaEnviadas: aperturasAvisadas() }));
      expect(claves(avisos)).toEqual(["sin-club convocatoria_cargada peru"]);
      expect(avisos[0]!.mensaje.cuerpo).toContain("Perú");
      expect(avisos[0]!.mensaje.cuerpo).not.toContain("Gran Ausente");
    }
  });

  it("una sola vez por Partido: corregir la Convocatoria no vuelve a avisar", () => {
    const yaEnviadas = [
      ...aperturasAvisadas(),
      { hinchaId: "con-club", tipo: "convocatoria_cargada" as const, referencia: "peru" },
      { hinchaId: "sin-club", tipo: "convocatoria_cargada" as const, referencia: "peru" },
    ];
    const corregida = { convocatorias: [{ partidoId: "peru", convocados: ["suarez"], actualizadaEn: en(HORA) }] };
    expect(avisosPendientes(entrada(en(2 * HORA), corregida, { yaEnviadas }))).toEqual([]);
  });

  it("fecha doble: una Convocatoria para los dos Partidos da un aviso por Partido, cada uno con su Rival", () => {
    const seleccion = {
      convocatorias: ["peru", "vene"].map((partidoId) => ({ partidoId, convocados, actualizadaEn: en(DIA) })),
    };
    const avisos = avisosPendientes(entrada(en(2 * DIA), seleccion, { hinchas: [sinClub], yaEnviadas: aperturasAvisadas() }));
    expect(claves(avisos)).toEqual(["sin-club convocatoria_cargada peru", "sin-club convocatoria_cargada vene"]);
    const vene = avisos.find((a) => a.referencia === "vene")!.mensaje;
    expect(vene.cuerpo).toContain("Venezuela");
    expect(vene.cuerpo).not.toContain("Perú");
    expect(vene.url).toBe("/seleccion/parcial?partido=vene");
    expect(new Set(avisos.map((a) => a.mensaje.etiqueta)).size).toBe(2);
  });

  it("de un Partido cuya Votación todavía no abrió o ya cerró no se avisa Convocatoria cargada", () => {
    const seleccion = {
      convocatorias: ["peru", "vene"].map((partidoId) => ({ partidoId, convocados, actualizadaEn: en(-HORA) })),
      partidosConResultado: ["peru"],
    };
    // En T, "vene" todavía no abrió y "peru" ya tiene resultado.
    expect(avisosPendientes(entrada(en(0), seleccion, { yaEnviadas: aperturasAvisadas() }))).toEqual([]);
  });

  it('solo a los Hinchas con "Selección" prendido', () => {
    const apagado = { ...conClub, preferencias: { miClub: true, seleccion: false } };
    const avisos = avisosPendientes(entrada(en(0), conConvocatoria, { hinchas: [apagado, sinClub], yaEnviadas: aperturasAvisadas() }));
    expect(claves(avisos)).toEqual(["sin-club convocatoria_cargada peru"]);
  });
});

describe("Gran Ausente final", () => {
  const cerrado = { partidoId: "peru", estado: "con_once" as const, cierre: en(CIERRE_PERU), apariciones };
  const despuesDelCierre = en(CIERRE_PERU + HORA);
  const avisadas = aperturasAvisadas();
  const convocatoria = (actualizadaEn: Date, lista = convocados) => [{ partidoId: "peru", convocados: lista, actualizadaEn }];

  it("al cierre, si ya había Convocatoria: avisa el 11 Elegido con el Gran Ausente final y el Rival", () => {
    const seleccion = { convocatorias: convocatoria(en(0)), resultados: [cerrado], partidosConResultado: ["peru"] };
    const avisos = avisosPendientes(entrada(despuesDelCierre, seleccion, { yaEnviadas: avisadas }));
    expect(claves(avisos)).toEqual(["con-club gran_ausente_final peru", "sin-club gran_ausente_final peru"]);
    const { mensaje } = avisos[0]!;
    expect(mensaje.titulo).toBe("Salió el 11 Elegido de la Selección");
    expect(mensaje.cuerpo).toContain("Perú");
    expect(mensaje.cuerpo).toContain("Gran Ausente: Luis Suárez");
    expect(mensaje.url).toBe("/seleccion/resultados/peru");
    expect(mensaje.etiqueta).toBe("once:peru");
  });

  it("al cierre sin Convocatoria no avisa; cuando el Admin la carga tarde, sí (una sola vez)", () => {
    const sinConvocatoria = { resultados: [cerrado], partidosConResultado: ["peru"] };
    expect(avisosPendientes(entrada(despuesDelCierre, sinConvocatoria, { yaEnviadas: avisadas }))).toEqual([]);

    // Cinco días después del cierre el Admin carga la Convocatoria.
    const tarde = en(CIERRE_PERU + 5 * DIA);
    const cargada = { ...sinConvocatoria, convocatorias: convocatoria(tarde) };
    const avisos = avisosPendientes(entrada(en(CIERRE_PERU + 5 * DIA + HORA), cargada, { yaEnviadas: avisadas }));
    expect(claves(avisos)).toEqual(["con-club gran_ausente_final peru", "sin-club gran_ausente_final peru"]);
    expect(avisos[0]!.mensaje.cuerpo).toContain("Gran Ausente: Luis Suárez");

    const yaEnviadas = [...avisadas, ...avisos];
    expect(avisosPendientes(entrada(en(CIERRE_PERU + 5 * DIA + 2 * HORA), cargada, { yaEnviadas }))).toEqual([]);
  });

  it("si ningún no convocado figura, sale igual con el 11 Elegido, sin Gran Ausente", () => {
    const seleccion = {
      convocatorias: convocatoria(en(0), ["cavani", "suarez", "valverde"]),
      resultados: [cerrado],
      partidosConResultado: ["peru"],
    };
    const avisos = avisosPendientes(entrada(despuesDelCierre, seleccion, { hinchas: [sinClub], yaEnviadas: avisadas }));
    expect(claves(avisos)).toEqual(["sin-club gran_ausente_final peru"]);
    expect(avisos[0]!.mensaje.titulo).toBe("Salió el 11 Elegido de la Selección");
    expect(avisos[0]!.mensaje.cuerpo).toContain("Perú");
    expect(avisos[0]!.mensaje.cuerpo).not.toContain("Gran Ausente");
  });

  it("con empate nombra a todos los empatados", () => {
    const empate: Apariciones = {
      alineaciones: 4,
      porJugador: [
        { jugadorId: "cavani", apariciones: 3 },
        { jugadorId: "suarez", apariciones: 3 },
      ],
    };
    const seleccion = {
      convocatorias: convocatoria(en(0), ["valverde"]),
      resultados: [{ ...cerrado, apariciones: empate }],
      partidosConResultado: ["peru"],
    };
    const [aviso] = avisosPendientes(entrada(despuesDelCierre, seleccion, { hinchas: [sinClub], yaEnviadas: avisadas }));
    expect(aviso!.mensaje.cuerpo).toContain("Gran Ausente: Edinson Cavani y Luis Suárez");
  });

  it("no avisa resultados viejos (cierre y Convocatoria de hace más de 48 horas) ni Votaciones sin 11 Elegido", () => {
    const viejo = { convocatorias: convocatoria(en(0)), resultados: [cerrado], partidosConResultado: ["peru"] };
    expect(avisosPendientes(entrada(en(CIERRE_PERU + 49 * HORA), viejo, { yaEnviadas: avisadas }))).toEqual([]);

    // Una Convocatoria cargada después de `ahora` todavía no cuenta.
    const futura = { ...viejo, convocatorias: convocatoria(en(CIERRE_PERU + 2 * HORA)) };
    expect(avisosPendientes(entrada(despuesDelCierre, futura, { yaEnviadas: avisadas }))).toEqual([]);

    for (const estado of ["sin_alineaciones", "anulada", "nunca_abrio"] as const) {
      const sinOnce = { ...viejo, resultados: [{ ...cerrado, estado, apariciones: null }] };
      expect(avisosPendientes(entrada(despuesDelCierre, sinOnce, { yaEnviadas: avisadas }))).toEqual([]);
    }
  });

  it("fecha doble: cada Partido se avisa al cerrar su Votación, con su Rival", () => {
    const CIERRE_VENE = 15 * DIA - HORA;
    const seleccion = {
      convocatorias: ["peru", "vene"].map((partidoId) => ({ partidoId, convocados, actualizadaEn: en(DIA) })),
      resultados: [cerrado, { ...cerrado, partidoId: "vene", cierre: en(CIERRE_VENE) }],
      partidosConResultado: ["peru", "vene"],
    };
    const yaEnviadas = [...avisadas, { hinchaId: "sin-club", tipo: "gran_ausente_final" as const, referencia: "peru" }];
    const avisos = avisosPendientes(entrada(en(CIERRE_VENE + HORA), seleccion, { hinchas: [sinClub], yaEnviadas }));
    expect(claves(avisos)).toEqual(["sin-club gran_ausente_final vene"]);
    expect(avisos[0]!.mensaje.cuerpo).toContain("Venezuela");
    expect(avisos[0]!.mensaje.url).toBe("/seleccion/resultados/vene");
  });

  it('solo a los Hinchas con "Selección" prendido, con Club o sin Club', () => {
    const seleccion = { convocatorias: convocatoria(en(0)), resultados: [cerrado], partidosConResultado: ["peru"] };
    const apagado = { ...sinClub, preferencias: { miClub: true, seleccion: false } };
    const deNacional: HinchaConSuscripcion = { id: "nac", club: "nacional", preferencias: { miClub: false, seleccion: true } };
    const avisos = avisosPendientes(entrada(despuesDelCierre, seleccion, { hinchas: [apagado, deNacional], yaEnviadas: aperturasAvisadas(["sin-club", "nac"]) }));
    expect(claves(avisos)).toEqual(["nac gran_ausente_final peru"]);
  });
});

// Notificaciones de la Selección (feature Selección, ticket 13): avisos de
// Votación abierta y Cierra pronto, uno por Partido en fecha doble, y
// destinatarios según las preferencias "mi club" y "Selección".
import { describe, expect, it } from "vitest";
import {
  avisosPendientes,
  type EntradaAvisos,
  type HinchaConSuscripcion,
  type PartidoParaAvisos,
  interruptoresVisibles,
  preferenciasDesdeFila,
} from "./index";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2026, 10, 1, 12);
const en = (ms: number) => new Date(T + ms);

function partido(id: string, inicio: Date, rival: string): PartidoParaAvisos {
  return { id, inicio, estado: "programado", creadoEn: en(-60 * DIA), rival };
}

// Fecha doble: las dos Votaciones abren 14 días antes de cada inicio.
// "peru" abre en T - 4 días y cierra en T + 10 días - 1 h; "vene" abre en T + 1 día.
const fechaDoble = [partido("peru", en(10 * DIA), "Perú"), partido("vene", en(15 * DIA), "Venezuela")];

// Peñarol con una Votación abierta (abre al cargarse, cierra en T + 7 días - 1 h).
const partidosPenarol = [partido("pen", en(7 * DIA), "Rampla")];

const conClub: HinchaConSuscripcion = { id: "con-club", club: "penarol" };
const sinClub: HinchaConSuscripcion = { id: "sin-club", club: null };

function entrada(ahora: Date, hinchas: readonly HinchaConSuscripcion[], extra: Partial<EntradaAvisos> = {}): EntradaAvisos {
  return {
    ahora,
    hinchas,
    clubes: [{ club: "penarol", partidos: partidosPenarol, resultados: [], eventos: [], plantel: [], alineaciones: [] }],
    seleccion: { partidos: fechaDoble },
    yaEnviadas: [],
    ...extra,
  };
}

const claves = (avisos: ReturnType<typeof avisosPendientes>) =>
  avisos.map((a) => `${a.hinchaId} ${a.tipo} ${a.referencia}`).sort();

describe("interruptores", () => {
  it('un Hincha con Club ve "mi club" y "Selección"; uno sin Club, solo "Selección"', () => {
    expect(interruptoresVisibles("nacional")).toEqual(["miClub", "seleccion"]);
    expect(interruptoresVisibles(null)).toEqual(["seleccion"]);
  });

  it("sin preferencias guardadas, los dos están prendidos", () => {
    expect(preferenciasDesdeFila(null)).toEqual({ miClub: true, seleccion: true });
    expect(preferenciasDesdeFila({ mi_club: false, seleccion: true })).toEqual({ miClub: false, seleccion: true });
  });
});

describe("abrió la Votación de la Selección", () => {
  it("avisa a los Hinchas con Club y sin Club, nombrando al Rival", () => {
    const avisos = avisosPendientes(entrada(en(0), [conClub, sinClub], { clubes: [] }));
    expect(claves(avisos)).toEqual(["con-club votacion_abierta peru", "sin-club votacion_abierta peru"]);
    expect(avisos[0]!.mensaje.cuerpo).toContain("Perú");
    expect(avisos[0]!.mensaje.titulo).toContain("Selección");
    expect(avisos[0]!.mensaje.url).toBe("/seleccion/mi-alineacion?partido=peru");
  });
});

describe("fecha doble", () => {
  it("un aviso por Partido, cada uno con su Rival y su Partido", () => {
    const avisos = avisosPendientes(entrada(en(2 * DIA), [sinClub], { clubes: [] }));
    expect(claves(avisos)).toEqual(["sin-club votacion_abierta peru", "sin-club votacion_abierta vene"]);
    const vene = avisos.find((a) => a.referencia === "vene")!.mensaje;
    expect(vene.cuerpo).toContain("Venezuela");
    expect(vene.cuerpo).not.toContain("Perú");
    expect(vene.url).toBe("/seleccion/mi-alineacion?partido=vene");
    expect(new Set(avisos.map((a) => a.mensaje.etiqueta)).size).toBe(2);
  });

  it("cierra pronto: avisa solo del Partido que cierra, con su Rival", () => {
    const yaEnviadas = ["peru", "vene"].map((referencia) => ({
      hinchaId: "sin-club",
      tipo: "votacion_abierta" as const,
      referencia,
    }));
    const cierrePeru = 10 * DIA - HORA;
    const avisos = avisosPendientes(entrada(en(cierrePeru - 2 * HORA), [sinClub], { clubes: [], yaEnviadas }));
    expect(claves(avisos)).toEqual(["sin-club cierra_pronto peru"]);
    expect(avisos[0]!.mensaje.titulo).toContain("Selección");
    expect(avisos[0]!.mensaje.cuerpo).toContain("Perú");
  });

  it("no avisa de una Votación de la Selección con resultado congelado", () => {
    const avisos = avisosPendientes(
      entrada(en(2 * DIA), [sinClub], { clubes: [], seleccion: { partidos: fechaDoble, partidosConResultado: ["peru"] } }),
    );
    expect(claves(avisos)).toEqual(["sin-club votacion_abierta vene"]);
  });
});

describe("destinatarios según las preferencias", () => {
  const ahora = en(0); // abiertas: Peñarol ("pen") y la Selección ("peru").

  it("con los dos interruptores prendidos (o sin preferencias guardadas) recibe los dos avisos", () => {
    const prendidos = { ...conClub, preferencias: { miClub: true, seleccion: true } };
    expect(claves(avisosPendientes(entrada(ahora, [prendidos])))).toEqual([
      "con-club votacion_abierta pen",
      "con-club votacion_abierta peru",
    ]);
    expect(claves(avisosPendientes(entrada(ahora, [conClub])))).toHaveLength(2);
  });

  it('con "Selección" apagado recibe solo los de su Club', () => {
    const hincha = { ...conClub, preferencias: { miClub: true, seleccion: false } };
    expect(claves(avisosPendientes(entrada(ahora, [hincha])))).toEqual(["con-club votacion_abierta pen"]);
  });

  it('con "mi club" apagado recibe solo los de la Selección, tampoco 11 Elegido ni Jugador no disponible', () => {
    const hincha = { ...conClub, preferencias: { miClub: false, seleccion: true } };
    const conTodo = entrada(en(HORA), [hincha], {
      clubes: [
        {
          club: "penarol",
          partidos: partidosPenarol,
          resultados: [{ partidoId: "pen", estado: "con_once", cierre: en(-HORA) }],
          eventos: [{ id: "ev", jugadorId: "j", disponibilidadNueva: "lesionado", momento: en(HORA / 2) }],
          plantel: [{ id: "j", nombre: "J", posicionNatural: "MED", disponibilidad: "lesionado", enPlantel: true }],
          alineaciones: [
            {
              hinchaId: "con-club",
              alineacion: {
                esquema: "4-3-3",
                esquemaElegidoAMano: false,
                puestos: { CINCO: { jugadorId: "j", modificadoEn: en(0) } },
              },
            },
          ],
        },
      ],
    });
    expect(claves(avisosPendientes(conTodo))).toEqual(["con-club votacion_abierta peru"]);
    // Prendido, los mismos datos sí avisan (el escenario no es vacío).
    expect(claves(avisosPendientes({ ...conTodo, hinchas: [conClub] }))).toEqual([
      "con-club jugador_no_disponible ev",
      "con-club once_elegido pen",
      "con-club votacion_abierta pen",
      "con-club votacion_abierta peru",
    ]);
  });

  it("con los dos apagados no recibe nada", () => {
    const hincha = { ...conClub, preferencias: { miClub: false, seleccion: false } };
    expect(avisosPendientes(entrada(ahora, [hincha]))).toEqual([]);
  });

  it('un Hincha sin Club recibe solo los de la Selección, aunque tenga "mi club" prendido', () => {
    const hincha = { ...sinClub, preferencias: { miClub: true, seleccion: true } };
    expect(claves(avisosPendientes(entrada(ahora, [hincha])))).toEqual(["sin-club votacion_abierta peru"]);
  });

  it("los Hinchas de otro Club reciben los de la Selección, no los de Peñarol", () => {
    const deNacional: HinchaConSuscripcion = { id: "nac", club: "nacional" };
    expect(claves(avisosPendientes(entrada(ahora, [deNacional])))).toEqual(["nac votacion_abierta peru"]);
  });
});

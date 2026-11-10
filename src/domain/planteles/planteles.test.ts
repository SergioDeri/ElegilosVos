import { describe, expect, it } from "vitest";
import {
  nombreCorto,
  CABECERA_ESCUDO,
  LADO_ESCUDO,
  TAMANO_MAXIMO_ESCUDO,
  validarDatosJugador,
  validarDisponibilidad,
  validarEscudo,
  validarJugador,
} from "./index";

const valido = {
  nombre: "  Santiago Díaz ",
  numero: "1",
  posicionNatural: "ARQ",
  disponibilidad: "disponible",
  motivo: "",
  plantel: "penarol",
} as const;

describe("validarJugador", () => {
  it("acepta datos válidos y normaliza el nombre", () => {
    expect(validarJugador(valido)).toEqual({
      ok: true,
      jugador: {
        nombre: "Santiago Díaz",
        numero: 1,
        posicionNatural: "ARQ",
        disponibilidad: "disponible",
        motivoDisponibilidad: null,
      },
    });
  });

  it("rechaza nombre vacío", () => {
    const r = validarJugador({ ...valido, nombre: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(["nombre"]);
  });

  it("rechaza nombres de más de 80 caracteres", () => {
    const r = validarJugador({ ...valido, nombre: "a".repeat(81) });
    expect(r.ok).toBe(false);
  });

  it.each(["0", "100", "7.5", "", "diez", "-3"])("rechaza el número %j", (numero) => {
    const r = validarJugador({ ...valido, numero });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(["numero"]);
  });

  it("acepta número como number", () => {
    const r = validarJugador({ ...valido, numero: 99 });
    expect(r.ok && r.jugador.numero).toBe(99);
  });

  it("rechaza posición natural o Disponibilidad desconocidas", () => {
    const r = validarJugador({ ...valido, posicionNatural: "DC", disponibilidad: "lesionadisimo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(["disponibilidad", "posicionNatural"]);
  });

  it("descarta el motivo cuando el Jugador está Disponible", () => {
    const r = validarJugador({ ...valido, motivo: "Desgarro" });
    expect(r.ok && r.jugador.motivoDisponibilidad).toBeNull();
  });

  it("guarda el motivo recortado cuando no está Disponible", () => {
    const r = validarJugador({ ...valido, disponibilidad: "lesionado", motivo: "  Desgarro  " });
    expect(r.ok && r.jugador).toMatchObject({ disponibilidad: "lesionado", motivoDisponibilidad: "Desgarro" });
  });

  it("el motivo es opcional aunque no esté Disponible", () => {
    const r = validarJugador({ ...valido, disponibilidad: "suspendido", motivo: undefined });
    expect(r.ok && r.jugador.motivoDisponibilidad).toBeNull();
  });

  it("rechaza motivos de más de 200 caracteres", () => {
    const r = validarJugador({ ...valido, disponibilidad: "lesionado", motivo: "x".repeat(201) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(["motivo"]);
  });
});

describe("validarDatosJugador y validarDisponibilidad por separado", () => {
  it("valida solo nombre, número y posición natural", () => {
    expect(validarDatosJugador({ nombre: "Ana", numero: "9", posicionNatural: "DEL", plantel: "nacional" })).toEqual({
      ok: true,
      datos: { nombre: "Ana", numero: 9, posicionNatural: "DEL" },
    });
    expect(validarDatosJugador({ nombre: "", numero: "9", posicionNatural: "DEL", plantel: "nacional" }).ok).toBe(false);
  });

  it("valida solo la Disponibilidad y su motivo", () => {
    expect(validarDisponibilidad({ disponibilidad: "suspendido", motivo: " Roja " })).toEqual({
      ok: true,
      disponibilidad: { disponibilidad: "suspendido", motivoDisponibilidad: "Roja" },
    });
    expect(validarDisponibilidad({ disponibilidad: "x", motivo: "" }).ok).toBe(false);
  });
});

/** Cabecera de un PNG: firma + chunk IHDR que declara ancho x alto. */
function png(ancho: number, alto: number, tipoChunk = "IHDR"): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const v = new DataView(b.buffer);
  v.setUint32(8, 13);
  b.set([...tipoChunk].map((c) => c.charCodeAt(0)), 12);
  v.setUint32(16, ancho);
  v.setUint32(20, alto);
  return b;
}
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, ...Array(30).fill(0)]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, ...Array(30).fill(0)]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...Array(30).fill(0)]);

describe("validarEscudo", () => {
  it("acepta un PNG de exactamente 48x48", () => {
    expect(LADO_ESCUDO).toBe(48);
    expect(validarEscudo({ tamano: 1000, cabecera: png(48, 48) })).toEqual({ ok: true, tipo: "image/png", extension: "png" });
  });

  it("alcanza con leer CABECERA_ESCUDO bytes", () => {
    expect(CABECERA_ESCUDO).toBe(24);
    expect(validarEscudo({ tamano: 1000, cabecera: png(48, 48).subarray(0, CABECERA_ESCUDO) }).ok).toBe(true);
  });

  it.each([
    [47, 48],
    [48, 49],
    [96, 96],
    [24, 24],
    [0, 0],
  ])("rechaza un PNG de %ix%i por dimensiones", (ancho, alto) => {
    expect(validarEscudo({ tamano: 1000, cabecera: png(ancho, alto) })).toEqual({ ok: false, motivo: "dimensiones" });
  });

  it("rechaza JPEG, WebP, GIF y basura por formato, aunque digan ser imagen", () => {
    for (const cabecera of [JPEG, WEBP, GIF, new Uint8Array([1, 2])])
      expect(validarEscudo({ tamano: 1000, cabecera })).toEqual({ ok: false, motivo: "formato" });
  });

  it("rechaza un PNG cortado o sin IHDR al principio por formato", () => {
    expect(validarEscudo({ tamano: 1000, cabecera: png(48, 48).subarray(0, 20) })).toEqual({ ok: false, motivo: "formato" });
    expect(validarEscudo({ tamano: 1000, cabecera: png(48, 48, "IDAT") })).toEqual({ ok: false, motivo: "formato" });
  });

  it("rechaza archivos vacíos o más grandes que el máximo", () => {
    expect(validarEscudo({ tamano: 0, cabecera: png(48, 48) })).toEqual({ ok: false, motivo: "vacia" });
    expect(validarEscudo({ tamano: TAMANO_MAXIMO_ESCUDO + 1, cabecera: png(48, 48) })).toEqual({ ok: false, motivo: "tamano" });
    expect(validarEscudo({ tamano: TAMANO_MAXIMO_ESCUDO, cabecera: png(48, 48) }).ok).toBe(true);
  });
});

describe("nombreCorto", () => {
  it("sin largo máximo, el apellido: todo menos el primer nombre", () => {
    expect(nombreCorto("Leonardo Fernández")).toBe("Fernández");
    expect(nombreCorto("Nicolás de la Cruz")).toBe("de la Cruz");
    expect(nombreCorto("  Juan   Pablo  Pérez ")).toBe("Pablo Pérez");
  });

  it("un nombre de una sola palabra queda igual", () => {
    expect(nombreCorto(" Cebolla ")).toBe("Cebolla");
  });

  it("con largo máximo, el nombre completo si entra", () => {
    expect(nombreCorto("  Juan   Pérez ", 14)).toBe("Juan Pérez");
  });

  it("con largo máximo, el apellido si el completo no entra, y cortado si tampoco", () => {
    expect(nombreCorto("Leonardo Fernández", 14)).toBe("Fernández");
    expect(nombreCorto("Juan Pablo Pérez Gómez", 14)).toBe("Pablo Pérez G…");
    expect(nombreCorto("Maximiliano Olivera Hernández", 14)).toBe("Olivera Herná…");
  });
});

describe("el número según el Plantel", () => {
  const sinNumero = { ...valido, nombre: "Federico Valverde", numero: "", posicionNatural: "MED" };

  it("en el Plantel de la Selección el Jugador no lleva número", () => {
    const r = validarJugador({ ...sinNumero, plantel: "seleccion" });
    expect(r).toEqual({
      ok: true,
      jugador: {
        nombre: "Federico Valverde",
        numero: null,
        posicionNatural: "MED",
        disponibilidad: "disponible",
        motivoDisponibilidad: null,
      },
    });
  });

  it("en el Plantel de la Selección rechaza un número", () => {
    const r = validarDatosJugador({ nombre: "Federico Valverde", numero: "15", posicionNatural: "MED", plantel: "seleccion" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(["numero"]);
  });

  it("en el Plantel de un Club el número sigue siendo obligatorio", () => {
    const r = validarJugador({ ...sinNumero, plantel: "penarol" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(["numero"]);
  });
});

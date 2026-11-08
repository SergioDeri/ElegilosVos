import { describe, expect, it } from "vitest";
import { esquemas, type EsquemaId } from "@/domain/esquemas";
import { PALETA, anchoTexto, pxPara } from "@/domain/pixel";
import { ALTO_CAJA, LADO_CAMISETA_EN_CANCHA, canchaDeFondo, disponer, rotulo, siluetaDePuestoLibre, type Disposicion, type Rect } from "./index";

// Apellidos largos reales del seed.
const LARGOS = [
  "Federico Arismendi",
  "Germán Bentancor",
  "Maximiliano Morales",
  "Sebastián De León",
  "Joaquín Martínez",
  "Diego Fernández",
  "Nicolás Ferreira",
  "Santiago Techera",
  "Leandro Olivera",
  "Facundo Quintana",
  "Kevin Da Silva",
];

const PANTALLAS: [number, number][] = [
  [390, 844],
  [360, 740],
  [844, 390],
  [1470, 739],
  [1920, 1080],
];

const SUPLENTES = [0, 11, 22];

function disposicion(ancho: number, alto: number, esquema: EsquemaId, suplentes: number): Disposicion {
  return disponer({ ancho, alto, px: pxPara(ancho, alto), esquema, suplentes });
}

function seSuperponen(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;
}

function adentro(r: Rect, contenedor: { ancho: number; alto: number }): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.ancho <= contenedor.ancho && r.y + r.alto <= contenedor.alto;
}

const casos = PANTALLAS.flatMap(([w, h]) =>
  esquemas().flatMap((e) => SUPLENTES.map((n) => [w, h, e.id, n] as const)),
);

describe("disponer", () => {
  it.each(PANTALLAS)("%ix%i: orientación según la forma del espacio", (w, h) => {
    const d = disposicion(w, h, "4-3-3", 11);
    expect(d.orientacion).toBe(h > w ? "vertical" : "horizontal");
  });

  it.each(PANTALLAS)("%ix%i: el área mide floor(espacio / --px) y cancha y banco entran sin pisarse", (w, h) => {
    for (const n of SUPLENTES) {
      const d = disposicion(w, h, "4-4-2", n);
      const px = pxPara(w, h);
      expect(d.ancho).toBe(Math.floor(w / px));
      expect(d.alto).toBe(Math.floor(h / px));
      expect(adentro(d.cancha, d)).toBe(true);
      if (d.banco) {
        expect(adentro(d.banco, d)).toBe(true);
        expect(seSuperponen(d.cancha, d.banco)).toBe(false);
      } else expect(n).toBe(0);
      for (const v of [d.cancha.x, d.cancha.y, d.cancha.ancho, d.cancha.alto]) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("en vertical el banco va debajo; en horizontal, a la derecha", () => {
    const v = disposicion(390, 844, "4-3-3", 11);
    expect(v.banco!.y).toBeGreaterThanOrEqual(v.cancha.y + v.cancha.alto);
    const h = disposicion(1470, 739, "4-3-3", 11);
    expect(h.banco!.x).toBeGreaterThanOrEqual(h.cancha.x + h.cancha.ancho);
  });

  it.each(casos)("%ix%i %s con %i suplentes: ninguna caja se pisa y todas caen en la cancha", (w, h, esquema, n) => {
    const d = disposicion(w, h, esquema, n);
    expect(d.puestos).toHaveLength(11);
    for (const p of d.puestos) {
      for (const v of [p.x, p.y, p.ancho, p.alto]) expect(Number.isInteger(v)).toBe(true);
      expect(p.alto).toBe(ALTO_CAJA);
      expect(p.ancho).toBeGreaterThanOrEqual(LADO_CAMISETA_EN_CANCHA);
      expect(p.ancho % 2).toBe(0);
      expect(adentro(p, d.cancha), `${p.id} ${JSON.stringify(p)}`).toBe(true);
    }
    for (let i = 0; i < d.puestos.length; i++)
      for (let j = i + 1; j < d.puestos.length; j++)
        expect(seSuperponen(d.puestos[i], d.puestos[j]), `${d.puestos[i].id} y ${d.puestos[j].id}`).toBe(false);
  });

  it.each(casos)("%ix%i %s con %i suplentes: los apellidos largos entran en su caja", (w, h, esquema, n) => {
    const d = disposicion(w, h, esquema, n);
    d.puestos.forEach((p, i) => {
      const m = rotulo(LARGOS[i], p.ancho);
      expect(m[0]).toHaveLength(p.ancho);
    });
  });

  it.each(esquemas().map((e) => e.id))("%s en horizontal: el arquero queda junto al borde izquierdo", (esquema) => {
    for (const [w, h] of PANTALLAS.filter(([w, h]) => w > h)) {
      const d = disposicion(w, h, esquema, 11);
      const arquero = d.puestos.find((p) => p.id === "ARQ")!;
      expect(arquero.x).toBeLessThan(d.cancha.ancho * 0.1);
      for (const p of d.puestos) if (p.id !== "ARQ") expect(p.x).toBeGreaterThan(arquero.x);
    }
  });

  it("en horizontal el lado izquierdo del equipo va arriba", () => {
    const d = disposicion(1470, 739, "4-4-2", 11);
    const li = d.puestos.find((p) => p.id === "LI")!;
    const ld = d.puestos.find((p) => p.id === "LD")!;
    expect(li.y).toBeLessThan(ld.y);
  });

  it("en vertical el arquero queda abajo y el lateral izquierdo a la izquierda", () => {
    const d = disposicion(390, 844, "4-4-2", 11);
    const arquero = d.puestos.find((p) => p.id === "ARQ")!;
    for (const p of d.puestos) if (p.id !== "ARQ") expect(p.y).toBeLessThan(arquero.y);
    const li = d.puestos.find((p) => p.id === "LI")!;
    const ld = d.puestos.find((p) => p.id === "LD")!;
    expect(li.x).toBeLessThan(ld.x);
  });

  it.each(PANTALLAS.flatMap(([w, h]) => [1, 5, 11, 22, 30].map((n) => [w, h, n] as const)))(
    "%ix%i: el banco alcanza para %i suplentes sin pasarse del espacio",
    (w, h, n) => {
      const d = disposicion(w, h, "4-3-3", n);
      const b = d.banco!;
      expect(b.columnas * b.filas).toBeGreaterThanOrEqual(n);
      expect(b.columnas * b.filas - n).toBeLessThan(d.orientacion === "vertical" ? b.columnas : b.filas);
      const anchoGrilla = b.columnas * b.anchoItem + (b.columnas - 1) * b.separacion;
      const altoGrilla = b.filas * b.altoItem + (b.filas - 1) * b.separacion;
      expect(anchoGrilla).toBeLessThanOrEqual(b.ancho);
      expect(b.grilla.y + altoGrilla).toBeLessThanOrEqual(b.alto);
      expect(b.anchoItem % 2).toBe(0);
    },
  );

  it("el dibujo mide lo que la cancha, solo usa la paleta y es determinista", () => {
    for (const [w, h] of PANTALLAS) {
      const d = disposicion(w, h, "4-3-3", 11);
      expect(d.dibujo).toHaveLength(d.cancha.alto);
      for (const fila of d.dibujo) expect(fila).toHaveLength(d.cancha.ancho);
      const colores = new Set<string>(Object.values(PALETA));
      for (const fila of d.dibujo) for (const c of fila) expect(c === null || colores.has(c)).toBe(true);
      expect(disposicion(w, h, "4-3-3", 11).dibujo).toEqual(d.dibujo);
    }
  });

  it("el dibujo tiene franjas de césped, líneas de cal y matas", () => {
    const d = disposicion(390, 844, "4-3-3", 11);
    const colores = new Set(d.dibujo.flat());
    for (const c of [PALETA.cesped, PALETA.cespedLuz, PALETA.cespedSombra, PALETA.cal]) expect(colores.has(c)).toBe(true);
  });
});

describe("rotulo", () => {
  it("mide exactamente el ancho pedido y centra el apellido con contorno", () => {
    const m = rotulo("Santiago Díaz", 30);
    expect(m).toHaveLength(8);
    for (const fila of m) expect(fila).toHaveLength(30);
    // DÍAZ: 4 letras de 3 + 3 espacios = 15, + 2 de contorno = 17; sobran 13.
    const columnas = m[0].map((_, x) => m.some((f) => f[x] !== null));
    expect(columnas.indexOf(true)).toBe(6);
    expect(columnas.lastIndexOf(true)).toBe(6 + 17 - 1);
  });

  it("si no entra, acorta el apellido con un punto", () => {
    const ancho = 26;
    const m = rotulo("Federico Arismendi", ancho);
    expect(m[0]).toHaveLength(ancho);
    expect(anchoTexto("ARISMENDI") + 2).toBeGreaterThan(ancho);
  });

  it("nunca se pasa del ancho, aunque sea mínimo", () => {
    for (const ancho of [24, 26, 32, 48])
      for (const nombre of LARGOS) for (const fila of rotulo(nombre, ancho)) expect(fila).toHaveLength(ancho);
  });
});

describe("siluetaDePuestoLibre", () => {
  it("es del tamaño de una Camiseta y usa la paleta", () => {
    const m = siluetaDePuestoLibre();
    expect(m).toHaveLength(24);
    const colores = new Set<string>(Object.values(PALETA));
    for (const fila of m) {
      expect(fila).toHaveLength(24);
      for (const c of fila) expect(c === null || colores.has(c)).toBe(true);
    }
  });
});

describe("canchaDeFondo", () => {
  const colores = new Set<string>(Object.values(PALETA));
  const tamano = (m: ReturnType<typeof canchaDeFondo>) => ({ alto: m.length, ancho: m[0]?.length ?? 0 });

  it("mide exactamente lo pedido, en vertical y en horizontal", () => {
    for (const [ancho, alto] of [
      [180, 400],
      [480, 300],
      [97, 61],
    ]) {
      const m = canchaDeFondo(ancho, alto);
      expect(tamano(m)).toEqual({ ancho, alto });
      for (const fila of m) expect(fila).toHaveLength(ancho);
    }
  });

  it("es el mismo césped que la cancha del armado", () => {
    const d = disponer({ ancho: 360, alto: 640, px: 2, esquema: "4-4-2", suplentes: 0 });
    expect(canchaDeFondo(d.cancha.ancho, d.cancha.alto)).toEqual(d.dibujo);
  });

  it("es opaca, usa la paleta y tiene líneas de cal", () => {
    const m = canchaDeFondo(200, 120);
    let cal = 0;
    for (const fila of m)
      for (const c of fila) {
        expect(c !== null && colores.has(c)).toBe(true);
        if (c === PALETA.cal) cal++;
      }
    expect(cal).toBeGreaterThan(0);
  });

  it("redondea hacia abajo y no falla con tamaños chicos", () => {
    expect(tamano(canchaDeFondo(10.9, 5.2))).toEqual({ ancho: 10, alto: 5 });
    expect(canchaDeFondo(0, 0)).toEqual([]);
  });
});

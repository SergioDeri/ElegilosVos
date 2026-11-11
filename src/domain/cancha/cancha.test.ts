import { describe, expect, it } from "vitest";
import { esquemas, type EsquemaId } from "@/domain/esquemas";
import { PALETA, anchoTexto, pxPara } from "@/domain/pixel";
import {
  ALTO_BUSCADOR_BANCO,
  COLUMNAS_BANCO,
  ALTO_CAJA,
  ALTO_CAJA_DOS_RENGLONES,
  ALTO_ROTULO_DOS_LINEAS,
  LADO_CAMISETA_EN_CANCHA,
  canchaDeFondo,
  disponer,
  rotulo,
  lineasDelRotulo,
  rotuloCompleto,
  rotuloDeClub,
  siluetaDePuestoLibre,
  type Disposicion,
  type Rect,
} from "./index";

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
      // Sin líneas vacías: sobra menos de una fila (o columna) de la grilla.
      expect(b.columnas * b.filas - n).toBeLessThan(b.flujo === "row" ? b.columnas : b.filas);
      expect(adentro(b.ventana, b)).toBe(true);
      expect(b.anchoItem % 2).toBe(0);
    },
  );

  it.each(PANTALLAS.flatMap(([w, h]) => [1, 5, 11, 22, 30].map((n) => [w, h, n] as const)))(
    "%ix%i, %i suplentes: hasta 3 filas debajo de la cancha o 3 columnas a su derecha",
    (w, h, n) => {
      const d = disposicion(w, h, "4-3-3", n);
      const b = d.banco!;
      if (d.orientacion === "vertical") expect(b.filas).toBeLessThanOrEqual(3);
      else expect(b.columnas).toBeLessThanOrEqual(3);
    },
  );

  it.each(PANTALLAS.flatMap(([w, h]) => [1, 5, 11, 22, 30].map((n) => [w, h, n] as const)))(
    "%ix%i, %i suplentes: scroll solo si la grilla no entra, con la ventana en suplentes enteros",
    (w, h, n) => {
      const d = disposicion(w, h, "4-3-3", n);
      const b = d.banco!;
      const anchoGrilla = b.columnas * b.anchoItem + (b.columnas - 1) * b.separacion;
      const altoGrilla = b.filas * b.altoItem + (b.filas - 1) * b.separacion;
      if (!b.desplazamiento) {
        expect(b.flechas).toBeNull();
        expect(b.ventana.ancho).toBe(anchoGrilla);
        expect(b.ventana.alto).toBe(altoGrilla);
        return;
      }
      expect(b.desplazamiento).toBe(d.orientacion === "vertical" ? "horizontal" : "vertical");
      const [visible, total, item] =
        b.desplazamiento === "horizontal" ? [b.ventana.ancho, anchoGrilla, b.anchoItem] : [b.ventana.alto, altoGrilla, b.altoItem];
      expect(visible).toBeLessThan(total);
      // El imán deja siempre el primer suplente visible entero, también al final.
      expect((visible + b.separacion) % (item + b.separacion)).toBe(0);
      expect((total - visible) % (item + b.separacion)).toBe(0);
      const { antes, despues } = b.flechas!;
      for (const f of [antes, despues]) {
        expect(adentro(f, b)).toBe(true);
        expect(seSuperponen(f, b.ventana)).toBe(false);
      }
    },
  );

  it("con muchos suplentes, debajo de la cancha se scrollea de costado y a la derecha hacia abajo", () => {
    const v = disposicion(390, 844, "4-3-3", 30);
    expect(v.banco).toMatchObject({ filas: 3, desplazamiento: "horizontal", flujo: "column" });
    expect(v.banco!.flechas!.antes.x).toBeLessThan(v.banco!.ventana.x);
    expect(v.banco!.flechas!.despues.x).toBeGreaterThanOrEqual(v.banco!.ventana.x + v.banco!.ventana.ancho);
    const h = disposicion(1470, 739, "4-3-3", 30);
    expect(h.banco).toMatchObject({ columnas: 3, desplazamiento: "vertical", flujo: "row" });
    expect(h.banco!.flechas!.antes.y).toBeLessThan(h.banco!.ventana.y);
    expect(h.banco!.flechas!.despues.y).toBeGreaterThanOrEqual(h.banco!.ventana.y + h.banco!.ventana.alto);
  });

  it("con pocos suplentes no hay scroll ni flechas", () => {
    for (const [w, h] of PANTALLAS) {
      const b = disposicion(w, h, "4-3-3", 1).banco!;
      expect(b.desplazamiento).toBeNull();
      expect(b.flechas).toBeNull();
    }
  });

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

describe("rotuloCompleto (Selección: nombre completo si entra, nunca fuera de la caja)", () => {
  /** Columnas pintadas (primera y última) de las filas dadas. */
  function tramo(m: ReturnType<typeof rotuloCompleto>, desde: number, hasta: number): [number, number] {
    const filas = m.slice(desde, hasta);
    const columnas = m[0].map((_, x) => filas.some((f) => f[x] !== null));
    return [columnas.indexOf(true), columnas.lastIndexOf(true)];
  }

  it("si entra en una línea, va en una, centrado en el ancho pedido", () => {
    const m = rotuloCompleto("Matías Viña", 48);
    expect(m).toHaveLength(8);
    for (const fila of m) expect(fila).toHaveLength(48);
    const [desde, hasta] = tramo(m, 0, 8);
    expect(hasta - desde + 1).toBe(anchoTexto("MATÍAS VIÑA") + 2);
  });

  it("si no entra, va en dos líneas cortando entre palabras", () => {
    const m = rotuloCompleto("Giorgian De Arrascaeta", 48);
    expect(m).toHaveLength(ALTO_ROTULO_DOS_LINEAS);
    for (const fila of m) expect(fila).toHaveLength(48);
    const [d1, h1] = tramo(m, 0, 7);
    const [d2, h2] = tramo(m, 8, ALTO_ROTULO_DOS_LINEAS);
    expect(h1 - d1 + 1).toBe(anchoTexto("GIORGIAN DE") + 2);
    expect(h2 - d2 + 1).toBe(anchoTexto("ARRASCAETA") + 2);
  });

  it("nunca sale de su caja, así no pisa al de al lado", () => {
    const nombres = ["Giorgian De Arrascaeta", "Juan Manuel Sanabria", "Agustín Álvarez Martínez", "Santiago Homenchenko", "Ignacio De Arruabarrena"];
    for (const nombre of nombres) {
      for (let ancho = 24; ancho <= 48; ancho += 2) {
        const m = rotuloCompleto(nombre, ancho);
        for (const fila of m) expect(fila).toHaveLength(ancho);
        expect(m.flat().some((c) => c !== null)).toBe(true);
      }
    }
  });
});

describe("lineasDelRotulo (qué se escribe cuando el nombre completo no entra)", () => {
  it("el nombre completo, si entra en una o dos líneas", () => {
    expect(lineasDelRotulo("Matías Viña", 48)).toEqual(["MATÍAS VIÑA"]);
    expect(lineasDelRotulo("José María Giménez", 48)).toEqual(["JOSÉ MARÍA", "GIMÉNEZ"]);
  });

  it("si no, el apellido con sus partículas", () => {
    expect(lineasDelRotulo("José María Giménez", 34)).toEqual(["GIMÉNEZ"]);
    expect(lineasDelRotulo("Nicolás De La Cruz", 26)).toEqual(["DE LA", "CRUZ"]);
    expect(lineasDelRotulo("Juan Cruz De los Santos", 26)).toEqual(["DE LOS", "SANTOS"]);
  });

  it("si el apellido no entra entero, lo parte con guion entre sílabas", () => {
    expect(lineasDelRotulo("Juan Rodríguez", 26)).toEqual(["RODRÍ-", "GUEZ"]);
    expect(lineasDelRotulo("Santiago Homenchenko", 34)).toEqual(["HOMEN-", "CHENKO"]);
    // Antes que partir mal "DE ARRASCAETA", deja la partícula.
    expect(lineasDelRotulo("Giorgian De Arrascaeta", 26)).toEqual(["ARRAS-", "CAETA"]);
  });

  it("si ni partido entra, lo acorta con un punto", () => {
    expect(lineasDelRotulo("Ignacio De Arruabarrena", 24)).toEqual(["ARRU-", "ABAR."]);
  });

  it("en un Club, el apellido sin el nombre de pila, entero o partido entre sílabas", () => {
    const club = { conNombre: false };
    expect(lineasDelRotulo("Sebastián De León", 48, club)).toEqual(["DE LEÓN"]);
    expect(lineasDelRotulo("Agustín Laborda", 34, club)).toEqual(["LABORDA"]);
    expect(lineasDelRotulo("Agustín Laborda", 26, club)).toEqual(["LA-", "BORDA"]);
    expect(lineasDelRotulo("Federico Arismendi", 26, club)).toEqual(["ARIS-", "MENDI"]);
  });

  it("cada línea entra en el ancho pedido", () => {
    for (const nombre of ["Giorgian De Arrascaeta", "Agustín Álvarez Martínez", "Facundo Pellistri"])
      for (let ancho = 24; ancho <= 48; ancho += 2)
        for (const linea of lineasDelRotulo(nombre, ancho)) expect(anchoTexto(linea) + 2).toBeLessThanOrEqual(ancho);
  });
});

describe("disponer con el nombre completo en dos líneas (Selección)", () => {
  it.each(casos)("%ix%i %s con %i suplentes: cajas más altas que no se pisan", (w, h, esquema, n) => {
    const d = disponer({ ancho: w, alto: h, px: pxPara(w, h), esquema, suplentes: n, renglones: 2 });
    for (const p of d.puestos) {
      expect(p.alto).toBe(ALTO_CAJA_DOS_RENGLONES);
      expect(adentro(p, d.cancha), `${p.id} ${JSON.stringify(p)}`).toBe(true);
    }
    for (let i = 0; i < d.puestos.length; i++)
      for (let j = i + 1; j < d.puestos.length; j++)
        expect(seSuperponen(d.puestos[i], d.puestos[j]), `${d.puestos[i].id} y ${d.puestos[j].id}`).toBe(false);
    if (d.banco) expect(d.banco.altoItem).toBe(ALTO_CAJA_DOS_RENGLONES);
  });

  it("la caja de dos renglones es la de uno más una línea de texto", () => {
    expect(ALTO_CAJA_DOS_RENGLONES).toBe(ALTO_CAJA + ALTO_ROTULO_DOS_LINEAS - 8);
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

describe("disponer con buscador en el banco (Selección)", () => {
  const pantallas = [
    [390, 700],
    [1280, 640],
  ] as const;

  it.each(pantallas)("en %ix%i reserva el buscador entre el título y la grilla, de todo el ancho del banco", (w, h) => {
    const d = disponer({ ancho: w, alto: h, px: pxPara(w, h), esquema: "4-3-3", suplentes: 90, renglones: 2, buscador: true });
    const b = d.banco!;
    expect(b.buscador).toEqual({ x: 0, y: expect.any(Number), ancho: b.ancho, alto: ALTO_BUSCADOR_BANCO });
    expect(b.buscador!.y).toBeGreaterThan(0);
    const arribaDeLaGrilla = Math.min(b.ventana.y, ...(b.flechas ? [b.flechas.antes.y] : []));
    expect(b.buscador!.y + b.buscador!.alto).toBeLessThan(arribaDeLaGrilla);
  });

  it("sin pedirlo no hay buscador", () => {
    const d = disponer({ ancho: 1280, alto: 640, px: 2, esquema: "4-3-3", suplentes: 20 });
    expect(d.banco!.buscador).toBeNull();
  });

  it("en desktop el buscador ocupa las 3 columnas del banco", () => {
    const d = disponer({ ancho: 1280, alto: 640, px: 2, esquema: "4-3-3", suplentes: 90, renglones: 2, buscador: true });
    const b = d.banco!;
    expect(d.orientacion).toBe("horizontal");
    expect(b.columnas).toBe(COLUMNAS_BANCO);
    expect(b.buscador!.ancho).toBeGreaterThanOrEqual(b.ventana.ancho);
  });
});

describe("las líneas quedan alineadas (nombre completo en dos renglones, cancha horizontal)", () => {
  // Antes, si dos zagueros no entraban uno al lado del otro, el segundo se
  // corría hacia adelante y desarmaba la línea; ahora primero se abre el equipo.
  const pantallas: [number, number][] = [];
  for (let w = 700; w <= 1800; w += 60) for (let h = 400; h <= Math.min(w, 1000); h += 50) pantallas.push([w, h]);
  const centro = (p: { x: number; ancho: number }) => p.x + p.ancho / 2;

  it.each(esquemas().map((e) => e.id))("%s: los Puestos espejados quedan a la misma altura de la cancha", (esquema) => {
    for (const [w, h] of pantallas) {
      const d = disponer({ ancho: w, alto: h, px: pxPara(w, h), esquema, suplentes: 100, renglones: 2, buscador: true });
      const por = new Map(d.puestos.map((p) => [p.id, p]));
      for (const [i, dd] of [["ZAG_I", "ZAG_D"], ["LI", "LD"], ["CAR_I", "CAR_D"]] as const) {
        const a = por.get(i);
        const b = por.get(dd);
        if (a && b) expect(centro(a), `${esquema} ${w}x${h} ${i}/${dd}`).toBe(centro(b));
      }
    }
  });
});

describe("rotuloDeClub", () => {
  it("nunca sale de su caja", () => {
    for (const nombre of LARGOS)
      for (let ancho = 24; ancho <= 48; ancho += 2) for (const fila of rotuloDeClub(nombre, ancho)) expect(fila).toHaveLength(ancho);
  });
});

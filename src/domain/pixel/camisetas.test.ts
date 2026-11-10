import { describe, expect, it } from "vitest";
import { CLUBES, POSICIONES_NATURALES, SELECCION, type ClubId, type PosicionNatural } from "@/domain/comun/tipos";
import { LADO_CAMISETA, PALETA, camiseta, type ColorPaleta, type Matriz } from "./index";

const nombreDe = new Map<string, ColorPaleta>(Object.entries(PALETA).map(([n, hex]) => [hex, n as ColorPaleta]));

/** Familia de un color de la paleta: "amarilloLuz" → "amarillo". */
function familia(hex: string | null): string | null {
  if (hex === null) return null;
  const nombre = nombreDe.get(hex);
  return nombre ? nombre.replace(/(Luz|Sombra)$/, "") : `?${hex}`;
}

function celdas(m: Matriz): [number, number, string | null][] {
  return m.flatMap((fila, y) => fila.map((c, x) => [x, y, c] as [number, number, string | null]));
}

const casos: [ClubId, PosicionNatural][] = CLUBES.flatMap((c) => POSICIONES_NATURALES.map((p) => [c, p] as [ClubId, PosicionNatural]));

describe("camiseta", () => {
  it.each(casos)("%s %s mide 24x24 y usa solo colores de la paleta", (club, pos) => {
    for (const m of [camiseta(club, pos), camiseta(club, pos, { numero: 88 })]) {
      expect(LADO_CAMISETA).toBe(24);
      expect(m).toHaveLength(24);
      for (const fila of m) expect(fila).toHaveLength(24);
      for (const [, , c] of celdas(m)) if (c !== null) expect(nombreDe.has(c)).toBe(true);
    }
  });

  it.each(casos)("%s %s es simétrica en forma y contorno", (club, pos) => {
    const m = camiseta(club, pos);
    for (const [x, y, c] of celdas(m)) {
      const espejo = m[y][23 - x];
      expect(espejo === null, `(${x},${y})`).toBe(c === null);
      expect(espejo === PALETA.contorno, `(${x},${y})`).toBe(c === PALETA.contorno);
    }
  });

  it.each([
    ["penarol", "ARQ"],
    ["nacional", "DEF"],
    ["nacional", "ARQ"],
  ] as const)("%s %s (sin bastones) es simétrica en color, salvo el tono", (club, pos) => {
    const m = camiseta(club, pos);
    for (const [x, y, c] of celdas(m)) expect(familia(m[y][23 - x]), `(${x},${y})`).toBe(familia(c));
  });

  it("la de arquero la lleva solo el ARQ", () => {
    for (const club of CLUBES) {
      const arquero = camiseta(club, "ARQ");
      for (const pos of ["DEF", "MED", "DEL"] as const) {
        expect(camiseta(club, pos)).toEqual(camiseta(club, "DEF"));
        expect(camiseta(club, pos)).not.toEqual(arquero);
      }
    }
  });

  // Fila 18: torso puro (sin mangas ni número); columnas 6 a 17.
  const torso = (m: Matriz) => m[18].slice(6, 18).map(familia);

  it("Peñarol de campo: bastones amarillos y negros cada 3 columnas, desde amarillo en la 6", () => {
    expect(torso(camiseta("penarol", "MED"))).toEqual(
      ["amarillo", "amarillo", "amarillo", "negro", "negro", "negro", "amarillo", "amarillo", "amarillo", "negro", "negro", "negro"],
    );
  });

  it("Peñarol de campo: mangas amarillas, puños y cuello negros", () => {
    const m = camiseta("penarol", "DEL");
    expect(familia(m[6][2])).toBe("amarillo"); // manga
    expect(familia(m[8][2])).toBe("negro"); // puño
    expect(familia(m[3][11])).toBe("negro"); // cuello
  });

  it("Peñarol arquero: toda negra", () => {
    const m = camiseta("penarol", "ARQ");
    expect(new Set(torso(m))).toEqual(new Set(["negro"]));
    expect(familia(m[6][2])).toBe("negro");
  });

  it("Nacional de campo: blanca con cuello y puños azules", () => {
    const m = camiseta("nacional", "DEF");
    expect(new Set(torso(m))).toEqual(new Set(["blanco"]));
    expect(familia(m[6][2])).toBe("blanco");
    expect(familia(m[8][2])).toBe("azul");
    expect(familia(m[3][11])).toBe("azul");
  });

  it("Nacional arquero: toda azul", () => {
    const m = camiseta("nacional", "ARQ");
    const colores = new Set(celdas(m).map(([, , c]) => familia(c)));
    expect(colores).toEqual(new Set([null, "contorno", "azul"]));
  });

  it("tiene luz arriba a la izquierda y sombra a la derecha y en la última fila", () => {
    const m = camiseta("nacional", "MED");
    expect(m[8][7]).toBe(PALETA.blancoLuz);
    expect(m[18][7]).toBe(PALETA.blanco);
    expect(m[18][16]).toBe(PALETA.blancoSombra);
    expect(m[21][10]).toBe(PALETA.blancoSombra);
  });

  it.each([
    ["penarol", "MED", "blanco"],
    ["penarol", "ARQ", "amarillo"],
    ["nacional", "MED", "rojo"],
    ["nacional", "ARQ", "blanco"],
  ] as const)("el número de %s %s es %s", (club, pos, color) => {
    const m = camiseta(club, pos, { numero: 8 });
    const sinNumero = camiseta(club, pos);
    const numero = celdas(m).filter(([x, y, c]) => c !== sinNumero[y][x] && c !== PALETA.contorno);
    expect(numero.length).toBeGreaterThan(0);
    expect(new Set(numero.map(([, , c]) => familia(c)))).toEqual(new Set([color]));
  });

  it.each(casos.flatMap(([club, pos]) => [1, 7, 10, 88, 99].map((n) => [club, pos, n] as const)))(
    "%s %s: el %i queda en las filas 9 a 13, dentro del torso y rodeado de contorno",
    (club, pos, numero) => {
      const sinNumero = camiseta(club, pos);
      const m = camiseta(club, pos, { numero });
      const cambiadas = celdas(m).filter(([x, y, c]) => c !== sinNumero[y][x]);
      const digitos = cambiadas.filter(([, , c]) => c !== PALETA.contorno);

      // Todo lo estampado cae sobre tela (ni afuera ni sobre el contorno).
      for (const [x, y] of cambiadas) {
        expect(sinNumero[y][x], `(${x},${y})`).not.toBeNull();
        expect(sinNumero[y][x], `(${x},${y})`).not.toBe(PALETA.contorno);
      }
      // Dígitos de 3x5 en las filas 9 a 13, centrados.
      const ys = digitos.map(([, y]) => y);
      expect(Math.min(...ys)).toBe(9);
      expect(Math.max(...ys)).toBe(13);
      const xs = digitos.map(([x]) => x);
      const ancho = String(numero).length * 4 - 1;
      expect(Math.max(...xs) - Math.min(...xs) + 1).toBeLessThanOrEqual(ancho);
      expect(Math.abs(Math.min(...xs) + Math.max(...xs) + 1 - 24)).toBeLessThanOrEqual(1);
      // Cada píxel del número tiene en sus 8 vecinos solo número o contorno.
      const color = digitos[0][2];
      for (const [x, y] of digitos)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) expect([color, PALETA.contorno]).toContain(m[y + dy][x + dx]);
    },
  );

  it("las 4 Camisetas (si cambian, revisarlas con el dueño del producto)", () => {
    const letra = new Map<ColorPaleta, string>([
      ["contorno", "o"],
      ["negroSombra", "1"], ["negro", "2"], ["negroLuz", "3"],
      ["amarilloSombra", "4"], ["amarillo", "5"], ["amarilloLuz", "6"],
      ["blancoSombra", "7"], ["blanco", "8"], ["blancoLuz", "9"],
      ["azulSombra", "a"], ["azul", "b"], ["azulLuz", "c"],
      ["rojoSombra", "d"], ["rojo", "e"], ["rojoLuz", "f"],
    ]);
    const dibujo = (m: Matriz) => m.map((f) => f.map((c) => (c === null ? "." : (letra.get(nombreDe.get(c)!) ?? "?"))).join("")).join("\n");
    const todas = CLUBES.flatMap((club) =>
      (["DEF", "ARQ"] as const).map((pos) => `${club} ${pos === "ARQ" ? "arquero" : "campo"} (10)\n${dibujo(camiseta(club, pos, { numero: 10 }))}`),
    ).join("\n\n");
    expect(todas).toMatchSnapshot();
  });
});

describe("camiseta de la Selección", () => {
  const torso = (m: Matriz) => m[18].slice(6, 18).map(familia);

  it("de campo: celeste", () => {
    const m = camiseta(SELECCION, "DEF");
    expect(new Set(torso(m))).toEqual(new Set(["celeste"]));
    expect(familia(m[6][2])).toBe("celeste"); // manga
  });

  it("de arquero: negra, la lleva solo el ARQ", () => {
    const arquero = camiseta(SELECCION, "ARQ");
    expect(new Set(torso(arquero))).toEqual(new Set(["negro"]));
    expect(familia(arquero[6][2])).toBe("negro"); // manga
    for (const pos of ["DEF", "MED", "DEL"] as const) {
      expect(camiseta(SELECCION, pos)).toEqual(camiseta(SELECCION, "DEF"));
      expect(camiseta(SELECCION, pos)).not.toEqual(arquero);
    }
  });

  it("no se confunde con las de los Clubes", () => {
    for (const club of CLUBES)
      for (const pos of ["DEF", "ARQ"] as const) expect(camiseta(SELECCION, pos)).not.toEqual(camiseta(club, pos));
  });

  it.each(POSICIONES_NATURALES)("%s: no estampa número aunque se lo pidan", (pos) => {
    expect(camiseta(SELECCION, pos, { numero: 10 })).toEqual(camiseta(SELECCION, pos));
  });

  it.each(POSICIONES_NATURALES)("%s mide 24x24, usa solo la paleta y es simétrica en color, salvo el tono", (pos) => {
    const m = camiseta(SELECCION, pos);
    expect(m).toHaveLength(LADO_CAMISETA);
    for (const fila of m) expect(fila).toHaveLength(LADO_CAMISETA);
    for (const [x, y, c] of celdas(m)) {
      if (c !== null) expect(nombreDe.has(c)).toBe(true);
      expect(familia(m[y][23 - x]), `(${x},${y})`).toBe(familia(c));
    }
  });

  it("las 2 Camisetas de la Selección (si cambian, revisarlas con el dueño del producto)", () => {
    const letra = new Map<ColorPaleta, string>([
      ["contorno", "o"],
      ["negroSombra", "1"], ["negro", "2"], ["negroLuz", "3"],
      ["blancoSombra", "7"], ["blanco", "8"], ["blancoLuz", "9"],
      ["celesteSombra", "g"], ["celeste", "h"], ["celesteLuz", "i"],
    ]);
    const dibujo = (m: Matriz) => m.map((f) => f.map((c) => (c === null ? "." : (letra.get(nombreDe.get(c)!) ?? "?"))).join("")).join("\n");
    const todas = (["DEF", "ARQ"] as const)
      .map((pos) => `seleccion ${pos === "ARQ" ? "arquero" : "campo"}\n${dibujo(camiseta(SELECCION, pos))}`)
      .join("\n\n");
    expect(todas).not.toContain("?");
    expect(todas).toMatchSnapshot();
  });
});

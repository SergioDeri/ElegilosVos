import { describe, expect, it } from "vitest";
import { esPuestoDe, esPuestoDeArquero, esquema, esquemas, puestoEquivalente, type EsquemaId, type Puesto } from "./index";

const pares: [EsquemaId, EsquemaId][] = esquemas().flatMap((o) =>
  esquemas().map((d) => [o.id, d.id] as [EsquemaId, EsquemaId]),
);

/** Cada (origen, Puesto de origen, destino, Puesto equivalente) de la tabla. */
function asociaciones(): { origen: EsquemaId; destino: EsquemaId; p: Puesto; q: Puesto }[] {
  return pares.flatMap(([origen, destino]) =>
    esquema(origen).puestos.map((p) => {
      const q = esquema(destino).puestos.find((x) => x.id === puestoEquivalente(origen, p.id, destino))!;
      return { origen, destino, p, q };
    }),
  );
}

describe("Tabla de Equivalencias", () => {
  it("cubre todos los pares (origen, destino) y todos los Puestos de origen", () => {
    // Si se agrega un Esquema (o un Puesto nuevo) sin completar su fila y su
    // columna en la tabla, este test falla.
    expect(pares).toHaveLength(esquemas().length ** 2);
    for (const [origen, destino] of pares) {
      for (const p of esquema(origen).puestos) {
        const equivalente = puestoEquivalente(origen, p.id, destino);
        expect(esPuestoDe(destino, equivalente), `${origen} ${p.id} → ${destino} ${equivalente}`).toBe(true);
      }
    }
  });

  it("la equivalencia de un Esquema consigo mismo es la identidad", () => {
    for (const e of esquemas()) {
      for (const p of e.puestos) expect(puestoEquivalente(e.id, p.id, e.id)).toBe(p.id);
    }
  });

  it("el arquero siempre se asocia con el arquero, y nadie más va al arco", () => {
    for (const { p, q } of asociaciones()) {
      expect(esPuestoDeArquero(q.id), `${p.id} → ${q.id}`).toBe(esPuestoDeArquero(p.id));
    }
  });

  it("nunca cambia de lado (izquierda ↔ derecha)", () => {
    const lado = (x: number) => (x < 0.45 ? "izq" : x > 0.55 ? "der" : "centro");
    for (const { origen, destino, p, q } of asociaciones()) {
      if (lado(p.x) !== "centro" && lado(q.x) !== "centro") {
        expect(lado(q.x), `${origen} ${p.id} → ${destino} ${q.id}`).toBe(lado(p.x));
      }
    }
  });

  it("a lo sumo corre un Puesto una línea (nunca de la defensa al ataque)", () => {
    for (const { origen, destino, p, q } of asociaciones()) {
      expect(Math.abs(q.y - p.y), `${origen} ${p.id} → ${destino} ${q.id}`).toBeLessThanOrEqual(0.35);
    }
  });

  it("asocia por función: el volante por banda pasa a extremo, el enganche a segundo delantero", () => {
    expect(puestoEquivalente("4-4-2", "VOL_I", "4-3-3")).toBe("EXT_I");
    expect(puestoEquivalente("4-2-3-1", "ENG", "4-4-2")).toBe("DEL_I");
    expect(puestoEquivalente("4-4-2", "DEL_I", "4-2-3-1")).toBe("ENG");
    expect(puestoEquivalente("4-3-3", "LI", "3-5-2")).toBe("CAR_I");
  });

  it("aplica las excepciones escritas para un par puntual", () => {
    // Regla general hacia el 4-3-3: los dos delanteros van al centrodelantero.
    expect(puestoEquivalente("3-5-2", "DEL_I", "4-3-3")).toBe("DEL");
    // Excepción desde el 4-4-2: el segundo delantero baja a interior izquierdo.
    expect(puestoEquivalente("4-4-2", "DEL_I", "4-3-3")).toBe("INT_I");
  });

  it("rechaza un Puesto que no es del Esquema de origen", () => {
    expect(() => puestoEquivalente("4-3-3", "DEL_I", "4-4-2")).toThrow();
  });

  it("tabla completa (si cambia, revisarla con el dueño del producto)", () => {
    const lineas = pares
      .filter(([o, d]) => o !== d)
      .map(
        ([o, d]) =>
          `${o} → ${d}: ` + esquema(o).puestos.map((p) => `${p.id}→${puestoEquivalente(o, p.id, d)}`).join(" "),
      );
    expect(lineas.join("\n")).toMatchSnapshot();
  });
});

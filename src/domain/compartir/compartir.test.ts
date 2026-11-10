import { describe, expect, it } from "vitest";
import { esquema } from "@/domain/esquemas";
import {
  LARGO_MAXIMO_NOMBRE,
  LARGO_MAXIMO_RENGLON_SELECCION,
  LARGO_MAXIMO_RIVAL,
  modeloDeImagen,
  type EntradaImagen,
} from "./index";


const jugadores = esquema("4-3-3").puestos.map((p, i) => ({ id: `j${i}`, nombre: `Jugador ${i}`, numero: i + 1 }));

function entrada(cambios: Partial<EntradaImagen> = {}): EntradaImagen {
  return {
    tipo: "mi_alineacion",
    club: "penarol",
    rival: "Nacional",
    fecha: "10 nov 2026, 20:00",
    dia: "2026-11-10",
    esquema: "4-3-3",
    asignaciones: esquema("4-3-3").puestos.map((p, i) => ({ puesto: p.id, jugadorId: `j${i}` })),
    jugadores,
    ...cambios,
  };
}

describe("modeloDeImagen", () => {
  it("pone los 11 Puestos del Esquema con su Jugador, en el orden del Esquema", () => {
    const modelo = modeloDeImagen(entrada());
    expect(modelo.puestos.map((p) => p.puesto)).toEqual(esquema("4-3-3").puestos.map((p) => p.id));
    expect(modelo.puestos[0]).toMatchObject({ puesto: "ARQ", sigla: "ARQ", nombre: "Jugador 0", numero: 1 });
  });

  it("deja vacante el Puesto sin Jugador, con un Jugador desconocido o sin asignación", () => {
    const modelo = modeloDeImagen(
      entrada({
        asignaciones: [
          { puesto: "ARQ", jugadorId: null },
          { puesto: "LI", jugadorId: "no-existe" },
        ],
      }),
    );
    expect(modelo.puestos).toHaveLength(11);
    for (const p of modelo.puestos) expect(p).toMatchObject({ nombre: null, numero: null });
  });

  it("ignora asignaciones de Puestos que no son del Esquema", () => {
    const modelo = modeloDeImagen(entrada({ asignaciones: [{ puesto: "ZAG_C", jugadorId: "j0" }] }));
    expect(modelo.puestos.map((p) => p.puesto)).not.toContain("ZAG_C");
    expect(modelo.puestos.every((p) => p.nombre === null)).toBe(true);
  });

  it("ubica cada Puesto con las coordenadas del Esquema, con el arco propio abajo", () => {
    const modelo = modeloDeImagen(entrada());
    const arquero = modelo.puestos.find((p) => p.puesto === "ARQ")!;
    const delantero = modelo.puestos.find((p) => p.puesto === "DEL")!;
    expect(arquero.x).toBe(0.5);
    expect(arquero.yDesdeArriba).toBeCloseTo(0.95);
    expect(delantero.yDesdeArriba).toBeCloseTo(0.15);
  });
});

describe("modeloDeImagen: nombres largos", () => {
  const conNombre = (nombre: string) =>
    modeloDeImagen(entrada({ jugadores: [{ id: "j0", nombre, numero: 1 }] })).puestos[0]!.nombre;

  it("deja igual un nombre que entra, normalizando espacios", () => {
    expect(conNombre("  Juan   Pérez ")).toBe("Juan Pérez");
    expect(conNombre("A".repeat(LARGO_MAXIMO_NOMBRE))).toBe("A".repeat(LARGO_MAXIMO_NOMBRE));
  });

  it("si no entra, muestra solo el apellido (todo menos el primer nombre)", () => {
    expect(conNombre("Leonardo Fernández")).toBe("Fernández");
    expect(conNombre("Juan Pablo Pérez Gómez")).toBe("Pablo Pérez G…");
    expect(conNombre("Juan Pablo Pereyra")).toBe("Pablo Pereyra");
  });

  it("si ni el apellido entra, lo corta con puntos suspensivos", () => {
    const nombre = conNombre("Maximiliano Olivera Hernández")!;
    expect(nombre).toHaveLength(LARGO_MAXIMO_NOMBRE);
    expect(nombre.endsWith("…")).toBe(true);
    expect(nombre.startsWith("Olivera Hern")).toBe(true);
    expect(conNombre("Supercalifragilisticoespialidoso")).toHaveLength(LARGO_MAXIMO_NOMBRE);
  });

  it("corta un Rival muy largo", () => {
    const modelo = modeloDeImagen(entrada({ rival: "Club Atlético ".repeat(5).trim() }));
    expect(modelo.rival.length).toBeLessThanOrEqual(LARGO_MAXIMO_RIVAL);
    expect(modelo.rival.endsWith("…")).toBe(true);
    expect(modelo.partido).toBe(`Peñarol vs ${modelo.rival}`);
  });
});

describe("modeloDeImagen: textos", () => {
  it("titula según el tipo de imagen", () => {
    expect(modeloDeImagen(entrada({ tipo: "mi_alineacion" })).titulo).toBe("Mi 11");
    expect(modeloDeImagen(entrada({ tipo: "once_elegido" })).titulo).toBe("El 11 Elegido por la hinchada");
  });

  it("nombra el Club, el Rival, el Esquema y la fecha recibida", () => {
    const modelo = modeloDeImagen(entrada({ club: "nacional", rival: "Defensor Sporting", esquema: "4-4-2" }));
    expect(modelo.club).toBe("Nacional");
    expect(modelo.rival).toBe("Defensor Sporting");
    expect(modelo.partido).toBe("Nacional vs Defensor Sporting");
    expect(modelo.esquema).toBe("4-4-2");
    expect(modelo.fecha).toBe("10 nov 2026, 20:00");
  });

  it("da un nombre de archivo sin acentos ni espacios, con el día recibido", () => {
    expect(modeloDeImagen(entrada({ rival: "Montevideo Wanderers" })).nombreArchivo).toBe(
      "mi-11-penarol-vs-montevideo-wanderers-2026-11-10.png",
    );
    expect(modeloDeImagen(entrada({ tipo: "once_elegido", club: "nacional", rival: "Peñarol" })).nombreArchivo).toBe(
      "11-elegido-nacional-vs-penarol-2026-11-10.png",
    );
  });

  it("describe la imagen en un texto alternativo con el Club, el Rival y el Esquema", () => {
    expect(modeloDeImagen(entrada()).alt).toBe("Mi 11 de Peñarol vs Nacional en 4-3-3");
  });
});

describe("modeloDeImagen: la Selección", () => {
  const seleccion = (cambios: Partial<EntradaImagen> = {}) =>
    entrada({ club: "seleccion", rival: "Paraguay", jugadores: jugadores.map((j) => ({ ...j, numero: null })), ...cambios });
  const conNombre = (nombre: string) =>
    modeloDeImagen(seleccion({ jugadores: [{ id: "j0", nombre, numero: null }] })).puestos[0]!;

  it("muestra el nombre completo sin número, aunque no entre en una línea", () => {
    const puesto = conNombre("Giorgian De Arrascaeta");
    expect(puesto.nombre).toBe("Giorgian De Arrascaeta");
    expect(puesto.numero).toBeNull();
  });

  it("si el nombre no entra en una línea lo parte en dos entre palabras, sin cortarlo", () => {
    const { renglones } = conNombre("Giorgian De Arrascaeta");
    expect(renglones).toEqual(["Giorgian De", "Arrascaeta"]);
    expect(conNombre("  Luis   Suárez ").renglones).toEqual(["Luis Suárez"]);
    expect(conNombre("Federico Valverde").renglones).toEqual(["Federico", "Valverde"]);
  });

  it("entran en dos renglones nombres reales largos", () => {
    for (const nombre of ["Giorgian De Arrascaeta", "Rodrigo Bentancur Colmán", "Maximiliano Araújo", "Sebastián Cáceres"]) {
      const { renglones, nombre: completo } = conNombre(nombre);
      expect(completo).toBe(nombre);
      expect(renglones.join(" ")).toBe(nombre);
      expect(renglones.length).toBeLessThanOrEqual(2);
      for (const r of renglones) expect(r.length).toBeLessThanOrEqual(LARGO_MAXIMO_RENGLON_SELECCION);
    }
  });

  it("una palabra que no entra no se corta", () => {
    expect(conNombre("Supercalifragilisticoespialidoso").renglones).toEqual(["Supercalifragilisticoespialidoso"]);
  });

  it("un Puesto vacante no tiene renglones", () => {
    const modelo = modeloDeImagen(seleccion({ asignaciones: [] }));
    expect(modelo.puestos.every((p) => p.nombre === null && p.renglones.length === 0)).toBe(true);
  });

  it("nombra a la Selección en los textos y en el archivo", () => {
    const modelo = modeloDeImagen(seleccion({ tipo: "once_elegido" }));
    expect(modelo.club).toBe("Selección");
    expect(modelo.clubId).toBe("seleccion");
    expect(modelo.partido).toBe("Selección vs Paraguay");
    expect(modelo.nombreArchivo).toBe("11-elegido-seleccion-vs-paraguay-2026-11-10.png");
  });

  it("el 11 Elegido destaca al Gran Ausente final con su nombre completo y su porcentaje", () => {
    const modelo = modeloDeImagen(
      seleccion({
        tipo: "once_elegido",
        jugadores: [...jugadores.map((j) => ({ ...j, numero: null })), { id: "afuera", nombre: "Luis Suárez", numero: null }],
        destacado: { tipo: "gran_ausente", jugadores: [{ jugadorId: "afuera", apariciones: 2, porcentaje: 200 / 3 }] },
      }),
    );
    expect(modelo.destacado).toEqual({ titulo: "Gran Ausente final", jugadores: [{ nombre: "Luis Suárez", porcentaje: "66,7 %" }] });
  });

  it("mientras no hay Gran Ausente destaca al Más Pedido, con todos los empatados", () => {
    const modelo = modeloDeImagen(
      seleccion({
        tipo: "once_elegido",
        destacado: {
          tipo: "mas_pedido",
          jugadores: [
            { jugadorId: "j2", apariciones: 3, porcentaje: 100 },
            { jugadorId: "j1", apariciones: 3, porcentaje: 100 },
          ],
        },
      }),
    );
    expect(modelo.destacado).toEqual({
      titulo: "Más Pedido",
      jugadores: [
        { nombre: "Jugador 1", porcentaje: "100 %" },
        { nombre: "Jugador 2", porcentaje: "100 %" },
      ],
    });
  });

  it("sin destacado, o en la imagen de Mi 11, no destaca a nadie", () => {
    const destacado = { tipo: "mas_pedido" as const, jugadores: [{ jugadorId: "j1", apariciones: 1, porcentaje: 100 }] };
    expect(modeloDeImagen(seleccion({ tipo: "once_elegido", destacado: null })).destacado).toBeNull();
    expect(modeloDeImagen(seleccion({ tipo: "mi_alineacion", destacado })).destacado).toBeNull();
  });
});

describe("modeloDeImagen: los Clubes no cambian", () => {
  it("el rótulo es el nombre acortado en un renglón, con número y sin destacado", () => {
    const modelo = modeloDeImagen(
      entrada({
        tipo: "once_elegido",
        jugadores: [{ id: "j0", nombre: "Leonardo Fernández", numero: 10 }],
        destacado: { tipo: "mas_pedido", jugadores: [{ jugadorId: "j0", apariciones: 1, porcentaje: 100 }] },
      }),
    );
    expect(modelo.puestos[0]).toMatchObject({ nombre: "Fernández", renglones: ["Fernández"], numero: 10 });
    expect(modelo.destacado).toBeNull();
    expect(modelo.clubId).toBe("penarol");
  });
});

import { describe, expect, it } from "vitest";
import { esUuid } from "./ids";
import { nombreDeClubOSeleccion } from "./textos";
import { clubIdDeLaBase, clubOSeleccionDeLaBase, esClubId, esClubOSeleccion, numeroDeClubDeLaBase } from "./tipos";

describe("esUuid", () => {
  it("acepta un uuid, en minúsculas o mayúsculas", () => {
    expect(esUuid("0b6f1c2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b")).toBe(true);
    expect(esUuid("0B6F1C2E-3A4D-4E5F-8A9B-0C1D2E3F4A5B")).toBe(true);
  });

  it.each(["", "123", "0b6f1c2e-3a4d-4e5f-8a9b-0c1d2e3f4a5", " 0b6f1c2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b", null, 42, undefined])(
    "rechaza %j",
    (valor) => {
      expect(esUuid(valor)).toBe(false);
    },
  );
});

describe("esClubId", () => {
  it("acepta solo los dos Clubes", () => {
    expect(esClubId("penarol")).toBe(true);
    expect(esClubId("nacional")).toBe(true);
    expect(esClubId("Peñarol")).toBe(false);
    expect(esClubId("")).toBe(false);
    expect(esClubId(null)).toBe(false);
  });
});

describe("clubIdDeLaBase", () => {
  it("devuelve el Club y lanza con un valor que no es un Club", () => {
    expect(clubIdDeLaBase("nacional")).toBe("nacional");
    expect(() => clubIdDeLaBase("otro")).toThrow();
  });
});

describe("esClubId con la Selección", () => {
  it("la Selección no es un Club", () => {
    expect(esClubId("seleccion")).toBe(false);
    expect(() => clubIdDeLaBase("seleccion")).toThrow();
  });
});

describe("esClubOSeleccion", () => {
  it("acepta los dos Clubes y la Selección", () => {
    expect(esClubOSeleccion("penarol")).toBe(true);
    expect(esClubOSeleccion("nacional")).toBe(true);
    expect(esClubOSeleccion("seleccion")).toBe(true);
    expect(esClubOSeleccion("uruguay")).toBe(false);
    expect(esClubOSeleccion(undefined)).toBe(false);
  });
});

describe("clubOSeleccionDeLaBase", () => {
  it("devuelve el Club o la Selección y lanza con otro valor", () => {
    expect(clubOSeleccionDeLaBase("seleccion")).toBe("seleccion");
    expect(clubOSeleccionDeLaBase("penarol")).toBe("penarol");
    expect(() => clubOSeleccionDeLaBase("otro")).toThrow();
  });
});

describe("nombreDeClubOSeleccion", () => {
  it("nombra a los Clubes y a la Selección", () => {
    expect(nombreDeClubOSeleccion("penarol")).toBe("Peñarol");
    expect(nombreDeClubOSeleccion("nacional")).toBe("Nacional");
    expect(nombreDeClubOSeleccion("seleccion")).toBe("Selección");
  });
});

describe("numeroDeClubDeLaBase", () => {
  it("devuelve el número de un Jugador de un Club y lanza si falta (solo la Selección no lleva)", () => {
    expect(numeroDeClubDeLaBase(10)).toBe(10);
    expect(() => numeroDeClubDeLaBase(null)).toThrow();
  });
});

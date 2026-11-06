import { describe, expect, it } from "vitest";
import { esUuid } from "./ids";
import { clubIdDeLaBase, esClubId } from "./tipos";

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

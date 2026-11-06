import { describe, expect, it } from "vitest";
import { confirmaBorrado, confirmacionDeBorrado } from "./index";

describe("confirmación del borrado de cuenta", () => {
  it("con email, el Hincha tiene que escribir su email", () => {
    expect(confirmacionDeBorrado("hincha@ejemplo.com")).toBe("hincha@ejemplo.com");
    expect(confirmaBorrado("hincha@ejemplo.com", "hincha@ejemplo.com")).toBe(true);
  });

  it("sin email, el Hincha tiene que escribir BORRAR", () => {
    expect(confirmacionDeBorrado(null)).toBe("BORRAR");
    expect(confirmaBorrado("BORRAR", null)).toBe(true);
    expect(confirmaBorrado("", null)).toBe(false);
  });

  it("ignora mayúsculas y espacios alrededor", () => {
    expect(confirmaBorrado("  Hincha@Ejemplo.com ", "hincha@ejemplo.com")).toBe(true);
    expect(confirmaBorrado("borrar", null)).toBe(true);
  });

  it("cualquier otro texto no confirma", () => {
    expect(confirmaBorrado("", "hincha@ejemplo.com")).toBe(false);
    expect(confirmaBorrado("hincha@ejemplo", "hincha@ejemplo.com")).toBe(false);
    expect(confirmaBorrado("BORRAR", "hincha@ejemplo.com")).toBe(false);
    expect(confirmaBorrado("otro@ejemplo.com", "hincha@ejemplo.com")).toBe(false);
  });
});

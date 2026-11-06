import { describe, expect, it } from "vitest";
import { decidirAccesoAdmin } from "./acceso-admin";

describe("decidirAccesoAdmin", () => {
  it("sin sesión, al login", () => {
    expect(decidirAccesoAdmin(null)).toEqual({ tipo: "login" });
  });

  it("un Hincha no ve el backoffice", () => {
    expect(decidirAccesoAdmin({ rol: "hincha", aal: "aal2" })).toEqual({ tipo: "denegado" });
  });

  it("un Admin sin 2FA en la sesión va al enrolamiento/verificación", () => {
    expect(decidirAccesoAdmin({ rol: "admin", aal: "aal1" })).toEqual({ tipo: "dos-factores" });
    expect(decidirAccesoAdmin({ rol: "admin", aal: null })).toEqual({ tipo: "dos-factores" });
  });

  it("un Admin con sesión AAL2 entra", () => {
    expect(decidirAccesoAdmin({ rol: "admin", aal: "aal2" })).toEqual({ tipo: "admin" });
  });
});

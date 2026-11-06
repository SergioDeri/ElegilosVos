import { describe, expect, it } from "vitest";
import { decidirAcceso, rutaSegura } from "./rutas";

describe("decidirAcceso", () => {
  it("sin sesión, una ruta de la app manda al login recordando a dónde iba", () => {
    expect(decidirAcceso("/partido/123", false)).toEqual({
      tipo: "redirigir",
      destino: "/login?next=%2Fpartido%2F123",
    });
  });

  it("sin sesión, el inicio manda al login sin next", () => {
    expect(decidirAcceso("/", false)).toEqual({ tipo: "redirigir", destino: "/login" });
  });

  it("con sesión, las rutas de la app siguen", () => {
    expect(decidirAcceso("/", true)).toEqual({ tipo: "seguir" });
    expect(decidirAcceso("/elegir-club", true)).toEqual({ tipo: "seguir" });
  });

  it.each(["/login", "/registro", "/verificar"])("sin sesión, %s es accesible", (ruta) => {
    expect(decidirAcceso(ruta, false)).toEqual({ tipo: "seguir" });
  });

  it.each(["/login", "/registro", "/verificar"])("con sesión, %s manda al inicio", (ruta) => {
    expect(decidirAcceso(ruta, true)).toEqual({ tipo: "redirigir", destino: "/" });
  });

  it.each(["/recuperar", "/auth/callback", "/auth/salir", "/api/cron/cierre"])("%s es accesible con o sin sesión", (ruta) => {
    expect(decidirAcceso(ruta, false)).toEqual({ tipo: "seguir" });
    expect(decidirAcceso(ruta, true)).toEqual({ tipo: "seguir" });
  });

  it("el link público del 11 Elegido (ticket 16) es accesible con o sin sesión", () => {
    const ruta = "/compartir/once-elegido/00000000-0000-0000-0000-000000000000";
    expect(decidirAcceso(ruta, false)).toEqual({ tipo: "seguir" });
    expect(decidirAcceso(ruta, true)).toEqual({ tipo: "seguir" });
  });

  it("no confunde rutas que solo empiezan parecido", () => {
    expect(decidirAcceso("/loginx", false)).toEqual({ tipo: "redirigir", destino: "/login?next=%2Floginx" });
  });
});

describe("rutaSegura", () => {
  it("acepta rutas internas", () => {
    expect(rutaSegura("/partido/123?x=1")).toBe("/partido/123?x=1");
  });

  it.each([null, undefined, "", "https://malo.com", "//malo.com", "/\\malo.com", "javascript:alert(1)", "partido"])(
    "descarta destinos externos o raros (%s) y vuelve al inicio",
    (destino) => {
      expect(rutaSegura(destino)).toBe("/");
    },
  );

  // Ticket 17: el parser de URL descarta tabs y saltos de línea, así que
  // "/\t/malo.com" termina siendo "//malo.com" (otro sitio).
  it.each(["/\t/malo.com", "/\n/malo.com", "/\r/malo.com", "/ /malo.com", "/\u0000/malo.com", "/\\/malo.com"])(
    "descarta destinos con caracteres de control o barras invertidas (%j)",
    (destino) => {
      expect(rutaSegura(destino)).toBe("/");
    },
  );

  it("descarta destinos demasiado largos", () => {
    expect(rutaSegura(`/${"a".repeat(2048)}`)).toBe("/");
  });
});

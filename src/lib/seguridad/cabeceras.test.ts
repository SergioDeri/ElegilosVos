import { describe, expect, it } from "vitest";
import { cabecerasDeSeguridad } from "./cabeceras";

function mapa(opciones: Parameters<typeof cabecerasDeSeguridad>[0]) {
  return new Map(cabecerasDeSeguridad(opciones).map((c) => [c.key, c.value]));
}

function directivas(csp: string | undefined) {
  return new Map(
    (csp ?? "")
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [nombre, ...valores] = d.split(/\s+/);
        return [nombre, valores] as const;
      }),
  );
}

const PRODUCCION = { supabaseUrl: "https://abcd.supabase.co", desarrollo: false, produccion: true };

describe("cabecerasDeSeguridad", () => {
  it("bloquea que la app se muestre dentro de un iframe", () => {
    const c = mapa(PRODUCCION);
    expect(c.get("X-Frame-Options")).toBe("DENY");
    expect(directivas(c.get("Content-Security-Policy")).get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("incluye las cabeceras básicas", () => {
    const c = mapa(PRODUCCION);
    expect(c.get("X-Content-Type-Options")).toBe("nosniff");
    expect(c.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(c.get("Permissions-Policy")).toContain("camera=()");
    expect(c.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
  });

  it("deja conectarse y cargar imágenes solo de la app y de Supabase", () => {
    const d = directivas(mapa(PRODUCCION).get("Content-Security-Policy"));
    expect(d.get("default-src")).toEqual(["'self'"]);
    expect(d.get("connect-src")).toEqual(["'self'", "https://abcd.supabase.co"]);
    expect(d.get("img-src")).toEqual(["'self'", "data:", "blob:", "https://abcd.supabase.co"]);
    expect(d.get("worker-src")).toEqual(["'self'"]);
    expect(d.get("object-src")).toEqual(["'none'"]);
    expect(d.get("base-uri")).toEqual(["'self'"]);
    expect(d.get("form-action")).toEqual(["'self'"]);
    expect(d.has("upgrade-insecure-requests")).toBe(true);
  });

  it("no permite eval en producción, sí en desarrollo (lo usa React para depurar)", () => {
    expect(directivas(mapa(PRODUCCION).get("Content-Security-Policy")).get("script-src")).not.toContain("'unsafe-eval'");
    const dev = mapa({ supabaseUrl: "http://127.0.0.1:54321", desarrollo: true, produccion: false });
    expect(directivas(dev.get("Content-Security-Policy")).get("script-src")).toContain("'unsafe-eval'");
  });

  it("con Supabase por http (local) no fuerza https ni manda HSTS fuera de producción", () => {
    const c = mapa({ supabaseUrl: "http://127.0.0.1:54321", desarrollo: false, produccion: false });
    const d = directivas(c.get("Content-Security-Policy"));
    expect(d.has("upgrade-insecure-requests")).toBe(false);
    expect(d.get("connect-src")).toEqual(["'self'", "http://127.0.0.1:54321"]);
    expect(c.has("Strict-Transport-Security")).toBe(false);
  });

  it("usa solo el origen de la URL de Supabase e ignora valores inválidos", () => {
    const conRuta = directivas(
      mapa({ ...PRODUCCION, supabaseUrl: "https://abcd.supabase.co/rest/v1/" }).get("Content-Security-Policy"),
    );
    expect(conRuta.get("connect-src")).toEqual(["'self'", "https://abcd.supabase.co"]);

    for (const supabaseUrl of [undefined, "", "no es url", "javascript:alert(1)", "https://a.co; script-src *"]) {
      const d = directivas(mapa({ ...PRODUCCION, supabaseUrl }).get("Content-Security-Policy"));
      expect(d.get("connect-src")).toEqual(["'self'"]);
      expect(d.get("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    }
  });
});

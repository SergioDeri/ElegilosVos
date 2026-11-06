// La clave privada VAPID nunca llega al navegador (ticket 15). Chequeo
// estático complementario a `import "server-only"` en web-push.ts (que hace
// fallar el build si un componente cliente lo importa, aunque sea indirecto).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx|js|mjs)$/.test(nombre) && !nombre.endsWith(".test.ts") ? [ruta] : [];
  });
}

const fuentes = archivos(join(RAIZ, "src")).map((ruta) => ({ ruta, texto: readFileSync(ruta, "utf8") }));
const esCliente = (texto: string) => /^\s*(\/\/[^\n]*\n\s*)*["']use client["']/.test(texto);

describe("VAPID_PRIVATE_KEY", () => {
  it("solo la lee src/lib/notificaciones/web-push.ts, que es server-only", () => {
    const usan = fuentes.filter((f) => /\.VAPID_PRIVATE_KEY|\[["']VAPID_PRIVATE_KEY["']\]/.test(f.texto)).map((f) => f.ruta);
    expect(usan).toEqual([join(RAIZ, "src", "lib", "notificaciones", "web-push.ts")]);
    expect(readFileSync(usan[0]!, "utf8")).toMatch(/^(\/\/[^\n]*\n)*import "server-only";/);
  });

  it("ningún componente cliente importa el envío ni la librería web-push", () => {
    const clientes = fuentes.filter((f) => esCliente(f.texto));
    expect(clientes.length).toBeGreaterThan(0);
    for (const { ruta, texto } of clientes) {
      expect(texto, ruta).not.toMatch(/from ["'](web-push|@\/lib\/notificaciones\/[^"']*)["']/);
    }
  });

  it("no hay variables públicas con la clave privada ni la usa el service worker", () => {
    for (const { ruta, texto } of fuentes) expect(texto, ruta).not.toMatch(/NEXT_PUBLIC_VAPID_PRIVATE/);
    expect(readFileSync(join(RAIZ, "public", "sw.js"), "utf8")).not.toMatch(/VAPID/);
  });
});

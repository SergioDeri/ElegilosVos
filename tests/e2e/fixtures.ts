// API para los specs E2E. Uso típico:
//
//   import { expect, iniciarSesion, test } from "./fixtures";
//
//   test("...", async ({ page, crearHincha }) => {
//     const hincha = await crearHincha({ club: "nacional" }); // o { club: null }
//     await iniciarSesion(page, hincha);
//     await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
//   });
//
// Cada Hincha que crea `crearHincha` se borra solo al terminar el test.
// Ojo con el rate limit de Auth (`auth.rate_limit.sign_in_sign_ups`: 30
// logins cada 5 minutos por IP, compartido con los tests de RLS): cada
// `iniciarSesion` es un login real. Un login por test.
import { test as base, expect, type Page } from "@playwright/test";
import { borrarHinchaDePrueba, crearHinchaDePrueba, type HinchaDePrueba, type OpcionesHincha } from "./usuarios";

export { expect };
export type { HinchaDePrueba };

export const test = base.extend<{ crearHincha: (opciones: OpcionesHincha) => Promise<HinchaDePrueba> }>({
  crearHincha: async ({}, usar) => {
    const creados: string[] = [];
    await usar(async (opciones) => {
      const hincha = await crearHinchaDePrueba(opciones);
      creados.push(hincha.id);
      return hincha;
    });
    for (const id of creados) await borrarHinchaDePrueba(id);
  },
});

/**
 * Inicia sesión con email y contraseña desde el formulario de /login, como lo
 * haría el Hincha, y espera a salir del login (a `/`, o a `/elegir-club` si
 * no tiene Club Favorito).
 */
export async function iniciarSesion(page: Page, hincha: Pick<HinchaDePrueba, "email" | "contrasena">) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(hincha.email);
  await page.getByLabel("Contraseña").fill(hincha.contrasena);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

// Smoke test: lo que ya existía antes del feature Selección sigue andando de
// punta a punta (navegador → Next → Supabase local).
import { expect, iniciarSesion, test } from "./fixtures";

test("un Hincha con Club inicia sesión con email y ve su pantalla principal", async ({ page, crearHincha }) => {
  const hincha = await crearHincha({ club: "penarol" });

  await iniciarSesion(page, hincha);

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Elegilos Vos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver el 11 Elegido y el historial" })).toBeVisible();
});

test("un Hincha sin Club Favorito inicia sesión y le piden elegir Club", async ({ page, crearHincha }) => {
  const hincha = await crearHincha({ club: null });

  await iniciarSesion(page, hincha);

  await expect(page).toHaveURL("/elegir-club");
  await expect(page.getByRole("heading", { level: 1, name: "¿De qué cuadro sos?" })).toBeVisible();
});

// Selección, ticket 15: búsqueda de elegibles en el banco. Usa la fecha doble
// de supabase/seeds/e2e-05-votar-la-seleccion.sql (Votación abierta) y los
// elegibles de la migración *_seleccion15_elegibles_completos.sql.
import { expect, iniciarSesion, test } from "./fixtures";

test("en la Selección, la búsqueda filtra el banco por nombre sin importar tildes y se puede colocar al encontrado", async ({
  page,
  crearHincha,
}) => {
  const hincha = await crearHincha({ club: "penarol" });
  await iniciarSesion(page, hincha);
  await page.goto("/seleccion");

  const banco = page.getByRole("group", { name: /^Suplentes/ });
  const buscar = page.getByRole("searchbox", { name: "Buscar" });
  await expect(banco.getByRole("button", { name: "Sergio Rochet, ARQ", exact: true })).toBeVisible();

  await buscar.fill("nunez");
  await expect(banco.getByRole("button", { name: /^Darwin Núñez, DEL/ })).toBeVisible();
  await expect(banco.getByRole("button", { name: "Sergio Rochet, ARQ", exact: true })).toHaveCount(0);
  await expect(page.getByText(/^1 de \d+ suplentes\.$/)).toBeVisible();

  // El encontrado se coloca como siempre: tocarlo y tocar el Puesto.
  await banco.getByRole("button", { name: /^Darwin Núñez, DEL/ }).click();
  await page.getByRole("button", { name: "Centrodelantero: vacío" }).click();
  await expect(page.getByRole("button", { name: /: Darwin Núñez$/ })).toBeVisible();

  await buscar.fill("zzz");
  await expect(page.getByText("Ningún suplente con ese nombre.")).toBeVisible();
  await buscar.fill("");
  await expect(banco.getByRole("button", { name: "Sergio Rochet, ARQ", exact: true })).toBeVisible();
});

test("en un Club no hay búsqueda", async ({ page, crearHincha }) => {
  const hincha = await crearHincha({ club: "penarol" });
  await iniciarSesion(page, hincha);
  await page.goto("/");
  await expect(page.getByRole("searchbox", { name: "Buscar" })).toHaveCount(0);
});

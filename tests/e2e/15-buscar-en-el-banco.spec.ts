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
  const buscar = page.getByRole("searchbox", { name: "Buscar suplente" });
  const cancha = page.getByRole("group", { name: /^Cancha, Esquema/ });
  await expect(banco.getByRole("button", { name: "Sergio Rochet, ARQ", exact: true })).toBeVisible();

  const medida = async () => {
    const r = (await cancha.boundingBox())!;
    return { ancho: r.width, alto: r.height };
  };
  const tamano = await medida();
  // El buscador va arriba de los suplentes, dentro del banco.
  const enElBanco = await buscar.boundingBox();
  const caja = await banco.boundingBox();
  expect(enElBanco!.y).toBeGreaterThanOrEqual(caja!.y);
  expect(enElBanco!.y + enElBanco!.height).toBeLessThanOrEqual(caja!.y + caja!.height);

  await buscar.fill("nunez");
  await expect(banco.getByRole("button", { name: /^Darwin Núñez, DEL/ })).toBeVisible();
  await expect(banco.getByRole("button", { name: "Sergio Rochet, ARQ", exact: true })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: /^1 de \d+ suplentes\.$/ })).toHaveCount(1);
  // Buscar no cambia el tamaño de la cancha.
  expect(await medida()).toEqual(tamano);

  // El encontrado se coloca como siempre: tocarlo y tocar el Puesto.
  await banco.getByRole("button", { name: /^Darwin Núñez, DEL/ }).click();
  await page.getByRole("button", { name: "Centrodelantero: vacío" }).click();
  await expect(page.getByRole("button", { name: /: Darwin Núñez$/ })).toBeVisible();

  await buscar.fill("zzz");
  await expect(page.getByText("Ningún suplente con ese nombre.").first()).toBeVisible();
  expect(await medida()).toEqual(tamano);
  await buscar.fill("");
  await expect(banco.getByRole("button", { name: "Sergio Rochet, ARQ", exact: true })).toBeVisible();
});

test("en un Club no hay búsqueda", async ({ page, crearHincha }) => {
  const hincha = await crearHincha({ club: "penarol" });
  await iniciarSesion(page, hincha);
  await page.goto("/");
  await expect(page.getByRole("searchbox", { name: "Buscar suplente" })).toHaveCount(0);
});

// Selección, ticket 06: registro "solo Selección" y aviso de la Selección.
// Usa la fecha doble de supabase/seeds/e2e-05-votar-la-seleccion.sql (las dos
// Votaciones abiertas; la pantalla arranca por la de Perú) y los elegibles de
// seleccion-04-plantel.sql. Un login por test.
import { expect, iniciarSesion, test } from "./fixtures";
import { clienteServicio } from "./usuarios";

const PERU = "Perú (E2E 05)";

async function perfil(id: string) {
  const { data, error } = await clienteServicio().from("perfil").select("club_favorito_id, eligio_solo_seleccion").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function alineacionesGuardadas(hinchaId: string): Promise<number> {
  const { count } = await clienteServicio().from("alineacion").select("id", { count: "exact", head: true }).eq("hincha_id", hinchaId);
  return count ?? 0;
}

test("registro con \"solo Selección\": arma y guarda, lo invitan a elegir Club y lo elige después desde su cuenta", async ({
  page,
  crearHincha,
}) => {
  const hincha = await crearHincha({ club: null });
  await iniciarSesion(page, hincha);

  // El selector de Club del registro ofrece votar solo por la Selección y explica que el Club se elige después.
  await expect(page).toHaveURL("/elegir-club");
  await expect(page.getByText("podés elegir tu Club más tarde")).toBeVisible();
  await page.getByRole("button", { name: "Quiero votar solo por la Selección" }).click();

  // Entra directo a la Selección, sin selector ni pantallas de Clubes.
  await expect(page).toHaveURL("/seleccion");
  await expect(page.getByRole("heading", { name: `Selección vs ${PERU}` })).toBeVisible();
  expect(await perfil(hincha.id)).toEqual({ club_favorito_id: null, eligio_solo_seleccion: true });
  await expect(page.getByRole("navigation", { name: "Club o Selección" })).toHaveCount(0);
  await page.getByRole("button", { name: "Menú de usuario" }).click();
  await expect(page.getByRole("link", { name: "Mis formaciones" })).toHaveCount(0);
  await page.goto("/mis-formaciones");
  await expect(page).toHaveURL("/seleccion");

  // Todavía no guardó nada: no hay invitación.
  const invitacion = page.getByRole("status", { name: "Elegí tu Club" });
  await expect(page.getByRole("heading", { name: `Selección vs ${PERU}` })).toBeVisible();
  await expect(invitacion).toHaveCount(0);

  // Arma y guarda: aparece la invitación a elegir Club.
  await page.getByRole("button", { name: "Sergio Rochet, ARQ", exact: true }).click();
  await page.getByRole("button", { name: "Arquero: vacío" }).click();
  await expect.poll(() => alineacionesGuardadas(hincha.id)).toBe(1);
  await expect(invitacion).toBeVisible();

  // La descarta, y sigue descartada al recargar.
  await invitacion.getByRole("button", { name: "Ahora no" }).click();
  await expect(invitacion).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Arquero: Sergio Rochet" })).toBeVisible();
  await expect(invitacion).toHaveCount(0);

  // Más tarde elige Club desde su cuenta, una sola vez: ya no le ofrecen "solo Selección".
  await page.goto("/cuenta");
  await page.getByRole("link", { name: "Elegir mi Club" }).click();
  await expect(page).toHaveURL("/elegir-club");
  await expect(page.getByRole("button", { name: "Quiero votar solo por la Selección" })).toHaveCount(0);
  await page.getByRole("button", { name: "Nacional" }).click();
  await page.getByRole("button", { name: "Sí, soy de Nacional" }).click();
  await expect(page).toHaveURL("/");
  expect(await perfil(hincha.id)).toEqual({ club_favorito_id: "nacional", eligio_solo_seleccion: true });

  // Queda fijo: la pantalla de elegir ya no está, y la cuenta lo muestra como cualquier Club.
  await page.goto("/elegir-club");
  await expect(page).toHaveURL("/");
  await page.goto("/cuenta");
  await expect(page.getByText("Tu Club Favorito no se puede cambiar desde la app.")).toBeVisible();
});

test("un Hincha con Club ve el aviso de la Selección una sola vez y cambia con el selector", async ({ page, crearHincha }) => {
  const hincha = await crearHincha({ club: "penarol" });
  await iniciarSesion(page, hincha);
  await expect(page).toHaveURL("/");

  const aviso = page.getByRole("status", { name: "Novedad: la Selección" });
  await expect(aviso).toBeVisible();
  await aviso.getByRole("link", { name: "Votar la Selección" }).click();
  await expect(page).toHaveURL("/seleccion");
  await expect(page.getByRole("heading", { name: `Selección vs ${PERU}` })).toBeVisible();
  await expect(aviso).toHaveCount(0);

  // En este dispositivo ya no vuelve a aparecer.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Elegilos Vos" })).toBeVisible();
  await expect(aviso).toHaveCount(0);

  // El selector "mi club / Selección" lleva de una a la otra.
  const selector = page.getByRole("navigation", { name: "Club o Selección" });
  await selector.getByRole("link", { name: "Selección" }).click();
  await expect(page).toHaveURL("/seleccion");
  await expect(selector.getByRole("link", { name: "Selección" })).toHaveAttribute("aria-current", "page");
  await selector.getByRole("link", { name: "Peñarol" }).click();
  await expect(page).toHaveURL("/");
  await expect(selector.getByRole("link", { name: "Peñarol" })).toHaveAttribute("aria-current", "page");
  await expect(aviso).toHaveCount(0);
});

// Selección, ticket 08: el Parcial de la Selección con el Más Pedido. Usa la
// fecha doble de supabase/seeds/e2e-05-votar-la-seleccion.sql (vs Perú y vs
// Venezuela, con las dos Votaciones abiertas): un Parcial por Partido.
import { expect, iniciarSesion, test } from "./fixtures";
import { clienteServicio } from "./usuarios";

const PERU = "Perú (E2E 05)";
const VENEZUELA = "Venezuela (E2E 05)";

async function partidoContra(rival: string): Promise<string> {
  const { data, error } = await clienteServicio()
    .from("partido")
    .select("id, rival!inner(nombre)")
    .eq("club_id", "seleccion")
    .eq("rival.nombre", rival)
    .single();
  if (error) throw error;
  return data.id;
}

async function elegible(nombre: string): Promise<string> {
  const { data, error } = await clienteServicio()
    .from("jugador")
    .select("id")
    .eq("club_id", "seleccion")
    .eq("nombre", nombre)
    .single();
  if (error) throw error;
  return data.id;
}

test("el Parcial de la Selección muestra el 11 que va ganando y el Más Pedido de cada Partido", async ({ page, crearHincha }) => {
  const hincha = await crearHincha({ club: "nacional" });
  const [peru, venezuela, rochet, mele] = await Promise.all([
    partidoContra(PERU),
    partidoContra(VENEZUELA),
    elegible("Sergio Rochet"),
    elegible("Santiago Mele"),
  ]);
  const hora = new Date().toISOString();
  const { error } = await clienteServicio()
    .from("alineacion")
    .insert([
      { hincha_id: hincha.id, partido_id: peru, esquema: "4-3-3", puestos: { ARQ: { jugadorId: rochet, modificadoEn: hora } } },
      { hincha_id: hincha.id, partido_id: venezuela, esquema: "4-3-3", puestos: { ARQ: { jugadorId: mele, modificadoEn: hora } } },
    ]);
  if (error) throw error;
  await iniciarSesion(page, hincha);

  await page.goto("/seleccion");
  await page.getByRole("link", { name: "Ver el Parcial: el 11 que va ganando" }).click();
  await expect(page).toHaveURL(`/seleccion/parcial?partido=${peru}`);
  await expect(page.getByRole("heading", { name: "Parcial de la Selección" })).toBeVisible();

  const masPedido = page.getByRole("region", { name: "Más Pedido" });
  await expect(masPedido).toContainText("Sergio Rochet");
  await expect(masPedido).toContainText("%");
  await expect(page.getByRole("list", { name: "El 11 que va ganando en 4-3-3" })).toBeVisible();

  // Fecha doble: un Parcial por Partido.
  await page.getByRole("navigation", { name: "Elegí el Partido" }).getByRole("link", { name: `vs ${VENEZUELA}` }).click();
  await expect(page).toHaveURL(`/seleccion/parcial?partido=${venezuela}`);
  await expect(masPedido).toContainText("Santiago Mele");
});

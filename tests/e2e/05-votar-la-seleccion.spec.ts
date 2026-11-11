// Selección, ticket 05: votar la Selección. Usa la fecha doble de
// supabase/seeds/e2e-05-votar-la-seleccion.sql (vs Perú y vs Venezuela, con
// las dos Votaciones abiertas) y los elegibles de la migración *_seleccion15_elegibles_completos.sql.
import type { Page } from "@playwright/test";
import { expect, iniciarSesion, test } from "./fixtures";
import { clienteServicio } from "./usuarios";

const PERU = "Perú (E2E 05)";
const VENEZUELA = "Venezuela (E2E 05)";

/** El id del Partido de la Selección contra el Rival del seed. */
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

/** Los Jugadores (por nombre) de la Alineación guardada del Hincha para el Partido, por Puesto. */
async function guardada(hinchaId: string, partidoId: string): Promise<Record<string, string>> {
  const servicio = clienteServicio();
  const { data } = await servicio.from("alineacion").select("puestos").eq("hincha_id", hinchaId).eq("partido_id", partidoId).maybeSingle();
  const puestos = (data?.puestos ?? {}) as Record<string, { jugadorId: string }>;
  const ids = Object.values(puestos).map((p) => p.jugadorId);
  const { data: jugadores } = ids.length ? await servicio.from("jugador").select("id, nombre").in("id", ids) : { data: [] };
  const nombre = new Map((jugadores ?? []).map((j) => [j.id, j.nombre]));
  return Object.fromEntries(Object.entries(puestos).map(([puesto, p]) => [puesto, nombre.get(p.jugadorId) ?? "?"]));
}

/** Toca un suplente y después el Puesto (la alternativa sin arrastre). */
async function colocar(page: Page, jugador: string, posicion: string, puesto: string) {
  await page.getByRole("button", { name: `${jugador}, ${posicion}`, exact: true }).click();
  await page.getByRole("button", { name: `${puesto}: vacío` }).click();
  await expect(page.getByRole("button", { name: `${puesto}: ${jugador}` })).toBeVisible();
}

test("fecha doble: el Hincha elige el Partido, la segunda arranca con la copia de la primera y cada una sigue por su lado", async ({ page, crearHincha }) => {
  const hincha = await crearHincha({ club: "penarol" });
  const [peru, venezuela] = await Promise.all([partidoContra(PERU), partidoContra(VENEZUELA)]);
  await iniciarSesion(page, hincha);

  // Selector "mi club / Selección" de la barra.
  const selector = page.getByRole("navigation", { name: "Club o Selección" });
  await expect(selector.getByRole("link", { name: "Peñarol" })).toHaveAttribute("aria-current", "page");
  await selector.getByRole("link", { name: "Selección" }).click();
  await expect(page).toHaveURL("/seleccion");
  await expect(selector.getByRole("link", { name: "Selección" })).toHaveAttribute("aria-current", "page");

  // Dos Votaciones abiertas: elige el Partido; arranca por el primero.
  const partidos = page.getByRole("navigation", { name: "Elegí el Partido" });
  await expect(partidos.getByRole("link")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: `Selección vs ${PERU}` })).toBeVisible();

  // Sin número: el suplente se nombra con el nombre completo.
  await colocar(page, "Sergio Rochet", "ARQ", "Arquero");
  await colocar(page, "José María Giménez", "DEF", "Lateral izquierdo");
  await expect.poll(() => guardada(hincha.id, peru)).toEqual({ ARQ: "Sergio Rochet", LI: "José María Giménez" });

  // Herencia (ticket 07): la segunda arranca con una copia de lo que tiene en la primera, que sigue abierta.
  await partidos.getByRole("link", { name: `vs ${VENEZUELA}` }).click();
  await expect(page.getByRole("heading", { name: `Selección vs ${VENEZUELA}` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Arquero: Sergio Rochet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lateral izquierdo: José María Giménez" })).toBeVisible();
  await colocar(page, "Mathías Olivera", "DEF", "Lateral derecho");
  await expect
    .poll(() => guardada(hincha.id, venezuela))
    .toEqual({ ARQ: "Sergio Rochet", LI: "José María Giménez", LD: "Mathías Olivera" });

  // Cada una siguió por su lado.
  await partidos.getByRole("link", { name: `vs ${PERU}` }).click();
  await expect(page.getByRole("heading", { name: `Selección vs ${PERU}` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Arquero: Sergio Rochet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lateral derecho: vacío" })).toBeVisible();
  expect(await guardada(hincha.id, peru)).toEqual({ ARQ: "Sergio Rochet", LI: "José María Giménez" });
});

test("un Hincha de Nacional arma su Alineación de la Selección y sigue ahí al recargar", async ({ page, crearHincha }) => {
  const hincha = await crearHincha({ club: "nacional" });
  const peru = await partidoContra(PERU);
  await iniciarSesion(page, hincha);

  await page.getByRole("navigation", { name: "Club o Selección" }).getByRole("link", { name: "Selección" }).click();
  await expect(page.getByRole("heading", { name: `Selección vs ${PERU}` })).toBeVisible();
  await colocar(page, "Giorgian De Arrascaeta", "MED", "Lateral izquierdo");
  await expect.poll(() => guardada(hincha.id, peru)).toEqual({ LI: "Giorgian De Arrascaeta" });

  await page.reload();
  await expect(page.getByRole("button", { name: "Lateral izquierdo: Giorgian De Arrascaeta" })).toBeVisible();
});

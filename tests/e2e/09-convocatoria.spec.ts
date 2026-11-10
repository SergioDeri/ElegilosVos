// Selección, ticket 09: con Convocatoria, el armado marca a los convocados
// (los no convocados se siguen eligiendo) y el Parcial muestra el Gran
// Ausente provisorio. El Partido y la Convocatoria los crea el test (y los
// borra al final), para no tocar la fecha doble que usan los tickets 05 y 08.
import { expect, iniciarSesion, test } from "./fixtures";
import { clienteServicio } from "./usuarios";

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

test("con Convocatoria, el armado marca a los convocados y el Parcial muestra el Gran Ausente", async ({ page, crearHincha }) => {
  const servicio = clienteServicio();
  const { data: rival, error: errorRival } = await servicio.from("rival").select("id").eq("nombre", "Perú (E2E 05)").single();
  if (errorRival) throw errorRival;
  const inicio = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  inicio.setUTCMinutes(0, 0, 0);
  const { data: partido, error: errorPartido } = await servicio
    .from("partido")
    .insert({ club_id: "seleccion", rival_id: rival.id, inicio: inicio.toISOString() })
    .select("id")
    .single();
  if (errorPartido) throw errorPartido;

  try {
    const [rochet, valverde, varela] = await Promise.all([
      elegible("Sergio Rochet"),
      elegible("Federico Valverde"),
      elegible("Guillermo Varela"),
    ]);
    const { error: errorConvocatoria } = await servicio.rpc("guardar_convocatoria", {
      convocatoria: null as never,
      jugadores: [rochet, valverde],
      partidos: [partido.id],
    });
    if (errorConvocatoria) throw errorConvocatoria;

    const hincha = await crearHincha({ club: "penarol" });
    const hora = new Date().toISOString();
    const { error } = await servicio.from("alineacion").insert({
      hincha_id: hincha.id,
      partido_id: partido.id,
      esquema: "4-3-3",
      puestos: { ARQ: { jugadorId: rochet, modificadoEn: hora }, LI: { jugadorId: varela, modificadoEn: hora } },
    });
    if (error) throw error;
    await iniciarSesion(page, hincha);

    await page.goto(`/seleccion?partido=${partido.id}`);
    await expect(page.getByText("Ya salió la Convocatoria")).toBeVisible();
    // En la cancha, el convocado y el no convocado (que se pudo poner igual).
    await expect(page.getByRole("button", { name: /Sergio Rochet, convocado/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Guillermo Varela, no convocado/ })).toBeVisible();
    // En el banco, un convocado y un no convocado, los dos elegibles.
    await expect(page.getByRole("button", { name: /^Federico Valverde, .*, convocado$/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /^Darwin Núñez, .*, no convocado$/ })).toBeEnabled();

    await page.goto(`/seleccion/parcial?partido=${partido.id}`);
    const granAusente = page.getByRole("region", { name: "Gran Ausente" });
    await expect(granAusente).toContainText("Guillermo Varela");
    await expect(granAusente).not.toContainText("Sergio Rochet");
    await expect(page.getByRole("region", { name: "Más Pedido" })).toHaveCount(0);
  } finally {
    // La Convocatoria queda sin Partidos; se borra con el Partido.
    const { data: aplica } = await servicio.from("convocatoria_partido").select("convocatoria_id").eq("partido_id", partido.id);
    await servicio.from("partido").delete().eq("id", partido.id);
    if (aplica?.length) await servicio.from("convocatoria").delete().in("id", aplica.map((c) => c.convocatoria_id));
  }
});

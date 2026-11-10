// Selección, ticket 10: al cierre, los resultados de la Selección muestran el
// 11 Elegido (nombre completo, sin número) y el Gran Ausente final destacado.
// El test crea un Partido de la Selección con la Votación ya cerrada, una
// Alineación y la Convocatoria; el resultado lo congela el cierre a pedido al
// abrir la pantalla. Todo se borra al final.
import { expect, iniciarSesion, test } from "./fixtures";
import { clienteServicio } from "./usuarios";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

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

test("los resultados de la Selección muestran el 11 Elegido y el Gran Ausente final", async ({ page, crearHincha }) => {
  const servicio = clienteServicio();
  const { data: rival, error: errorRival } = await servicio.from("rival").select("id").eq("nombre", "Perú (E2E 05)").single();
  if (errorRival) throw errorRival;
  // Empezó hace 2 horas: la Votación cerró hace 3.
  const inicio = new Date(Date.now() - 2 * HORA);
  inicio.setUTCSeconds(0, 0);
  const { data: partido, error: errorPartido } = await servicio
    .from("partido")
    .insert({
      club_id: "seleccion",
      rival_id: rival.id,
      inicio: inicio.toISOString(),
      creado_en: new Date(Date.now() - 20 * DIA).toISOString(),
    })
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

    const hincha = await crearHincha({ club: null });
    const hora = new Date(Date.now() - DIA).toISOString();
    const { error } = await servicio.from("alineacion").insert({
      hincha_id: hincha.id,
      partido_id: partido.id,
      esquema: "4-3-3",
      esquema_elegido_a_mano: true,
      esquema_modificado_en: hora,
      puestos: { ARQ: { jugadorId: rochet, modificadoEn: hora }, LI: { jugadorId: varela, modificadoEn: hora } },
    });
    if (error) throw error;
    await servicio.from("perfil").update({ eligio_solo_seleccion: true }).eq("id", hincha.id);
    await iniciarSesion(page, hincha);

    await page.goto("/seleccion");
    await page.getByRole("link", { name: "Ver el 11 Elegido y el historial" }).click();
    await expect(page).toHaveURL("/seleccion/resultados");
    await expect(page.getByRole("heading", { name: "11 Elegido de la Selección" })).toBeVisible();

    // El último Partido cerrado es el del test: el cierre a pedido lo congeló.
    const ultimo = page.getByRole("region", { name: "Último Partido" });
    await expect(ultimo.getByRole("region", { name: "Gran Ausente final" })).toContainText("Guillermo Varela");
    await expect(ultimo.getByRole("region", { name: "Gran Ausente final" })).not.toContainText("Sergio Rochet");
    // En la cancha, el nombre completo y sin número (marcado: está en su Alineación, ticket 11).
    await expect(ultimo.getByRole("listitem", { name: /: Sergio Rochet \(en tu Alineación\)$/ })).toBeVisible();
    // Compartir en la Selección (ticket 12).
    await expect(ultimo.getByRole("button", { name: /Compartir/ })).toBeVisible();

    await page.goto(`/seleccion/resultados/${partido.id}`);
    await expect(page.getByRole("region", { name: "Gran Ausente final" })).toContainText("Guillermo Varela");
  } finally {
    const { data: aplica } = await servicio.from("convocatoria_partido").select("convocatoria_id").eq("partido_id", partido.id);
    await servicio.from("partido").delete().eq("id", partido.id);
    if (aplica?.length) await servicio.from("convocatoria").delete().in("id", aplica.map((c) => c.convocatoria_id));
  }
});

// Selección, ticket 11: con el 11 Real cargado, los resultados de la Selección
// lo muestran comparado con el 11 Elegido ("la hinchada acertó X de 11") y la
// Coincidencia de la Alineación del Hincha con los dos. El test crea un
// Partido de la Selección con la Votación ya cerrada, la Alineación de un
// Hincha con Club y el 11 Real (con la service role: la carga del Admin con
// 2FA la prueban los tests de RLS); el resultado lo congela el cierre a pedido
// al abrir la pantalla. Todo se borra al final.
import { expect, iniciarSesion, test } from "./fixtures";
import { clienteServicio } from "./usuarios";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

test("los resultados de la Selección muestran el 11 Real y las Coincidencias del Hincha", async ({ page, crearHincha }) => {
  const servicio = clienteServicio();
  const { data: rival, error: errorRival } = await servicio.from("rival").select("id").eq("nombre", "Perú (E2E 05)").single();
  if (errorRival) throw errorRival;
  // Empezó hace 2 horas: la Votación cerró hace 3 y ya se puede cargar el 11 Real.
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
    const { data: elegibles, error: errorElegibles } = await servicio
      .from("jugador")
      .select("id, nombre")
      .eq("club_id", "seleccion")
      .eq("en_plantel", true)
      .order("nombre");
    if (errorElegibles) throw errorElegibles;
    const id = (nombre: string) => elegibles.find((j) => j.nombre === nombre)!.id;
    const rochet = id("Sergio Rochet");
    const varela = id("Guillermo Varela");
    // El 11 Real: Rochet y 10 elegibles más, sin Varela.
    const onceReal = [rochet, ...elegibles.filter((j) => j.id !== rochet && j.id !== varela).slice(0, 10).map((j) => j.id)];
    const { error: errorOnceReal } = await servicio.from("once_real").insert({ partido_id: partido.id, jugadores: onceReal });
    if (errorOnceReal) throw errorOnceReal;

    const hincha = await crearHincha({ club: "nacional" });
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
    await iniciarSesion(page, hincha);

    await page.goto(`/seleccion/resultados/${partido.id}`);
    // Su Alineación (Rochet y Varela) es todo el 11 Elegido que votó alguien; del 11 Real, solo Rochet.
    await expect(
      page.getByRole("status").filter({ hasText: "Coincidiste en 2 de 11 con el 11 Elegido y en 1 de 11 con el 11 Real." }),
    ).toBeVisible();
    const real = page.getByRole("region", { name: "11 Real" });
    await expect(real.getByRole("status")).toContainText(/La hinchada acertó \d+ de 11\./);
    // Nombre completo, sin número.
    await expect(real.getByRole("listitem").filter({ hasText: /^Sergio Rochet \(en el 11 Elegido\)$/ })).toBeVisible();
    await expect(real.getByRole("listitem")).toHaveCount(11);

    // El historial también muestra cuánto acertó la hinchada.
    await page.goto("/seleccion/resultados");
    await expect(page.getByRole("region", { name: "Historial" })).toContainText(/la hinchada acertó \d+ de 11 del 11 Real/);
  } finally {
    await servicio.from("partido").delete().eq("id", partido.id);
  }
});

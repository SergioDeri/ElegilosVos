// Selección, ticket 12: compartir en la Selección. Con la Votación cerrada,
// los resultados muestran el botón de compartir; la imagen del 11 Elegido
// (pública) y la de "Mi 11" (con la sesión) salen como PNG, y la página
// pública lleva el Gran Ausente final. El test crea un Partido de la
// Selección ya cerrado, una Alineación completa y la Convocatoria; el cierre a
// pedido congela el resultado al abrir la pantalla. Todo se borra al final.
import { writeFile } from "node:fs/promises";
import { esquema } from "@/domain/esquemas";
import { expect, iniciarSesion, test } from "./fixtures";
import { clienteServicio } from "./usuarios";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

// 4-3-3 con nombres largos (dos renglones) y uno que no queda convocado.
const ONCE = [
  "Sergio Rochet",
  "Mathías Olivera",
  "José María Giménez",
  "Sebastián Cáceres",
  "Guillermo Varela",
  "Federico Valverde",
  "Rodrigo Bentancur",
  "Giorgian De Arrascaeta",
  "Facundo Pellistri",
  "Darwin Núñez",
  "Maximiliano Araújo",
];
const NO_CONVOCADO = "Giorgian De Arrascaeta";

test("compartir el 11 Elegido y Mi 11 de la Selección", async ({ page, crearHincha }, info) => {
  const servicio = clienteServicio();
  const { data: rival, error: errorRival } = await servicio.from("rival").select("id").eq("nombre", "Perú (E2E 05)").single();
  if (errorRival) throw errorRival;
  const { data: elegibles, error: errorElegibles } = await servicio
    .from("jugador")
    .select("id, nombre")
    .eq("club_id", "seleccion")
    .in("nombre", ONCE);
  if (errorElegibles) throw errorElegibles;
  const id = (nombre: string) => elegibles.find((j) => j.nombre === nombre)!.id;

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
    const { error: errorConvocatoria } = await servicio.rpc("guardar_convocatoria", {
      convocatoria: null as never,
      jugadores: ONCE.filter((n) => n !== NO_CONVOCADO).map(id),
      partidos: [partido.id],
    });
    if (errorConvocatoria) throw errorConvocatoria;

    const hincha = await crearHincha({ club: null });
    const hora = new Date(Date.now() - DIA).toISOString();
    const puestos = Object.fromEntries(
      esquema("4-3-3").puestos.map((p, i) => [p.id, { jugadorId: id(ONCE[i]!), modificadoEn: hora }]),
    );
    const { error } = await servicio.from("alineacion").insert({
      hincha_id: hincha.id,
      partido_id: partido.id,
      esquema: "4-3-3",
      esquema_elegido_a_mano: true,
      esquema_modificado_en: hora,
      puestos,
    });
    if (error) throw error;
    await servicio.from("perfil").update({ eligio_solo_seleccion: true }).eq("id", hincha.id);
    await iniciarSesion(page, hincha);

    await page.goto(`/seleccion/resultados/${partido.id}`);
    await expect(page.getByRole("region", { name: "Gran Ausente final" })).toContainText(NO_CONVOCADO);
    await expect(page.getByRole("button", { name: /Compartir/ })).toBeVisible();

    // La imagen pública del 11 Elegido y la de Mi 11 (con la sesión del Hincha).
    for (const [ruta, archivo] of [
      [`/api/imagen/once-elegido/${partido.id}`, "11-elegido-seleccion-vs-peru-e2e-05-"],
      [`/api/imagen/mi-alineacion/${partido.id}`, "mi-11-seleccion-vs-peru-e2e-05-"],
    ] as const) {
      const respuesta = await page.request.get(ruta);
      expect(respuesta.status()).toBe(200);
      expect(respuesta.headers()["content-type"]).toBe("image/png");
      expect(respuesta.headers()["content-disposition"]).toContain(archivo);
      // Queda en test-results para mirarla.
      await writeFile(info.outputPath(`${archivo}.png`), await respuesta.body());
    }

    // La página pública (el link que se comparte), sin sesión.
    await page.context().clearCookies();
    await page.goto(`/compartir/once-elegido/${partido.id}`);
    await expect(page.getByRole("heading", { name: "Selección vs Perú (E2E 05)" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Gran Ausente final" })).toContainText(`${NO_CONVOCADO}: en el 100 %`);
    await expect(page.getByRole("listitem", { name: /: Giorgian De Arrascaeta$/ })).toBeVisible();
  } finally {
    const { data: aplica } = await servicio.from("convocatoria_partido").select("convocatoria_id").eq("partido_id", partido.id);
    await servicio.from("partido").delete().eq("id", partido.id);
    if (aplica?.length) await servicio.from("convocatoria").delete().in("id", aplica.map((c) => c.convocatoria_id));
  }
});

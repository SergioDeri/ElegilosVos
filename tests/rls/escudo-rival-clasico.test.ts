// El Rival del Clásico (el que tiene `club_id`) sin escudo propio se muestra
// con el escudo de su Club: así alcanza con subirlo una vez, en "Clubes".
// Lo lee leerPartidos (pantalla de armado, Herencia y notificaciones).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { leerPartidos } from "@/lib/club/lecturas";
import { clienteServicio } from "./helpers";

const servicio = clienteServicio();
const rutaClub = `clubes/penarol/${crypto.randomUUID()}.png`;
const rutaPropia = `rivales/${crypto.randomUUID()}.png`;

let rivalId = "";
let partidoId = "";
let escudoClubOriginal: string | null = null;
let escudoRivalOriginal: string | null = null;

async function escudoDelRivalEnArmado(): Promise<string | null | undefined> {
  const partidos = await leerPartidos(servicio, "nacional");
  return partidos.find((p) => p.id === partidoId)?.rival?.escudoPath;
}

async function ponerEscudoAlRival(ruta: string | null) {
  const { error } = await servicio.from("rival").update({ escudo_path: ruta }).eq("id", rivalId);
  if (error) throw error;
}

beforeAll(async () => {
  const { data: rival, error } = await servicio.from("rival").select("id, escudo_path").eq("club_id", "penarol").single();
  if (error) throw error;
  rivalId = rival.id;
  escudoRivalOriginal = rival.escudo_path;

  const { data: club, error: errorClub } = await servicio.from("club").select("escudo_path").eq("id", "penarol").single();
  if (errorClub) throw errorClub;
  escudoClubOriginal = club.escudo_path;
  const { error: errorEscudo } = await servicio.from("club").update({ escudo_path: rutaClub }).eq("id", "penarol");
  if (errorEscudo) throw errorEscudo;

  const { data: partido, error: errorPartido } = await servicio
    .from("partido")
    .insert({ club_id: "nacional", rival_id: rivalId, inicio: "2031-03-01T22:00:00Z" })
    .select("id")
    .single();
  if (errorPartido) throw errorPartido;
  partidoId = partido.id;
});

afterAll(async () => {
  if (partidoId) await servicio.from("partido").delete().eq("id", partidoId);
  if (rivalId) await servicio.from("rival").update({ escudo_path: escudoRivalOriginal }).eq("id", rivalId);
  await servicio.from("club").update({ escudo_path: escudoClubOriginal }).eq("id", "penarol");
});

describe("escudo del Rival del Clásico", () => {
  it("sin escudo propio, usa el de su Club", async () => {
    await ponerEscudoAlRival(null);
    expect(await escudoDelRivalEnArmado()).toBe(rutaClub);
  });

  it("con escudo propio, usa el suyo", async () => {
    await ponerEscudoAlRival(rutaPropia);
    expect(await escudoDelRivalEnArmado()).toBe(rutaPropia);
  });
});

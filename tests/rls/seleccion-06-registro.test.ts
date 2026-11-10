// Tests de RLS del ticket 06 del feature Selección: registro "solo Selección".
//
// - `elegir_solo_seleccion()` marca en el perfil que el Hincha eligió "Quiero
//   votar solo por la Selección" (sin Club Favorito). Solo si todavía no tiene
//   Club; repetirla no cambia nada.
// - Un Hincha sin Club guarda Alineaciones de la Selección y no de un Club.
// - Después puede elegir Club una sola vez (`elegir_club_favorito`) y queda fijo.
// - La marca no se borra ni se escribe por la API.
//
// Un solo usuario descartable (cada `crearUsuario` es un login real).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SELECCION } from "@/domain/comun/tipos";
import { creadorDePartidos, jugadoresDisponibles, partidoAbierto } from "./datos";
import { borrarUsuario, clienteComo, clienteServicio, crearUsuario, usuario } from "./helpers";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

const creados: string[] = [];
const crearPartido = creadorDePartidos(creados);
const servicio = clienteServicio();

const puesto = (jugadorId: string) => ({ jugadorId, modificadoEn: new Date().toISOString() });
const alineacion = (partidoId: string, arquero: string) => ({
  partido_id: partidoId,
  esquema: "4-3-3",
  esquema_elegido_a_mano: true,
  puestos: { ARQ: puesto(arquero) },
});

async function perfil(id: string) {
  const { data, error } = await servicio.from("perfil").select("club_favorito_id, eligio_solo_seleccion").eq("id", id).single();
  if (error) throw error;
  return data;
}

let nuevo: Awaited<ReturnType<typeof crearUsuario>>;
let seleccion = "";
let arqueroSeleccion = "";

beforeAll(async () => {
  nuevo = await crearUsuario({ club: null });
  seleccion = await crearPartido(SELECCION, new Date(Date.now() + 3 * DIA), { creadoEn: new Date(Date.now() - 30 * DIA) });
  arqueroSeleccion = (await jugadoresDisponibles(SELECCION)).arquero;
});

afterAll(async () => {
  if (nuevo) await borrarUsuario(nuevo.id);
  if (creados.length) await servicio.from("partido").delete().in("id", creados);
});

describe("\"Quiero votar solo por la Selección\"", () => {
  it("un perfil nuevo arranca sin elegir nada", async () => {
    expect(await perfil(nuevo.id)).toEqual({ club_favorito_id: null, eligio_solo_seleccion: false });
  });

  it("el Hincha lee la marca en su perfil", async () => {
    const { data } = await nuevo.cliente.from("perfil").select("eligio_solo_seleccion").eq("id", nuevo.id).single();
    expect(data).toEqual({ eligio_solo_seleccion: false });
  });

  it("elegir_solo_seleccion la marca sin darle Club, y repetirla no cambia nada", async () => {
    expect((await nuevo.cliente.rpc("elegir_solo_seleccion")).error).toBeNull();
    expect(await perfil(nuevo.id)).toEqual({ club_favorito_id: null, eligio_solo_seleccion: true });
    expect((await nuevo.cliente.rpc("elegir_solo_seleccion")).error).toBeNull();
    expect(await perfil(nuevo.id)).toEqual({ club_favorito_id: null, eligio_solo_seleccion: true });
  });

  it("no se escribe con un UPDATE directo", async () => {
    const { error } = await nuevo.cliente.from("perfil").update({ eligio_solo_seleccion: false }).eq("id", nuevo.id).select();
    expect(error).not.toBeNull();
    expect((await perfil(nuevo.id)).eligio_solo_seleccion).toBe(true);
  });

  it("un Hincha que ya tiene Club no la puede elegir", async () => {
    const { error } = await clienteComo("hinchaPenarol").rpc("elegir_solo_seleccion");
    expect(error?.code).toBe("EV001");
    expect(await perfil(usuario("hinchaPenarol").id)).toEqual({ club_favorito_id: "penarol", eligio_solo_seleccion: false });
  });
});

describe("Hincha sin Club", () => {
  it("guarda su Alineación de la Selección", async () => {
    const { error } = await nuevo.cliente.from("alineacion").insert(alineacion(seleccion, arqueroSeleccion));
    expect(error).toBeNull();
    const { data } = await nuevo.cliente.from("alineacion").select("partido_id").eq("partido_id", seleccion);
    expect(data).toEqual([{ partido_id: seleccion }]);
  });

  it("no guarda Alineaciones de un Club", async () => {
    const delClub = await partidoAbierto("penarol");
    const { arquero } = await jugadoresDisponibles("penarol");
    const { error } = await nuevo.cliente.from("alineacion").insert(alineacion(delClub, arquero));
    expect(error).not.toBeNull();
  });
});

describe("\"solo Selección\" y después un Club", () => {
  it("elige Club una sola vez, y queda fijo", async () => {
    const primera = await nuevo.cliente.rpc("elegir_club_favorito", { club: "nacional" });
    expect(primera.error).toBeNull();
    expect(await perfil(nuevo.id)).toEqual({ club_favorito_id: "nacional", eligio_solo_seleccion: true });

    const segunda = await nuevo.cliente.rpc("elegir_club_favorito", { club: "penarol" });
    expect(segunda.error?.code).toBe("EV001");
    expect((await perfil(nuevo.id)).club_favorito_id).toBe("nacional");
  });

  it("con Club, ya no puede volver a \"solo Selección\"", async () => {
    const { error } = await nuevo.cliente.rpc("elegir_solo_seleccion");
    expect(error?.code).toBe("EV001");
    expect((await perfil(nuevo.id)).club_favorito_id).toBe("nacional");
  });

  it("sigue con su Alineación de la Selección", async () => {
    const { data } = await nuevo.cliente.from("alineacion").select("partido_id").eq("partido_id", seleccion);
    expect(data).toEqual([{ partido_id: seleccion }]);
  });
});

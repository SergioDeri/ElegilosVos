// Tests de RLS del ticket 01 del feature Selección: la Selección existe en la
// tabla `club` (marcada), nadie puede elegirla como Club Favorito, y el número
// de un Jugador es obligatorio solo en el Plantel de un Club.
import { afterAll, describe, expect, it } from "vitest";
import { borrarUsuario, clienteAnonimo, clienteServicio, crearAdminConDosFactores, crearUsuario, usuario } from "./helpers";

const creados: string[] = [];
const jugadores: string[] = [];

afterAll(async () => {
  if (jugadores.length > 0) await clienteServicio().from("jugador").delete().in("id", jugadores);
  for (const id of creados) await borrarUsuario(id);
});

describe("la Selección en la tabla de clubes", () => {
  it("se lee sin sesión, marcada como Selección, y los Clubes no", async () => {
    const { data, error } = await clienteAnonimo().from("club").select("id, nombre, es_seleccion").order("id");
    expect(error).toBeNull();
    expect(data).toEqual([
      { id: "nacional", nombre: "Nacional", es_seleccion: false },
      { id: "penarol", nombre: "Peñarol", es_seleccion: false },
      { id: "seleccion", nombre: "Selección", es_seleccion: true },
    ]);
  });
});

describe("la Selección no puede ser Club Favorito", () => {
  it("un Hincha sin Club no puede elegirla", async () => {
    const nuevo = await crearUsuario({ club: null });
    creados.push(nuevo.id);
    const { error } = await nuevo.cliente.rpc("elegir_club_favorito", { club: "seleccion" });
    expect(error?.code).toBe("22023");

    // Sigue pudiendo elegir un Club de verdad.
    const club = await nuevo.cliente.rpc("elegir_club_favorito", { club: "penarol" });
    expect(club.error).toBeNull();
  });

  it("el Admin con 2FA no puede ponérsela a un Hincha", async (contexto) => {
    const admin = await crearAdminConDosFactores();
    if (!admin) return contexto.skip();
    creados.push(admin.id);
    const { error } = await admin.cliente.rpc("cambiar_club_favorito", {
      hincha: usuario("hinchaNacional").id,
      club: "seleccion",
    });
    expect(error?.code).toBe("22023");
  });

  it("tampoco se puede guardar en el perfil por fuera de las funciones", async () => {
    const { error } = await clienteServicio()
      .from("perfil")
      .update({ club_favorito_id: "seleccion" })
      .eq("id", usuario("hinchaNacional").id);
    expect(error).not.toBeNull();
  });
});

describe("el número del Jugador según el Plantel", () => {
  async function alta(club: string, numero: number | null) {
    const { data, error } = await clienteServicio()
      .from("jugador")
      .insert({ club_id: club, nombre: "Jugador de prueba", numero, posicion_natural: "MED" })
      .select("id")
      .maybeSingle();
    if (data) jugadores.push(data.id);
    return error;
  }

  it("en la Selección se guarda sin número", async () => {
    expect(await alta("seleccion", null)).toBeNull();
  });

  it("en la Selección no se guarda con número", async () => {
    expect(await alta("seleccion", 10)).not.toBeNull();
  });

  it("en un Club no se guarda sin número", async () => {
    expect(await alta("penarol", null)).not.toBeNull();
  });
});

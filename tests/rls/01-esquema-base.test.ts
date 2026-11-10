// Tests de RLS del esquema base (ticket 01).
import { describe, expect, it } from "vitest";
import { clienteAnonimo, clienteComo, clienteServicio, usuario } from "./helpers";

describe("perfil", () => {
  it("un usuario anónimo no puede leer los perfiles", async () => {
    const { data, error } = await clienteAnonimo().from("perfil").select("*");
    // Con RLS sin políticas, PostgREST no da error: devuelve cero filas.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el trigger crea el perfil de cada usuario nuevo (visto con la service role)", async () => {
    const { data, error } = await clienteServicio()
      .from("perfil")
      .select("id, club_favorito_id, rol")
      .eq("id", usuario("hinchaPenarol").id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ id: usuario("hinchaPenarol").id, club_favorito_id: "penarol", rol: "hincha" });
  });

  it("un usuario anónimo no puede crear perfiles", async () => {
    const { error } = await clienteAnonimo()
      .from("perfil")
      .insert({ id: crypto.randomUUID(), rol: "admin" });
    expect(error).not.toBeNull();
  });
});

describe("deny-by-default en las tablas del dominio", () => {
  // `perfil` salió de la lista en el ticket 04: el Hincha lee el suyo (ver 04-auth.test.ts).
  const tablas = ["rival", "partido", "jugador"] as const;

  for (const tabla of tablas) {
    it(`anónimo no lee ${tabla}`, async () => {
      const { data } = await clienteAnonimo().from(tabla).select("*");
      expect(data).toEqual([]);
    });

    // Que un Hincha autenticado no los lea dejó de valer en el ticket 09: lee
    // los de su Club (ver 09-alineacion.test.ts).
  }

  it("un Hincha no puede escribir Jugadores", async () => {
    const { error } = await clienteComo("hinchaPenarol")
      .from("jugador")
      .insert({ club_id: "penarol", nombre: "Colado", numero: 99, posicion_natural: "DEL" });
    expect(error).not.toBeNull();
  });
});

describe("club", () => {
  it("es de lectura pública", async () => {
    const { data } = await clienteAnonimo().from("club").select("id").order("id");
    // La Selección comparte la tabla (feature Selección, ticket 01).
    expect(data).toEqual([{ id: "nacional" }, { id: "penarol" }, { id: "seleccion" }]);
  });

  it("nadie lo puede modificar vía la API", async () => {
    const { data } = await clienteComo("admin").from("club").update({ nombre: "Otro" }).eq("id", "penarol").select();
    expect(data ?? []).toEqual([]);
    const { data: club } = await clienteAnonimo().from("club").select("nombre").eq("id", "penarol").single();
    expect(club?.nombre).toBe("Peñarol");
  });
});

describe("es_admin()", () => {
  it("es false para el Admin sin 2FA (AAL1)", async () => {
    const { data, error } = await clienteComo("admin").rpc("es_admin");
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("es false para un Hincha", async () => {
    const { data } = await clienteComo("hinchaNacional").rpc("es_admin");
    expect(data).toBe(false);
  });
});

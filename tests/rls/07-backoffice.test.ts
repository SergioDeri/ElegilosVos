// Tests de RLS del ticket 07: backoffice (Planteles, Disponibilidad y Club
// Favorito de un Hincha). Las escrituras de Admin exigen
// rol admin Y sesión AAL2 (`es_admin()`); un Hincha y un Admin sin 2FA no
// pueden escribir nada.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  borrarUsuario,
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  crearAdminConDosFactores,
  crearUsuario,
  usuario,
  type Cliente,
} from "./helpers";

// Si Supabase local tiene TOTP apagado, los tests que necesitan AAL2 se saltean.
const adminAal2 = await crearAdminConDosFactores();
const conDosFactores = adminAal2 !== null;
if (!conDosFactores) {
  console.warn("[07] TOTP apagado en Supabase local: se saltean los tests de Admin con 2FA. Reiniciá Supabase.");
}

const sinPermisos: [string, () => Cliente][] = [
  ["un Hincha", () => clienteComo("hinchaPenarol")],
  ["un Admin sin 2FA (AAL1)", () => clienteComo("admin")],
];

let jugadorId: string;

async function jugadorSegunServicio(id: string) {
  const { data, error } = await clienteServicio().from("jugador").select().eq("id", id).single();
  if (error) throw error;
  return data;
}

async function eventosDe(id: string) {
  const { data, error } = await clienteServicio()
    .from("evento_disponibilidad")
    .select("disponibilidad_anterior, disponibilidad_nueva, motivo, club_id")
    .eq("jugador_id", id)
    .order("momento");
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  const { data, error } = await clienteServicio()
    .from("jugador")
    .insert({ club_id: "nacional", nombre: "Jugador de Prueba 07", numero: 77, posicion_natural: "MED" })
    .select("id")
    .single();
  if (error) throw error;
  jugadorId = data.id;
});

afterAll(async () => {
  await clienteServicio().from("jugador").delete().eq("id", jugadorId);
  if (adminAal2) await borrarUsuario(adminAal2.id);
});

describe.each(sinPermisos)("jugador: %s no puede escribir", (_, cliente) => {
  it("no da de alta Jugadores", async () => {
    const { error } = await cliente()
      .from("jugador")
      .insert({ club_id: "penarol", nombre: "Intruso", numero: 50, posicion_natural: "DEL" });
    expect(error).not.toBeNull();
  });

  it("no edita, no cambia la Disponibilidad ni da de baja", async () => {
    for (const cambio of [
      { nombre: "Cambiado" },
      { disponibilidad: "lesionado" as const, motivo_disponibilidad: "Inventado" },
      { en_plantel: false },
    ]) {
      const { data } = await cliente().from("jugador").update(cambio).eq("id", jugadorId).select();
      expect(data ?? []).toEqual([]);
    }
    const jugador = await jugadorSegunServicio(jugadorId);
    expect(jugador).toMatchObject({ nombre: "Jugador de Prueba 07", disponibilidad: "disponible", en_plantel: true });
    expect(await eventosDe(jugadorId)).toEqual([]);
  });

  it("no borra Jugadores", async () => {
    await cliente().from("jugador").delete().eq("id", jugadorId);
    expect(await jugadorSegunServicio(jugadorId)).toBeTruthy();
  });

  it("no lee Jugadores de otro Club", async () => {
    const { data } = await cliente().from("jugador").select("id").eq("id", jugadorId);
    expect(data ?? []).toEqual([]);
  });
});

describe("evento_disponibilidad: sin acceso por la API", () => {
  const todos: [string, () => Cliente | null][] = [
    ["anónimo", () => clienteAnonimo()],
    ...sinPermisos,
    ["el Admin con 2FA", () => adminAal2?.cliente ?? null],
  ];

  it.each(todos)("%s no lee ni escribe eventos", async (_, obtener) => {
    const cliente = obtener();
    if (!cliente) return;
    const lectura = await cliente.from("evento_disponibilidad").select("id");
    expect(lectura.data ?? []).toEqual([]);
    const { error } = await cliente.from("evento_disponibilidad").insert({
      jugador_id: jugadorId,
      club_id: "nacional",
      disponibilidad_anterior: "disponible",
      disponibilidad_nueva: "lesionado",
    });
    expect(error).not.toBeNull();
  });
});

describe.skipIf(!conDosFactores)("jugador: el Admin con 2FA", () => {
  const admin = () => adminAal2!.cliente;

  it("lee Jugadores de cualquier Club", async () => {
    const { data } = await admin().from("jugador").select("id").eq("id", jugadorId);
    expect(data).toEqual([{ id: jugadorId }]);
  });

  it("da de alta y edita un Jugador", async () => {
    const { data, error } = await admin()
      .from("jugador")
      .insert({ club_id: "penarol", nombre: "Alta 07", numero: 98, posicion_natural: "DEL" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const id = data!.id;

    const editado = await admin().from("jugador").update({ nombre: "Alta 07 editado", numero: 97 }).eq("id", id).select();
    expect(editado.error).toBeNull();
    expect(editado.data).toHaveLength(1);
    expect(await jugadorSegunServicio(id)).toMatchObject({ nombre: "Alta 07 editado", numero: 97 });

    await clienteServicio().from("jugador").delete().eq("id", id);
  });

  it("cambia la Disponibilidad con motivo y queda registrado el evento", async () => {
    const r1 = await admin()
      .from("jugador")
      .update({ disponibilidad: "lesionado", motivo_disponibilidad: "Desgarro" })
      .eq("id", jugadorId)
      .select();
    expect(r1.data).toHaveLength(1);

    // Cambiar solo el motivo no es un cambio de Disponibilidad.
    await admin().from("jugador").update({ motivo_disponibilidad: "Desgarro grado 2" }).eq("id", jugadorId);

    await admin()
      .from("jugador")
      .update({ disponibilidad: "disponible", motivo_disponibilidad: null })
      .eq("id", jugadorId);

    expect(await eventosDe(jugadorId)).toEqual([
      { disponibilidad_anterior: "disponible", disponibilidad_nueva: "lesionado", motivo: "Desgarro", club_id: "nacional" },
      { disponibilidad_anterior: "lesionado", disponibilidad_nueva: "disponible", motivo: null, club_id: "nacional" },
    ]);
  });

  it("da de baja (lógica) y reincorpora", async () => {
    await admin().from("jugador").update({ en_plantel: false }).eq("id", jugadorId);
    expect((await jugadorSegunServicio(jugadorId)).en_plantel).toBe(false);
    await admin().from("jugador").update({ en_plantel: true }).eq("id", jugadorId);
    expect((await jugadorSegunServicio(jugadorId)).en_plantel).toBe(true);
  });

  it("no puede borrar físicamente un Jugador", async () => {
    const { error } = await admin().from("jugador").delete().eq("id", jugadorId);
    expect(error).not.toBeNull();
    expect(await jugadorSegunServicio(jugadorId)).toBeTruthy();
  });
});

describe("perfil: Club Favorito de un Hincha", () => {
  let hincha: Awaited<ReturnType<typeof crearUsuario>>;

  beforeAll(async () => {
    hincha = await crearUsuario({ club: "nacional" });
  });
  afterAll(async () => {
    await borrarUsuario(hincha.id);
  });

  async function clubDe(id: string) {
    const { data } = await clienteServicio().from("perfil").select("club_favorito_id, rol").eq("id", id).single();
    return data;
  }

  it.each(sinPermisos)("%s no cambia el Club Favorito de otro", async (_, cliente) => {
    const porFuncion = await cliente().rpc("cambiar_club_favorito", { hincha: hincha.id, club: "penarol" });
    expect(porFuncion.error?.code).toBe("42501");
    const porUpdate = await cliente().from("perfil").update({ club_favorito_id: "penarol" }).eq("id", hincha.id);
    expect(porUpdate.error).not.toBeNull();
    expect(await clubDe(hincha.id)).toEqual({ club_favorito_id: "nacional", rol: "hincha" });
  });

  it.each(sinPermisos)("%s no puede buscar Hinchas", async (_, cliente) => {
    const { data, error } = await cliente().rpc("buscar_hinchas", { texto: "rls.test" });
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("un anónimo no puede buscar Hinchas", async () => {
    const { error } = await clienteAnonimo().rpc("buscar_hinchas", { texto: "rls.test" });
    expect(error).not.toBeNull();
  });

  describe.skipIf(!conDosFactores)("el Admin con 2FA", () => {
    const admin = () => adminAal2!.cliente;

    it("lee perfiles ajenos", async () => {
      const { data } = await admin().from("perfil").select("id").eq("id", usuario("hinchaNacional").id);
      expect(data).toHaveLength(1);
    });

    it("busca Hinchas por email", async () => {
      const { data, error } = await admin().rpc("buscar_hinchas", { texto: "HINCHA.NACIONAL@rls" });
      expect(error).toBeNull();
      expect(data).toEqual([
        expect.objectContaining({ id: usuario("hinchaNacional").id, email: usuario("hinchaNacional").email, club_favorito_id: "nacional" }),
      ]);
    });

    it("los comodines del texto se toman literales", async () => {
      const { data } = await admin().rpc("buscar_hinchas", { texto: "%" });
      expect(data).toEqual([]);
    });

    it("cambia el Club Favorito de un Hincha", async () => {
      const { data, error } = await admin().rpc("cambiar_club_favorito", { hincha: hincha.id, club: "penarol" });
      expect(error).toBeNull();
      expect(data).toBe("penarol");
      expect(await clubDe(hincha.id)).toEqual({ club_favorito_id: "penarol", rol: "hincha" });
    });

    it("rechaza clubes inválidos y Hinchas inexistentes", async () => {
      const invalido = await admin().rpc("cambiar_club_favorito", { hincha: hincha.id, club: "defensor" });
      expect(invalido.error?.code).toBe("22023");
      const inexistente = await admin().rpc("cambiar_club_favorito", { hincha: crypto.randomUUID(), club: "penarol" });
      expect(inexistente.error?.code).toBe("P0002");
    });

    it("tampoco puede escribir perfiles con un UPDATE directo (ni cambiar roles)", async () => {
      const { error } = await admin().from("perfil").update({ rol: "admin" }).eq("id", hincha.id);
      expect(error).not.toBeNull();
      expect((await clubDe(hincha.id))?.rol).toBe("hincha");
    });
  });
});

// Las fotos de Jugadores se quitaron (diseño pixel art, ticket 08): ver
// pixel-08-quitar-fotos.test.ts.

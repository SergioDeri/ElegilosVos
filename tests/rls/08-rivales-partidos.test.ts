// Tests de RLS del ticket 08: Rivales (con escudo) y Partidos. Las escrituras
// exigen Admin con 2FA (`es_admin()`); un Hincha y un Admin sin 2FA no pueden
// escribir Rivales, Partidos ni escudos.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  borrarUsuario,
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  crearAdminConDosFactores,
  type Cliente,
} from "./helpers";

const adminAal2 = await crearAdminConDosFactores();
const conDosFactores = adminAal2 !== null;
if (!conDosFactores) {
  console.warn("[08] TOTP apagado en Supabase local: se saltean los tests de Admin con 2FA. Reiniciá Supabase.");
}

const sinPermisos: [string, () => Cliente][] = [
  ["un Hincha", () => clienteComo("hinchaPenarol")],
  ["un Admin sin 2FA (AAL1)", () => clienteComo("admin")],
];

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const LEJOS = new Date(Date.UTC(2034, 0, 1, 23)).toISOString();

const servicio = clienteServicio();
let rivalId: string;
let partidoId: string;
const rivalesCreados: string[] = [];
const partidosCreados: string[] = [];

async function rivalSegunServicio(id: string) {
  const { data } = await servicio.from("rival").select().eq("id", id).maybeSingle();
  return data;
}

async function partidoSegunServicio(id: string) {
  const { data } = await servicio.from("partido").select().eq("id", id).maybeSingle();
  return data;
}

async function rivalDelClub(club: "penarol" | "nacional") {
  const { data, error } = await servicio.from("rival").select("id").eq("club_id", club).single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  const rival = await servicio
    .from("rival")
    .insert({ nombre: `Rival 08 ${crypto.randomUUID()}` })
    .select("id")
    .single();
  if (rival.error) throw rival.error;
  rivalId = rival.data.id;
  rivalesCreados.push(rivalId);

  const partido = await servicio
    .from("partido")
    .insert({ club_id: "nacional", rival_id: rivalId, inicio: LEJOS })
    .select("id")
    .single();
  if (partido.error) throw partido.error;
  partidoId = partido.data.id;
  partidosCreados.push(partidoId);
});

afterAll(async () => {
  if (partidosCreados.length) await servicio.from("partido").delete().in("id", partidosCreados);
  if (rivalesCreados.length) await servicio.from("rival").delete().in("id", rivalesCreados);
  if (adminAal2) await borrarUsuario(adminAal2.id);
});

describe("seed: el catálogo marca qué Rival es cada Club", () => {
  it("las filas Peñarol y Nacional representan a cada Club", async () => {
    const { data } = await servicio.from("rival").select("nombre, club_id").not("club_id", "is", null).order("nombre");
    expect(data).toEqual([
      { nombre: "Nacional", club_id: "nacional" },
      { nombre: "Peñarol", club_id: "penarol" },
    ]);
  });
});

describe.each([["un anónimo", () => clienteAnonimo()] as [string, () => Cliente], ...sinPermisos])(
  "%s no puede escribir Rivales ni Partidos",
  (_, cliente) => {
    it("no da de alta, no edita ni borra Rivales", async () => {
      const alta = await cliente().from("rival").insert({ nombre: `Intruso ${crypto.randomUUID()}` });
      expect(alta.error).not.toBeNull();

      const edicion = await cliente().from("rival").update({ nombre: "Cambiado", activo: false }).eq("id", rivalId).select();
      expect(edicion.data ?? []).toEqual([]);

      await cliente().from("rival").delete().eq("id", rivalId);
      expect(await rivalSegunServicio(rivalId)).toMatchObject({ activo: true });
      expect((await rivalSegunServicio(rivalId))?.nombre).toMatch(/^Rival 08 /);
    });

    it("no da de alta, no posterga, no cancela ni borra Partidos", async () => {
      const alta = await cliente().from("partido").insert({ club_id: "penarol", rival_id: rivalId, inicio: LEJOS });
      expect(alta.error).not.toBeNull();

      for (const cambio of [{ inicio: new Date(Date.UTC(2034, 1, 1)).toISOString() }, { estado: "cancelado" as const }]) {
        const { data } = await cliente().from("partido").update(cambio).eq("id", partidoId).select();
        expect(data ?? []).toEqual([]);
      }

      await cliente().from("partido").delete().eq("id", partidoId);
      expect(await partidoSegunServicio(partidoId)).toMatchObject({ estado: "programado", inicio: expect.stringMatching(/^2034-01-01/) });
    });
  },
);

describe("partido_tiene_alineaciones: solo el Admin con 2FA", () => {
  it.each(sinPermisos)("%s no puede consultarla", async (_, cliente) => {
    const { error } = await cliente().rpc("partido_tiene_alineaciones", { partido: partidoId });
    expect(error?.code).toBe("42501");
  });
});

describe.skipIf(!conDosFactores)("el Admin con 2FA", () => {
  const admin = () => adminAal2!.cliente;

  it("lee todos los Rivales (también los dados de baja) y todos los Partidos", async () => {
    const { data: rivales } = await admin().from("rival").select("id, activo");
    expect(rivales!.some((r) => !r.activo)).toBe(true);
    const { data: partidos } = await admin().from("partido").select("club_id");
    // El seed también carga Partidos de la Selección (Selección, ticket 04).
    expect(new Set(partidos!.map((p) => p.club_id))).toEqual(new Set(["penarol", "nacional", "seleccion"]));
  });

  it("da de alta, edita, da de baja y borra un Rival sin Partidos", async () => {
    const { data, error } = await admin()
      .from("rival")
      .insert({ nombre: `Alta 08 ${crypto.randomUUID()}` })
      .select("id")
      .single();
    expect(error).toBeNull();
    const id = data!.id;
    rivalesCreados.push(id);

    const edicion = await admin().from("rival").update({ nombre: `Editado ${id}`, activo: false }).eq("id", id).select();
    expect(edicion.data).toHaveLength(1);

    const borrado = await admin().from("rival").delete().eq("id", id).select();
    expect(borrado.error).toBeNull();
    expect(await rivalSegunServicio(id)).toBeNull();
  });

  it("no puede borrar un Rival con Partidos (se da de baja)", async () => {
    const { error } = await admin().from("rival").delete().eq("id", rivalId);
    expect(error).not.toBeNull();
    expect(await rivalSegunServicio(rivalId)).not.toBeNull();
  });

  it("carga un Partido, lo posterga, lo cancela, lo reactiva y lo borra si no tiene Alineaciones", async () => {
    const { data, error } = await admin()
      .from("partido")
      .insert({ club_id: "penarol", rival_id: rivalId, inicio: LEJOS })
      .select("id, creado_en")
      .single();
    expect(error).toBeNull();
    const id = data!.id;
    partidosCreados.push(id);

    const nuevoInicio = new Date(Date.UTC(2034, 0, 8, 23)).toISOString();
    expect((await admin().from("partido").update({ inicio: nuevoInicio }).eq("id", id).select()).data).toHaveLength(1);
    expect((await admin().from("partido").update({ estado: "cancelado" }).eq("id", id).select()).data).toHaveLength(1);
    expect((await admin().from("partido").update({ estado: "programado" }).eq("id", id).select()).data).toHaveLength(1);
    expect(await partidoSegunServicio(id)).toMatchObject({ estado: "programado", creado_en: data!.creado_en });
    expect(new Date((await partidoSegunServicio(id))!.inicio).toISOString()).toBe(nuevoInicio);

    expect((await admin().rpc("partido_tiene_alineaciones", { partido: id })).data).toBe(false);
    expect((await admin().from("partido").delete().eq("id", id)).error).toBeNull();
    expect(await partidoSegunServicio(id)).toBeNull();
  });

  it("el Clásico: cada Club con el otro como Rival", async () => {
    const { data, error } = await admin()
      .from("partido")
      .insert([
        { club_id: "penarol", rival_id: await rivalDelClub("nacional"), inicio: LEJOS },
        { club_id: "nacional", rival_id: await rivalDelClub("penarol"), inicio: LEJOS },
      ])
      .select("id");
    expect(error).toBeNull();
    partidosCreados.push(...data!.map((p) => p.id));
  });

  it("un Club no puede jugar contra sí mismo", async () => {
    const alta = await admin().from("partido").insert({ club_id: "penarol", rival_id: await rivalDelClub("penarol"), inicio: LEJOS });
    expect(alta.error?.code).toBe("23514");
    const cambio = await admin().from("partido").update({ rival_id: await rivalDelClub("nacional") }).eq("id", partidoId);
    expect(cambio.error?.code).toBe("23514");
  });

  it("no ofrece Rivales dados de baja para Partidos nuevos ni para cambiar el Rival", async () => {
    const { data: baja } = await servicio
      .from("rival")
      .insert({ nombre: `Baja 08 ${crypto.randomUUID()}`, activo: false })
      .select("id")
      .single();
    rivalesCreados.push(baja!.id);
    const alta = await admin().from("partido").insert({ club_id: "penarol", rival_id: baja!.id, inicio: LEJOS });
    expect(alta.error?.code).toBe("23514");
    const cambio = await admin().from("partido").update({ rival_id: baja!.id }).eq("id", partidoId);
    expect(cambio.error?.code).toBe("23514");

    // Un Partido que ya tenía al Rival se puede seguir editando aunque se dé de baja.
    await servicio.from("rival").update({ activo: false }).eq("id", rivalId);
    try {
      const postergado = await admin().from("partido").update({ inicio: new Date(Date.UTC(2034, 0, 2, 23)).toISOString() }).eq("id", partidoId).select();
      expect(postergado.error).toBeNull();
      expect(postergado.data).toHaveLength(1);
    } finally {
      await servicio.from("rival").update({ activo: true }).eq("id", rivalId);
      await servicio.from("partido").update({ inicio: LEJOS }).eq("id", partidoId);
    }
  });

  it("no puede cambiar el Club ni la hora de carga de un Partido", async () => {
    const club = await admin().from("partido").update({ club_id: "penarol" }).eq("id", partidoId);
    expect(club.error).not.toBeNull();
    const creado = await admin().from("partido").update({ creado_en: new Date(0).toISOString() }).eq("id", partidoId);
    expect(creado.error).not.toBeNull();
    const alta = await admin()
      .from("partido")
      .insert({ club_id: "penarol", rival_id: rivalId, inicio: LEJOS, creado_en: new Date(0).toISOString() });
    expect(alta.error).not.toBeNull();
    expect(await partidoSegunServicio(partidoId)).toMatchObject({ club_id: "nacional" });
  });

  it("no puede borrar un Partido con Alineaciones (se cancela)", async () => {
    // Una Alineación vacía alcanza; la service role no pasa por la regla de Votación abierta.
    const { data: hincha } = await servicio.from("perfil").select("id").eq("club_favorito_id", "nacional").limit(1).single();
    const { error } = await servicio.from("alineacion").insert({ hincha_id: hincha!.id, partido_id: partidoId, esquema: "4-3-3" });
    expect(error).toBeNull();

    expect((await admin().rpc("partido_tiene_alineaciones", { partido: partidoId })).data).toBe(true);
    const borrado = await admin().from("partido").delete().eq("id", partidoId);
    expect(borrado.error?.code).toBe("EV080");
    expect(await partidoSegunServicio(partidoId)).not.toBeNull();

    const cancelado = await admin().from("partido").update({ estado: "cancelado" }).eq("id", partidoId).select();
    expect(cancelado.data).toHaveLength(1);
    // Cancelar no toca las Alineaciones.
    const { count } = await servicio.from("alineacion").select("id", { count: "exact", head: true }).eq("partido_id", partidoId);
    expect(count).toBe(1);
    await servicio.from("partido").update({ estado: "programado" }).eq("id", partidoId);
  });
});

describe("Storage: escudos (bucket `escudos`)", () => {
  const ruta = `pruebas/${crypto.randomUUID()}.png`;

  beforeAll(async () => {
    const { error } = await servicio.storage.from("escudos").upload(ruta, PNG, { contentType: "image/png" });
    if (error) throw error;
  });
  afterAll(async () => {
    await servicio.storage.from("escudos").remove([ruta]);
  });

  async function existe(path: string) {
    const [carpeta, nombre] = path.split("/");
    const { data } = await servicio.storage.from("escudos").list(carpeta, { search: nombre });
    return (data ?? []).some((o) => o.name === nombre);
  }

  it("cualquiera lee los escudos por la URL pública", async () => {
    const { data } = clienteAnonimo().storage.from("escudos").getPublicUrl(ruta);
    expect((await fetch(data.publicUrl)).status).toBe(200);
  });

  it.each([["un anónimo", () => clienteAnonimo()] as [string, () => Cliente], ...sinPermisos])(
    "%s no sube, no reemplaza ni borra escudos",
    async (_, cliente) => {
      const nueva = `pruebas/${crypto.randomUUID()}.png`;
      const subida = await cliente().storage.from("escudos").upload(nueva, PNG, { contentType: "image/png" });
      expect(subida.error).not.toBeNull();
      expect(await existe(nueva)).toBe(false);

      const reemplazo = await cliente().storage.from("escudos").upload(ruta, PNG, { contentType: "image/png", upsert: true });
      expect(reemplazo.error).not.toBeNull();

      await cliente().storage.from("escudos").remove([ruta]);
      expect(await existe(ruta)).toBe(true);
    },
  );

  describe.skipIf(!conDosFactores)("el Admin con 2FA", () => {
    const admin = () => adminAal2!.cliente;

    it("sube, reemplaza y borra escudos", async () => {
      const nueva = `pruebas/${crypto.randomUUID()}.png`;
      expect((await admin().storage.from("escudos").upload(nueva, PNG, { contentType: "image/png" })).error).toBeNull();
      expect((await admin().storage.from("escudos").upload(nueva, PNG, { contentType: "image/png", upsert: true })).error).toBeNull();
      expect((await admin().storage.from("escudos").remove([nueva])).error).toBeNull();
      expect(await existe(nueva)).toBe(false);
    });

    it("el bucket rechaza SVG y otros tipos", async () => {
      const svg = await admin()
        .storage.from("escudos")
        .upload(`pruebas/${crypto.randomUUID()}.svg`, new TextEncoder().encode("<svg/>"), { contentType: "image/svg+xml" });
      expect(svg.error).not.toBeNull();
    });
  });
});

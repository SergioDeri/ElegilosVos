// Diseño pixel art, ticket 07: escudos pixel 48x48 y sección "Clubes".
// Solo el Admin con 2FA cambia el escudo de un Club (`club.escudo_path`) y
// sube, reemplaza o borra archivos del bucket `escudos`; cualquiera lee el
// escudo. El bucket acepta solo PNG de hasta 64 KB.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { borrarUsuario, clienteAnonimo, clienteComo, clienteServicio, crearAdminConDosFactores, type Cliente } from "./helpers";

const adminAal2 = await crearAdminConDosFactores();
const conDosFactores = adminAal2 !== null;
if (!conDosFactores) console.warn("[pixel-07] TOTP apagado en Supabase local: se saltean los tests de Admin con 2FA.");

const sinPermisos: [string, () => Cliente][] = [
  ["un anónimo", () => clienteAnonimo()],
  ["un Hincha", () => clienteComo("hinchaPenarol")],
  ["un Admin sin 2FA (AAL1)", () => clienteComo("admin")],
];

/** Cabecera de un PNG de 48x48 (Storage no mira el contenido; la app sí). */
function png48(): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 48, 0, 0, 0, 48]);
  return b;
}

const rutaDePrueba = `clubes/penarol/${crypto.randomUUID()}.png`;

async function escudoDelClub(club: string) {
  const { data, error } = await clienteServicio().from("club").select("escudo_path").eq("id", club).single();
  if (error) throw error;
  return data.escudo_path;
}

async function existe(path: string) {
  const i = path.lastIndexOf("/");
  const { data } = await clienteServicio().storage.from("escudos").list(path.slice(0, i), { search: path.slice(i + 1) });
  return (data ?? []).some((o) => o.name === path.slice(i + 1));
}

beforeAll(async () => {
  const { error } = await clienteServicio().storage.from("escudos").upload(rutaDePrueba, png48(), { contentType: "image/png" });
  if (error) throw error;
  await clienteServicio().from("club").update({ escudo_path: rutaDePrueba }).eq("id", "penarol");
});

afterAll(async () => {
  await clienteServicio().from("club").update({ escudo_path: null }).in("id", ["penarol", "nacional"]);
  await clienteServicio().storage.from("escudos").remove([rutaDePrueba]);
  if (adminAal2) await borrarUsuario(adminAal2.id);
});

describe("lectura del escudo del Club", () => {
  it.each(sinPermisos)("%s lee la ruta del escudo", async (_, cliente) => {
    const { data, error } = await cliente().from("club").select("id, escudo_path").eq("id", "penarol").single();
    expect(error).toBeNull();
    expect(data?.escudo_path).toBe(rutaDePrueba);
  });

  it("cualquiera lee el archivo por la URL pública", async () => {
    const { data } = clienteAnonimo().storage.from("escudos").getPublicUrl(rutaDePrueba);
    expect((await fetch(data.publicUrl)).status).toBe(200);
  });
});

describe.each(sinPermisos)("%s no puede cambiar escudos", (_, cliente) => {
  it("no cambia el escudo del Club", async () => {
    const { data } = await cliente().from("club").update({ escudo_path: "clubes/penarol/otro.png" }).eq("id", "penarol").select();
    expect(data ?? []).toEqual([]);
    expect(await escudoDelClub("penarol")).toBe(rutaDePrueba);
  });

  it("no sube, no reemplaza ni borra archivos del bucket", async () => {
    const nueva = `clubes/nacional/${crypto.randomUUID()}.png`;
    const subida = await cliente().storage.from("escudos").upload(nueva, png48(), { contentType: "image/png" });
    expect(subida.error).not.toBeNull();
    expect(await existe(nueva)).toBe(false);

    const reemplazo = await cliente().storage.from("escudos").upload(rutaDePrueba, png48(), { contentType: "image/png", upsert: true });
    expect(reemplazo.error).not.toBeNull();

    await cliente().storage.from("escudos").remove([rutaDePrueba]);
    expect(await existe(rutaDePrueba)).toBe(true);
  });
});

describe.skipIf(!conDosFactores)("el Admin con 2FA", () => {
  const admin = () => adminAal2!.cliente;

  it("sube un escudo de Club, lo asigna, lo reemplaza y borra el anterior", async () => {
    const primero = `clubes/nacional/${crypto.randomUUID()}.png`;
    expect((await admin().storage.from("escudos").upload(primero, png48(), { contentType: "image/png" })).error).toBeNull();
    const asignado = await admin().from("club").update({ escudo_path: primero }).eq("id", "nacional").select("escudo_path");
    expect(asignado.error).toBeNull();
    expect(asignado.data).toEqual([{ escudo_path: primero }]);

    const segundo = `clubes/nacional/${crypto.randomUUID()}.png`;
    expect((await admin().storage.from("escudos").upload(segundo, png48(), { contentType: "image/png" })).error).toBeNull();
    expect((await admin().from("club").update({ escudo_path: segundo }).eq("id", "nacional").select()).data).toHaveLength(1);
    expect((await admin().storage.from("escudos").remove([primero])).error).toBeNull();
    expect(await existe(primero)).toBe(false);
    expect(await escudoDelClub("nacional")).toBe(segundo);

    await admin().storage.from("escudos").remove([segundo]);
  });

  it("no puede cambiar otra cosa del Club", async () => {
    const { error } = await admin().from("club").update({ nombre: "Otro" }).eq("id", "nacional");
    expect(error).not.toBeNull();
  });

  it("el bucket rechaza archivos que no son PNG y PNG de más de 64 KB", async () => {
    const jpeg = await admin()
      .storage.from("escudos")
      .upload(`clubes/nacional/${crypto.randomUUID()}.jpg`, new Uint8Array([0xff, 0xd8, 0xff]), { contentType: "image/jpeg" });
    expect(jpeg.error).not.toBeNull();

    const grande = new Uint8Array(64 * 1024 + 1);
    grande.set(png48());
    const pesado = await admin().storage.from("escudos").upload(`clubes/nacional/${crypto.randomUUID()}.png`, grande, { contentType: "image/png" });
    expect(pesado.error).not.toBeNull();
  });
});

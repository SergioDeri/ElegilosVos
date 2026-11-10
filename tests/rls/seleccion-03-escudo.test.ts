// Selección, ticket 03: el escudo de la AUF.
// La Selección tiene escudo como los Clubes (`club.escudo_path` de la fila
// `seleccion`, archivo en `clubes/seleccion/` del bucket `escudos`): solo el
// Admin con 2FA lo cambia y cualquiera lo lee. Se sube el PNG del repo
// (assets/escudos/seleccion.png), que el bucket acepta.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { borrarUsuario, clienteAnonimo, clienteComo, clienteServicio, crearAdminConDosFactores, type Cliente } from "./helpers";

const adminAal2 = await crearAdminConDosFactores();
const conDosFactores = adminAal2 !== null;
if (!conDosFactores) console.warn("[seleccion-03] TOTP apagado en Supabase local: se saltean los tests de Admin con 2FA.");

const pngDelRepo = new Uint8Array(readFileSync(new URL("../../assets/escudos/seleccion.png", import.meta.url)));

const sinPermisos: [string, () => Cliente][] = [
  ["un anónimo", () => clienteAnonimo()],
  ["un Hincha", () => clienteComo("hinchaPenarol")],
  ["un Admin sin 2FA (AAL1)", () => clienteComo("admin")],
];

async function escudoDeLaSeleccion() {
  const { data, error } = await clienteServicio().from("club").select("escudo_path").eq("id", "seleccion").single();
  if (error) throw error;
  return data.escudo_path;
}

const subidos: string[] = [];

afterAll(async () => {
  await clienteServicio().from("club").update({ escudo_path: null }).eq("id", "seleccion");
  if (subidos.length) await clienteServicio().storage.from("escudos").remove(subidos);
  if (adminAal2) await borrarUsuario(adminAal2.id);
});

describe.each(sinPermisos)("%s", (_, cliente) => {
  it("no sube el escudo de la Selección ni lo asigna", async () => {
    const ruta = `clubes/seleccion/${crypto.randomUUID()}.png`;
    const subida = await cliente().storage.from("escudos").upload(ruta, pngDelRepo, { contentType: "image/png" });
    expect(subida.error).not.toBeNull();

    const antes = await escudoDeLaSeleccion();
    const { data } = await cliente().from("club").update({ escudo_path: ruta }).eq("id", "seleccion").select();
    expect(data ?? []).toEqual([]);
    expect(await escudoDeLaSeleccion()).toBe(antes);
  });
});

describe.skipIf(!conDosFactores)("el Admin con 2FA", () => {
  const admin = () => adminAal2!.cliente;

  it("sube el PNG del escudo de la AUF, lo asigna a la Selección y cualquiera lo lee", async () => {
    const ruta = `clubes/seleccion/${crypto.randomUUID()}.png`;
    subidos.push(ruta);
    expect((await admin().storage.from("escudos").upload(ruta, pngDelRepo, { contentType: "image/png" })).error).toBeNull();
    const asignado = await admin().from("club").update({ escudo_path: ruta }).eq("id", "seleccion").select("escudo_path");
    expect(asignado.error).toBeNull();
    expect(asignado.data).toEqual([{ escudo_path: ruta }]);

    const { data, error } = await clienteAnonimo().from("club").select("escudo_path").eq("id", "seleccion").single();
    expect(error).toBeNull();
    expect(data?.escudo_path).toBe(ruta);
    const { data: url } = clienteAnonimo().storage.from("escudos").getPublicUrl(ruta);
    const respuesta = await fetch(url.publicUrl);
    expect(respuesta.status).toBe(200);
    expect(new Uint8Array(await respuesta.arrayBuffer())).toEqual(pngDelRepo);
  });
});

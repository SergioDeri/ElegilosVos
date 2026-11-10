// Tests de RLS del ticket 09 del feature Selección: Convocatoria y Gran
// Ausente provisorio.
//
// - La Convocatoria la lee cualquier usuario con sesión (y perfil); sin
//   sesión, nada.
// - Solo la escribe un Admin con 2FA (`guardar_convocatoria` y las tablas).
// - Solo convoca elegibles del Plantel de la Selección y solo se aplica a
//   Partidos de la Selección. Un Partido no queda en dos Convocatorias.
// - Cargarla no cambia lo que se puede votar.
// - Con Convocatoria, el Parcial muestra el Gran Ausente provisorio.
//
// Crea Partidos y Jugadores de prueba con la service role y un Admin con 2FA
// descartable; los borra al final.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SELECCION } from "@/domain/comun/tipos";
import { leerConvocados } from "@/lib/convocatoria/lecturas";
import { calcularParcialDeLaSeleccion } from "@/lib/parcial/seleccion";
import { creadorDePartidos, guardarConServicio, jugadoresDisponibles } from "./datos";
import { borrarUsuario, clienteAnonimo, clienteComo, clienteServicio, crearAdminConDosFactores, usuario, type Cliente } from "./helpers";

const admin = await crearAdminConDosFactores();
if (!admin) console.warn("[seleccion-09] TOTP apagado en Supabase local: se saltean los tests de Admin con 2FA.");
const conDosFactores = admin !== null;

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const hace = (ms: number) => new Date(Date.now() - ms);
const dentroDe = (ms: number) => new Date(Date.now() + ms);
const puesto = (jugadorId: string) => ({ jugadorId, modificadoEn: new Date().toISOString() });

const servicio = clienteServicio();
const partidos: string[] = [];
const crearPartido = creadorDePartidos(partidos, { creadoEn: hace(30 * DIA) });
const convocatorias: string[] = [];

const sinPermisos: [string, () => Cliente][] = [
  ["un Hincha", () => clienteComo("hinchaPenarol")],
  ["un Admin sin 2FA (AAL1)", () => clienteComo("admin")],
];

// Una fecha doble lejana (para cargar Convocatorias) y una Votación abierta.
let ida = "";
let vuelta = "";
let otra = "";
let abierto = "";
let delClub = "";
let arquero = "";
let campo: string[] = [];
let jugadorDelClub = "";

async function convocarConServicio(jugadores: string[], aplicaA: string[]): Promise<string> {
  const { data, error } = await servicio.rpc("guardar_convocatoria", { convocatoria: null as never, jugadores, partidos: aplicaA });
  if (error) throw error;
  convocatorias.push(data);
  return data;
}

beforeAll(async () => {
  ida = await crearPartido(SELECCION, new Date(Date.UTC(2035, 8, 4, 23)));
  vuelta = await crearPartido(SELECCION, new Date(Date.UTC(2035, 8, 9, 23)));
  otra = await crearPartido(SELECCION, new Date(Date.UTC(2035, 9, 9, 23)));
  abierto = await crearPartido(SELECCION, dentroDe(6 * DIA));
  delClub = await crearPartido("penarol", new Date(Date.UTC(2035, 8, 6, 23)));
  ({ arquero, campo } = await jugadoresDisponibles(SELECCION));
  ({ arquero: jugadorDelClub } = await jugadoresDisponibles("penarol"));
});

afterAll(async () => {
  if (convocatorias.length) await servicio.from("convocatoria").delete().in("id", convocatorias);
  if (partidos.length) await servicio.from("partido").delete().in("id", partidos);
  if (admin) await borrarUsuario(admin.id);
});

describe("lectura de la Convocatoria", () => {
  let convocatoria = "";
  beforeAll(async () => {
    convocatoria = await convocarConServicio([arquero, campo[0]!], [otra]);
  });

  it("cualquier usuario con sesión lee los convocados de un Partido", async () => {
    for (const nombre of ["hinchaPenarol", "hinchaNacional", "admin"] as const) {
      expect(await leerConvocados(clienteComo(nombre), otra)).toEqual([arquero, campo[0]!].sort());
    }
  });

  it("sin sesión no se lee nada", async () => {
    const anon = clienteAnonimo();
    // anon no tiene permisos sobre las tablas: error o vacío, nunca filas.
    expect((await anon.from("convocatoria").select("id").eq("id", convocatoria)).data ?? []).toEqual([]);
    for (const tabla of ["convocatoria_jugador", "convocatoria_partido"] as const) {
      const { data } = await anon.from(tabla).select("convocatoria_id").eq("convocatoria_id", convocatoria);
      expect(data ?? []).toEqual([]);
    }
    // Con sesión, sí.
    expect((await clienteComo("hinchaNacional").from("convocatoria").select("id").eq("id", convocatoria)).data).toEqual([
      { id: convocatoria },
    ]);
    expect((await anon.from("convocatoria_partido").select("convocatoria_id").eq("partido_id", otra)).data ?? []).toEqual([]);
  });

  it("un Partido sin Convocatoria no tiene convocados (null)", async () => {
    expect(await leerConvocados(clienteComo("hinchaPenarol"), vuelta)).toBeNull();
  });
});

describe("escritura de la Convocatoria", () => {
  it.each(sinPermisos)("%s no la carga, ni la corrige, ni la borra", async (_, cliente) => {
    const c = cliente();
    const alta = await c.rpc("guardar_convocatoria", { convocatoria: null as never, jugadores: [arquero], partidos: [vuelta] });
    expect(alta.error).not.toBeNull();
    expect(await leerConvocados(servicio, vuelta)).toBeNull();

    const existente = await convocarConServicio([arquero], [ida]);
    const correccion = await c.rpc("guardar_convocatoria", { convocatoria: existente, jugadores: [campo[1]!], partidos: [ida] });
    expect(correccion.error).not.toBeNull();
    const directo = await c.from("convocatoria_jugador").insert({ convocatoria_id: existente, jugador_id: campo[1]! });
    expect(directo.error).not.toBeNull();
    const sacado = await c.from("convocatoria_jugador").delete().eq("convocatoria_id", existente).select("jugador_id");
    expect(sacado.data ?? []).toEqual([]);
    const borrada = await c.from("convocatoria").delete().eq("id", existente).select("id");
    expect(borrada.data ?? []).toEqual([]);
    expect(await leerConvocados(servicio, ida)).toEqual([arquero]);

    await servicio.from("convocatoria").delete().eq("id", existente);
  });

  it.skipIf(!conDosFactores)("el Admin con 2FA la carga para una fecha doble y la corrige", async () => {
    const { data: id, error } = await admin!.cliente.rpc("guardar_convocatoria", {
      convocatoria: null as never,
      jugadores: [arquero, campo[0]!],
      partidos: [ida, vuelta],
    });
    expect(error).toBeNull();
    convocatorias.push(id!);
    expect(await leerConvocados(servicio, ida)).toEqual([arquero, campo[0]!].sort());
    expect(await leerConvocados(servicio, vuelta)).toEqual([arquero, campo[0]!].sort());

    // El DT reemplaza a uno, y la Convocatoria deja de aplicarse a la vuelta.
    const corregida = await admin!.cliente.rpc("guardar_convocatoria", {
      convocatoria: id!,
      jugadores: [arquero, campo[1]!],
      partidos: [ida],
    });
    expect(corregida.error).toBeNull();
    expect(corregida.data).toBe(id);
    expect(await leerConvocados(servicio, ida)).toEqual([arquero, campo[1]!].sort());
    expect(await leerConvocados(servicio, vuelta)).toBeNull();

    const borrada = await admin!.cliente.from("convocatoria").delete().eq("id", id!).select("id");
    expect(borrada.data).toEqual([{ id }]);
    expect(await leerConvocados(servicio, ida)).toBeNull();
  });

  it.skipIf(!conDosFactores)("un Partido no queda en dos Convocatorias (y la segunda no se guarda a medias)", async () => {
    await convocarConServicio([arquero], [ida]);
    const { error } = await admin!.cliente.rpc("guardar_convocatoria", {
      convocatoria: null as never,
      jugadores: [campo[2]!],
      partidos: [vuelta, ida],
    });
    expect(error?.code).toBe("23505");
    expect(await leerConvocados(servicio, ida)).toEqual([arquero]);
    expect(await leerConvocados(servicio, vuelta)).toBeNull();
    const { data } = await servicio.from("convocatoria_jugador").select("convocatoria_id").eq("jugador_id", campo[2]!);
    expect(data).toEqual([]);
  });

  it.skipIf(!conDosFactores)("solo convoca elegibles del Plantel de la Selección", async () => {
    const { error } = await admin!.cliente.rpc("guardar_convocatoria", {
      convocatoria: null as never,
      jugadores: [arquero, jugadorDelClub],
      partidos: [vuelta],
    });
    expect(error?.code).toBe("23514");
    expect(await leerConvocados(servicio, vuelta)).toBeNull();
  });

  it.skipIf(!conDosFactores)("solo se aplica a Partidos de la Selección", async () => {
    const { error } = await admin!.cliente.rpc("guardar_convocatoria", {
      convocatoria: null as never,
      jugadores: [arquero],
      partidos: [delClub],
    });
    expect(error?.code).toBe("23514");
    expect(await leerConvocados(servicio, delClub)).toBeNull();
  });
});

describe("Convocatoria y Votación", () => {
  beforeAll(async () => {
    // Convocados: el arquero y el primero de campo. Votan dos Hinchas.
    await convocarConServicio([arquero, campo[0]!], [abierto]);
    await guardarConServicio(usuario("hinchaNacional").id, abierto, {
      esquema: "4-3-3",
      esquemaModificadoEn: hace(HORA),
      puestos: { ARQ: puesto(arquero), LI: puesto(campo[0]!), LD: puesto(campo[3]!) },
    });
  });

  it("cargarla no cambia lo que se puede votar: un no convocado se sigue eligiendo", async () => {
    const { error } = await clienteComo("hinchaPenarol")
      .from("alineacion")
      .upsert(
        { partido_id: abierto, esquema: "4-3-3", esquema_elegido_a_mano: true, puestos: { ARQ: puesto(arquero), LD: puesto(campo[3]!) } },
        { onConflict: "hincha_id,partido_id" },
      );
    expect(error).toBeNull();
  });

  it("con Convocatoria, el Parcial muestra el Gran Ausente provisorio (el no convocado más elegido)", async () => {
    const parcial = await calcularParcialDeLaSeleccion(servicio, abierto);
    expect(parcial?.destacado).toEqual({
      tipo: "gran_ausente",
      jugadores: [{ jugadorId: campo[3]!, apariciones: 2, porcentaje: 100 }],
    });
  });

  it("sin Convocatoria, el Parcial sigue con el Más Pedido", async () => {
    await guardarConServicio(usuario("hinchaNacional").id, vuelta, {
      esquema: "4-3-3",
      esquemaModificadoEn: hace(HORA),
      puestos: { ARQ: puesto(arquero) },
    });
    const parcial = await calcularParcialDeLaSeleccion(servicio, vuelta);
    expect(parcial?.destacado?.tipo).toBe("mas_pedido");
  });
});

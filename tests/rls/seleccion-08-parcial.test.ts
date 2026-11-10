// Tests de RLS del ticket 08 del feature Selección: Parcial de la Selección
// con el Más Pedido.
//
// - El conteo de la Selección cuenta las Alineaciones de todos los Hinchas
//   (de los dos Clubes, sin Club, heredadas): un solo resultado.
// - El Más Pedido sale de las apariciones en esas mismas Alineaciones.
// - El resultado es solo agregado (sin ids de Hinchas ni de Alineaciones).
// - Cualquier Hincha ve el Parcial de la Selección con la Votación abierta;
//   nadie lo pide sin sesión, para un Partido que no es de la Selección, ni
//   con la Votación sin abrir.
// - Contar la Selección no hace que el cierre la procese (ticket 10).
//
// Crea Partidos de la Selección y Hinchas descartables (con la service role,
// sin login) que se borran al final.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SELECCION } from "@/domain/comun/tipos";
import { cerrarVotacion } from "@/lib/cierre/proceso";
import { parcialParaHincha } from "@/lib/parcial/acceso";
import { calcularParcialDeLaSeleccion } from "@/lib/parcial/seleccion";
import { contarPartido, leerAlineacionesDelPartido } from "@/lib/votacion/conteo";
import { creadorDePartidos, guardarConServicio, jugadoresDisponibles, partidoAbierto } from "./datos";
import { clienteAnonimo, clienteComo, clienteServicio, usuario } from "./helpers";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const PREFIJO_EMAIL = "seleccion08.";

const servicio = clienteServicio();
const creados: string[] = [];
const crearPartido = creadorDePartidos(creados);
const descartables: string[] = [];

const hace = (ms: number) => new Date(Date.now() - ms);
const dentroDe = (ms: number) => new Date(Date.now() + ms);
const puesto = (jugadorId: string) => ({ jugadorId, modificadoEn: new Date().toISOString() });
const upsert = { onConflict: "hincha_id,partido_id" };

const calcular = (partidoId: string) => calcularParcialDeLaSeleccion(servicio, partidoId);

let abierto = "";
let lejos = "";
let vencido = "";
let arquero = "";
let defensores: string[] = [];

async function crearHincha(club: "penarol" | "nacional" | null): Promise<string> {
  const { data, error } = await servicio.auth.admin.createUser({
    email: `${PREFIJO_EMAIL}${crypto.randomUUID()}@rls.test`,
    email_confirm: true,
  });
  if (error) throw error;
  descartables.push(data.user.id);
  if (club) {
    const { error: errorPerfil } = await servicio.from("perfil").update({ club_favorito_id: club }).eq("id", data.user.id);
    if (errorPerfil) throw errorPerfil;
  }
  return data.user.id;
}

beforeAll(async () => {
  abierto = await crearPartido(SELECCION, dentroDe(5 * DIA), { creadoEn: hace(30 * DIA) });
  lejos = await crearPartido(SELECCION, dentroDe(40 * DIA), { creadoEn: hace(30 * DIA) });
  vencido = await crearPartido(SELECCION, hace(3 * HORA), { creadoEn: hace(30 * DIA) });
  ({ arquero, defensores } = await jugadoresDisponibles(SELECCION));
  const [d0, d1, d2] = defensores as [string, string, string];

  // Los Hinchas estándar guardan con su propia sesión (RLS).
  for (const [hincha, puestos] of [
    ["hinchaPenarol", { ARQ: puesto(arquero), LI: puesto(d0) }],
    ["hinchaNacional", { ARQ: puesto(arquero), LD: puesto(d1) }],
  ] as const) {
    const { error } = await clienteComo(hincha)
      .from("alineacion")
      .upsert({ partido_id: abierto, esquema: "4-3-3", esquema_elegido_a_mano: true, puestos }, upsert);
    if (error) throw error;
  }
  // Un Hincha sin Club, una heredada (horas viejas, como las materializa la
  // Herencia) y una vacía (no cuenta), con la service role.
  await guardarConServicio(await crearHincha(null), abierto, {
    esquema: "4-3-3",
    esquemaModificadoEn: hace(DIA),
    puestos: { LI: puesto(d0), ZAG_I: puesto(d2) },
  });
  const viejo = hace(20 * DIA).toISOString();
  await guardarConServicio(await crearHincha("nacional"), abierto, {
    esquema: "4-3-3",
    esquemaModificadoEn: viejo,
    puestos: { ARQ: { jugadorId: arquero, modificadoEn: viejo } },
  });
  const { error } = await servicio.from("alineacion").insert({
    hincha_id: await crearHincha("penarol"),
    partido_id: abierto,
    esquema: "4-3-3",
    esquema_elegido_a_mano: false,
    puestos: {},
  });
  if (error) throw error;

  await guardarConServicio(usuario("hinchaPenarol").id, vencido, {
    esquema: "4-3-3",
    esquemaModificadoEn: hace(DIA),
    puestos: { ARQ: puesto(arquero) },
  });
}, 60_000);

afterAll(async () => {
  if (creados.length) await servicio.from("partido").delete().in("id", creados);
  for (const id of descartables) await servicio.auth.admin.deleteUser(id);
});

describe("conteo de la Selección", () => {
  it("cuenta las Alineaciones de todos: de los dos Clubes, sin Club y heredadas", async () => {
    expect(await leerAlineacionesDelPartido(servicio, abierto)).toHaveLength(5);
    const conteo = await contarPartido(servicio, abierto);
    expect(conteo?.club).toBe(SELECCION);
    if (!conteo || conteo.resultado.vacio) throw new Error("se esperaba un resultado con datos");
    expect(conteo.resultado.alineacionesQueCuentan).toBe(4);
    expect(conteo.resultado.once.find((a) => a.puesto === "ARQ")?.jugadorId).toBe(arquero);
  });

  it("las apariciones salen de las mismas Alineaciones (la vacía no suma)", async () => {
    const conteo = await contarPartido(servicio, abierto);
    expect(conteo?.apariciones.alineaciones).toBe(4);
    const porJugador = new Map(conteo!.apariciones.porJugador.map((a) => [a.jugadorId, a.apariciones]));
    expect(porJugador.get(arquero)).toBe(3);
    expect(porJugador.get(defensores[0]!)).toBe(2);
  });

  it("contar la Selección no hace que el cierre la procese (todavía)", async () => {
    expect(await cerrarVotacion(servicio, vencido, new Date())).toEqual({ partidoId: vencido, estado: null, creado: false });
    const { data } = await servicio.from("resultado_votacion").select("partido_id").eq("partido_id", vencido);
    expect(data).toEqual([]);
  });
});

describe("Parcial de la Selección", () => {
  it("el Más Pedido es el Jugador que figura en más Alineaciones, con apariciones y porcentaje", async () => {
    const parcial = await calcular(abierto);
    expect(parcial?.destacado).toEqual({
      tipo: "mas_pedido",
      jugadores: [{ jugadorId: arquero, apariciones: 3, porcentaje: 75 }],
    });
  });

  it("Hinchas de los dos Clubes ven el mismo Parcial (un solo resultado, sin separar por hinchada)", async () => {
    const penarol = await parcialParaHincha(clienteComo("hinchaPenarol"), SELECCION, abierto, calcular);
    const nacional = await parcialParaHincha(clienteComo("hinchaNacional"), SELECCION, abierto, calcular);
    expect(penarol.tipo).toBe("ok");
    expect(nacional).toEqual(penarol);
  });

  it("el resultado es solo agregado: nada que identifique a un Hincha o una Alineación", async () => {
    const r = await parcialParaHincha(clienteComo("hinchaPenarol"), SELECCION, abierto, calcular);
    if (r.tipo !== "ok") throw new Error("se esperaba el Parcial");
    expect(Object.keys(r.resultado).sort()).toEqual(["destacado", "resultado"]);
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/hincha|modificado|creado|actualizado/i);
    const { data: alineaciones } = await servicio.from("alineacion").select("id").eq("partido_id", abierto);
    for (const id of [...descartables, usuario("hinchaPenarol").id, usuario("hinchaNacional").id, ...alineaciones!.map((a) => a.id)]) {
      expect(json).not.toContain(id);
    }
  });

  it("sin la Votación abierta no hay Parcial", async () => {
    expect(await parcialParaHincha(clienteComo("hinchaNacional"), SELECCION, lejos, calcular)).toEqual({ tipo: "no_abierta" });
  });

  it("no se pide como Parcial de la Selección el de un Club, ni el de la Selección como el de un Club", async () => {
    let calculado = false;
    const espia = async (id: string) => {
      calculado = true;
      return calcular(id);
    };
    const delClub = await partidoAbierto("penarol");
    expect(await parcialParaHincha(clienteComo("hinchaPenarol"), SELECCION, delClub, espia)).toEqual({ tipo: "prohibido" });
    expect(await parcialParaHincha(clienteComo("hinchaPenarol"), "penarol", abierto, espia)).toEqual({ tipo: "prohibido" });
    expect(calculado).toBe(false);
    // Y el cálculo de la Selección no cuenta un Partido de un Club.
    expect(await calcular(delClub)).toBeNull();
  });

  it("sin sesión no hay Parcial de la Selección", async () => {
    expect(await parcialParaHincha(clienteAnonimo(), SELECCION, abierto, calcular)).toEqual({ tipo: "prohibido" });
  });
});

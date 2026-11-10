// Tests de RLS del ticket 05 del feature Selección: votar la Selección.
//
// - `votacion_de_partido` (SQL) replica la regla de la Selección del
//   Calendario de Votación (TS): abre 14 días antes del inicio (o al cargarse).
// - Los Hinchas de los dos Clubes leen los Partidos y el Plantel de la
//   Selección, y guardan su Alineación de la Selección, aparte de la de su
//   Club. Nadie lee la de otro.
// - No se escribe fuera de la ventana de 14 días ni con la Votación cerrada o
//   anulada; dos Votaciones abiertas a la vez (fecha doble) aceptan Alineaciones.
//
// Los Partidos de prueba se crean con la service role y se borran al final.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calcularVotaciones } from "@/domain/calendario";
import { SELECCION } from "@/domain/comun/tipos";
import { leerPartidos } from "@/lib/club/lecturas";
import { creadorDePartidos, jugadoresDisponibles, partidoAbierto } from "./datos";
import { clienteComo, clienteServicio, usuario } from "./helpers";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

const creados: string[] = [];
const crearPartido = creadorDePartidos(creados);
const servicio = clienteServicio();

const hace = (ms: number) => new Date(Date.now() - ms);
const dentroDe = (ms: number) => new Date(Date.now() + ms);
const puesto = (jugadorId: string) => ({ jugadorId, modificadoEn: new Date().toISOString() });
const alineacion = (partidoId: string, puestos: Record<string, { jugadorId: string; modificadoEn: string }>) => ({
  partido_id: partidoId,
  esquema: "4-3-3",
  esquema_elegido_a_mano: true,
  puestos,
});
const upsert = { onConflict: "hincha_id,partido_id" };
const HINCHAS = ["hinchaPenarol", "hinchaNacional"] as const;

async function borrarAlineacionesDePrueba() {
  await servicio
    .from("alineacion")
    .delete()
    .in("hincha_id", HINCHAS.map((h) => usuario(h).id));
}

afterAll(async () => {
  await borrarAlineacionesDePrueba();
  if (creados.length) await servicio.from("partido").delete().in("id", creados);
});

describe("votacion_de_partido (SQL) replica la regla de la Selección (TS)", () => {
  const T = Date.UTC(2032, 8, 1);
  const en = (ms: number) => new Date(T + ms);
  const escenario: string[] = [];

  beforeAll(async () => {
    escenario.push(
      // Fecha doble cargada con tiempo: las dos abren 14 días antes.
      await crearPartido(SELECCION, en(0), { creadoEn: en(-60 * DIA) }),
      await crearPartido(SELECCION, en(5 * DIA), { creadoEn: en(-60 * DIA) }),
      // Cargado a menos de 14 días: abre al cargarse.
      await crearPartido(SELECCION, en(40 * DIA), { creadoEn: en(35 * DIA) }),
      // Cancelado.
      await crearPartido(SELECCION, en(50 * DIA), { creadoEn: en(-60 * DIA), estado: "cancelado" }),
      // Ventana vacía: cargado media hora antes del inicio.
      await crearPartido(SELECCION, en(70 * DIA), { creadoEn: en(70 * DIA - HORA / 2) }),
    );
  });

  async function comparar() {
    const partidos = (await leerPartidos(servicio, SELECCION)).filter((p) => escenario.includes(p.id));
    const horas = calcularVotaciones(partidos, new Date(T), SELECCION)
      .flatMap((v) => [v.abre, v.cierra].flatMap((h) => [h.getTime() - 1, h.getTime()]))
      .concat([T - 90 * DIA, T + 365 * DIA]);
    let comparaciones = 0;
    for (const t of horas) {
      const ahora = new Date(t);
      for (const v of calcularVotaciones(partidos, ahora, SELECCION)) {
        const { data, error } = await servicio
          .rpc("votacion_de_partido", { partido: v.partidoId, ahora: ahora.toISOString() })
          .single();
        expect(error).toBeNull();
        expect(
          { estado: data!.estado, abre: new Date(data!.abre).getTime(), cierra: new Date(data!.cierra).getTime() },
          `${v.partidoId} a las ${ahora.toISOString()}`,
        ).toEqual({ estado: v.estado, abre: v.abre.getTime(), cierra: v.cierra.getTime() });
        const { data: abierta } = await servicio.rpc("votacion_abierta", { partido: v.partidoId, ahora: ahora.toISOString() });
        expect(abierta).toBe(v.estado === "abierta");
        comparaciones++;
      }
    }
    expect(comparaciones).toBeGreaterThan(50);
  }

  it("coinciden en todos los bordes (14 días, cargado tarde, cancelado, ventana vacía)", comparar);

  it("en la fecha doble las dos Votaciones están abiertas a la vez", async () => {
    const ahora = en(-2 * DIA).toISOString();
    for (const id of escenario.slice(0, 2)) {
      const { data } = await servicio.rpc("votacion_abierta", { partido: id, ahora });
      expect(data).toBe(true);
    }
  });

  it("siguen coincidiendo después de postergar y de cancelar", async () => {
    await servicio.from("partido").update({ inicio: en(9 * DIA).toISOString() }).eq("id", escenario[1]);
    await servicio.from("partido").update({ estado: "cancelado" }).eq("id", escenario[0]);
    await servicio.from("partido").update({ estado: "programado" }).eq("id", escenario[3]);
    await comparar();
  });
});

describe("lecturas de la Selección", () => {
  it.each(HINCHAS)("%s lee el Plantel y los Partidos de la Selección, además de los de su Club", async (hincha) => {
    const cliente = clienteComo(hincha);
    const { data: jugadores } = await cliente.from("jugador").select("id").eq("club_id", SELECCION);
    const { data: partidos } = await cliente.from("partido").select("id").eq("club_id", SELECCION);
    expect(jugadores!.length).toBeGreaterThan(0);
    expect(partidos!.length).toBeGreaterThan(0);
  });

  it("los Rivales dados de baja de un Partido de la Selección se leen", async () => {
    const { data: rival } = await servicio
      .from("rival")
      .insert({ nombre: `Selección de baja ${crypto.randomUUID()}`, activo: false })
      .select("id")
      .single();
    try {
      const { data: p } = await servicio
        .from("partido")
        .insert({ club_id: SELECCION, rival_id: rival!.id, inicio: new Date(Date.UTC(2033, 0, 1)).toISOString() })
        .select("id")
        .single();
      creados.push(p!.id);
      const { data } = await clienteComo("hinchaNacional").from("rival").select("id").eq("id", rival!.id);
      expect(data).toHaveLength(1);
    } finally {
      await servicio.from("partido").delete().eq("rival_id", rival!.id);
      await servicio.from("rival").delete().eq("id", rival!.id);
    }
  });
});

describe("Alineaciones de la Selección", () => {
  let ida = "";
  let vuelta = "";
  let lejos = "";
  let cerrada = "";
  let anulada = "";
  let arquero = "";
  let defensores: string[] = [];
  let arqueroDelClub = "";

  beforeAll(async () => {
    await borrarAlineacionesDePrueba();
    // Fecha doble con las dos Votaciones abiertas.
    ida = await crearPartido(SELECCION, dentroDe(3 * DIA), { creadoEn: hace(30 * DIA) });
    vuelta = await crearPartido(SELECCION, dentroDe(8 * DIA), { creadoEn: hace(30 * DIA) });
    // A más de 14 días: la Votación todavía no abrió.
    lejos = await crearPartido(SELECCION, dentroDe(20 * DIA), { creadoEn: hace(30 * DIA) });
    // Empieza en 30 minutos: ya cerró.
    cerrada = await crearPartido(SELECCION, dentroDe(HORA / 2), { creadoEn: hace(30 * DIA) });
    anulada = await crearPartido(SELECCION, dentroDe(4 * DIA), { creadoEn: hace(30 * DIA), estado: "cancelado" });
    ({ arquero, defensores } = await jugadoresDisponibles(SELECCION));
    arqueroDelClub = (await jugadoresDisponibles("penarol")).arquero;
  });

  it("Hinchas de los dos Clubes guardan su Alineación de la Selección", async () => {
    for (const [i, hincha] of HINCHAS.entries()) {
      const { error } = await clienteComo(hincha)
        .from("alineacion")
        .upsert(alineacion(ida, { ARQ: puesto(arquero), LI: puesto(defensores[i]!) }), upsert);
      expect(error, hincha).toBeNull();
    }
  });

  it("cada uno lee solo la suya", async () => {
    for (const [i, hincha] of HINCHAS.entries()) {
      const { data } = await clienteComo(hincha).from("alineacion").select("hincha_id, puestos").eq("partido_id", ida);
      expect(data).toHaveLength(1);
      expect(data![0].hincha_id).toBe(usuario(hincha).id);
      expect((data![0].puestos as Record<string, { jugadorId: string }>).LI.jugadorId).toBe(defensores[i]);
    }
    const { data: modificadas } = await clienteComo("hinchaNacional")
      .from("alineacion")
      .update({ puestos: {} })
      .eq("hincha_id", usuario("hinchaPenarol").id)
      .select();
    expect(modificadas ?? []).toEqual([]);
  });

  it("es independiente de la Alineación del Club", async () => {
    const abiertaDelClub = await partidoAbierto("penarol");
    const penarol = clienteComo("hinchaPenarol");
    const { error } = await penarol.from("alineacion").upsert(alineacion(abiertaDelClub, { ARQ: puesto(arqueroDelClub) }), upsert);
    expect(error).toBeNull();
    const { data } = await penarol.from("alineacion").select("partido_id").in("partido_id", [ida, abiertaDelClub]);
    expect(data!.map((a) => a.partido_id).sort()).toEqual([ida, abiertaDelClub].sort());
  });

  it("en una fecha doble acepta Alineaciones en las dos Votaciones abiertas, por separado", async () => {
    const penarol = clienteComo("hinchaPenarol");
    const { error } = await penarol.from("alineacion").upsert(alineacion(vuelta, { ARQ: puesto(arquero) }), upsert);
    expect(error).toBeNull();
    const { data } = await penarol.from("alineacion").select("partido_id, puestos").in("partido_id", [ida, vuelta]);
    const porPartido = new Map(data!.map((a) => [a.partido_id, Object.keys(a.puestos as object).sort()]));
    expect(porPartido.get(ida)).toEqual(["ARQ", "LI"]);
    expect(porPartido.get(vuelta)).toEqual(["ARQ"]);
  });

  it("no acepta Jugadores de un Club en una Alineación de la Selección", async () => {
    const { error } = await clienteComo("hinchaPenarol")
      .from("alineacion")
      .upsert(alineacion(vuelta, { ARQ: puesto(arqueroDelClub) }), upsert);
    expect(error).not.toBeNull();
  });

  for (const [estado, partido] of [
    ["pendiente", () => lejos],
    ["cerrada", () => cerrada],
    ["anulada", () => anulada],
  ] as const) {
    it(`no se escribe con la Votación ${estado}`, async () => {
      const { data: v } = await servicio.rpc("votacion_de_partido", { partido: partido() }).single();
      expect(v!.estado).toBe(estado);
      const { error } = await clienteComo("hinchaNacional").from("alineacion").insert(alineacion(partido(), { ARQ: puesto(arquero) }));
      expect(error).not.toBeNull();
    });
  }

  it("con la Votación cerrada no se modifica la guardada", async () => {
    await servicio.from("alineacion").insert({ hincha_id: usuario("hinchaNacional").id, ...alineacion(cerrada, { ARQ: puesto(arquero) }) });
    const { data } = await clienteComo("hinchaNacional").from("alineacion").update({ puestos: {} }).eq("partido_id", cerrada).select();
    expect(data ?? []).toEqual([]);
  });
});

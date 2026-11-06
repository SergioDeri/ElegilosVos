// Tests del ticket 09: Alineación (RLS), lecturas del Hincha y la regla del
// Calendario de Votación replicada en SQL.
//
// Los Partidos de prueba se crean con la service role con horarios relativos a
// now() (o en años lejanos, para no cambiar qué Votación está abierta hoy) y
// se borran al final.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calcularVotaciones } from "@/domain/calendario";
import { ESQUEMA_IDS, esquema } from "@/domain/esquemas";
import { leerPartidos } from "@/lib/club/lecturas";
import { creadorDePartidos, jugadoresDisponibles, partidoAbierto } from "./datos";
import { clienteAnonimo, clienteComo, clienteServicio, usuario } from "./helpers";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

const creados: string[] = [];

// Cada llamada indica su `creado_en` (el Calendario desempata por él).
const crearPartido = creadorDePartidos(creados);

/** Un arquero y dos defensores Disponibles del Club. */
async function jugadoresDePrueba(club: "penarol" | "nacional") {
  const { arquero, defensores } = await jugadoresDisponibles(club);
  return { arquero, def1: defensores[0]!, def2: defensores[1]! };
}

const hace = (ms: number) => new Date(Date.now() - ms);
const dentroDe = (ms: number) => new Date(Date.now() + ms);
const puesto = (jugadorId: string, modificadoEn = new Date().toISOString()) => ({ jugadorId, modificadoEn });

async function borrarAlineacionesDePrueba() {
  await clienteServicio()
    .from("alineacion")
    .delete()
    .in("hincha_id", [usuario("hinchaPenarol").id, usuario("hinchaNacional").id]);
}

afterAll(async () => {
  await borrarAlineacionesDePrueba();
  if (creados.length) await clienteServicio().from("partido").delete().in("id", creados);
});

describe("votacion_de_partido (SQL) replica el Calendario de Votación (TS)", () => {
  const T = Date.UTC(2031, 2, 1);
  const en = (ms: number) => new Date(T + ms);
  const escenario: string[] = [];

  beforeAll(async () => {
    escenario.push(
      await crearPartido("penarol", en(0), { creadoEn: en(-10 * DIA) }),
      await crearPartido("penarol", en(2 * DIA), { creadoEn: en(-10 * DIA), estado: "cancelado" }),
      await crearPartido("penarol", en(4 * DIA), { creadoEn: en(-10 * DIA) }),
      // Ventana vacía: empieza 2 h después del anterior.
      await crearPartido("penarol", en(4 * DIA + 2 * HORA), { creadoEn: en(-10 * DIA) }),
      // Mismo inicio: desempata creado_en.
      await crearPartido("penarol", en(10 * DIA), { creadoEn: en(-5 * DIA) }),
      await crearPartido("penarol", en(10 * DIA), { creadoEn: en(-6 * DIA) }),
      // Cargado después de que terminó el anterior.
      await crearPartido("penarol", en(30 * DIA), { creadoEn: en(25 * DIA) }),
    );
    // Mismo inicio y mismo creado_en: desempata el id.
    escenario.push(
      await crearPartido("penarol", en(40 * DIA), { creadoEn: en(35 * DIA) }),
      await crearPartido("penarol", en(40 * DIA), { creadoEn: en(35 * DIA) }),
    );
  });

  async function comparar() {
    const partidos = await leerPartidos(clienteServicio(), "penarol");
    const horas = calcularVotaciones(partidos, new Date(T))
      .filter((v) => escenario.includes(v.partidoId))
      .flatMap((v) => [v.abre, v.cierra].flatMap((h) => [h.getTime() - 1, h.getTime()]))
      .concat([T - 30 * DIA, T + 365 * DIA]);
    let comparaciones = 0;
    for (const t of horas) {
      const ahora = new Date(t);
      const esperado = calcularVotaciones(partidos, ahora).filter((v) => escenario.includes(v.partidoId));
      for (const v of esperado) {
        const { data, error } = await clienteServicio()
          .rpc("votacion_de_partido", { partido: v.partidoId, ahora: ahora.toISOString() })
          .single();
        expect(error).toBeNull();
        expect(
          { estado: data!.estado, abre: new Date(data!.abre).getTime(), cierra: new Date(data!.cierra).getTime() },
          `${v.partidoId} a las ${ahora.toISOString()}`,
        ).toEqual({ estado: v.estado, abre: v.abre.getTime(), cierra: v.cierra.getTime() });
        const { data: abierta } = await clienteServicio().rpc("votacion_abierta", {
          partido: v.partidoId,
          ahora: ahora.toISOString(),
        });
        expect(abierta).toBe(v.estado === "abierta");
        comparaciones++;
      }
    }
    expect(comparaciones).toBeGreaterThan(100);
  }

  it("coinciden en todos los bordes (apertura, cierre, cancelación, ventana vacía, desempates)", comparar);

  it("siguen coincidiendo después de postergar y de cancelar", async () => {
    const servicio = clienteServicio();
    await servicio.from("partido").update({ inicio: en(5 * DIA).toISOString() }).eq("id", escenario[2]);
    await servicio.from("partido").update({ estado: "cancelado" }).eq("id", escenario[0]);
    await servicio.from("partido").update({ estado: "programado" }).eq("id", escenario[1]);
    await comparar();
  });

  it("votacion_abierta de un Partido inexistente es false", async () => {
    const { data } = await clienteServicio().rpc("votacion_abierta", { partido: crypto.randomUUID() });
    expect(data).toBe(false);
  });

  it("anon no puede llamar a las funciones de Votación", async () => {
    const { error } = await clienteAnonimo().rpc("votacion_abierta", { partido: escenario[0] });
    expect(error).not.toBeNull();
  });
});

describe("puestos_de_esquema (SQL) coincide con el Catálogo de Esquemas (TS)", () => {
  for (const id of ESQUEMA_IDS) {
    it(id, async () => {
      const { data } = await clienteServicio().rpc("puestos_de_esquema", { esquema: id });
      expect(data).toEqual(esquema(id).puestos.map((p) => p.id));
    });
  }
});

describe("lecturas del Hincha", () => {
  it("lee los Jugadores y los Partidos de su Club, y no los del otro", async () => {
    const penarol = clienteComo("hinchaPenarol");
    const { data: jugadores } = await penarol.from("jugador").select("club_id");
    const { data: partidos } = await penarol.from("partido").select("club_id");
    expect(jugadores!.length).toBeGreaterThan(0);
    expect(partidos!.length).toBeGreaterThan(0);
    expect(new Set(jugadores!.map((j) => j.club_id))).toEqual(new Set(["penarol"]));
    expect(new Set(partidos!.map((p) => p.club_id))).toEqual(new Set(["penarol"]));
  });

  it("lee los Rivales activos y no los dados de baja sin Partidos de su Club", async () => {
    const servicio = clienteServicio();
    const nombre = `Rival de baja ${crypto.randomUUID()}`;
    const { data: deBaja } = await servicio.from("rival").insert({ nombre, activo: false }).select("id").single();
    try {
      const { data } = await clienteComo("hinchaPenarol").from("rival").select("id, activo");
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((r) => r.activo)).toBe(true);
      // Si un Partido de su Club lo referencia, lo ve.
      const { data: p } = await servicio
        .from("partido")
        .insert({ club_id: "penarol", rival_id: deBaja!.id, inicio: new Date(Date.UTC(2033, 0, 1)).toISOString() })
        .select("id")
        .single();
      creados.push(p!.id);
      const { data: visto } = await clienteComo("hinchaPenarol").from("rival").select("id").eq("id", deBaja!.id);
      expect(visto).toHaveLength(1);
      const { data: noVisto } = await clienteComo("hinchaNacional").from("rival").select("id").eq("id", deBaja!.id);
      expect(noVisto).toEqual([]);
    } finally {
      await servicio.from("partido").delete().eq("rival_id", deBaja!.id);
      await servicio.from("rival").delete().eq("id", deBaja!.id);
    }
  });

  it("anon no lee Alineaciones", async () => {
    const { data } = await clienteAnonimo().from("alineacion").select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("alineacion: políticas", () => {
  let abiertaPenarol: string;
  let abiertaNacional: string;
  let jp: Awaited<ReturnType<typeof jugadoresDePrueba>>;
  let jn: Awaited<ReturnType<typeof jugadoresDePrueba>>;
  let pendiente: string;
  let cerrada: string;
  let anulada: string;

  beforeAll(async () => {
    await borrarAlineacionesDePrueba();
    abiertaPenarol = await partidoAbierto("penarol");
    abiertaNacional = await partidoAbierto("nacional");
    jp = await jugadoresDePrueba("penarol");
    jn = await jugadoresDePrueba("nacional");
    // Cerrada: un Partido que ya se jugó (antes que todos los del seed).
    cerrada = await crearPartido("penarol", hace(60 * DIA), { creadoEn: hace(70 * DIA) });
    // Pendiente: lejos en el futuro y cargado "mañana" (abre después de ahora).
    pendiente = await crearPartido("penarol", new Date(Date.UTC(2032, 0, 1)), { creadoEn: dentroDe(DIA) });
    anulada = await crearPartido("penarol", new Date(Date.UTC(2032, 5, 1)), { creadoEn: hace(DIA), estado: "cancelado" });
  });

  const alineacion = (partidoId: string, puestos: Record<string, { jugadorId: string; modificadoEn: string }>) => ({
    partido_id: partidoId,
    esquema: "4-3-3",
    esquema_elegido_a_mano: true,
    puestos,
  });

  it("el Hincha guarda (upsert) y lee la suya con la Votación abierta", async () => {
    const penarol = clienteComo("hinchaPenarol");
    const { error } = await penarol
      .from("alineacion")
      .upsert(alineacion(abiertaPenarol, { ARQ: puesto(jp.arquero) }), { onConflict: "hincha_id,partido_id" });
    expect(error).toBeNull();
    const { error: error2 } = await penarol
      .from("alineacion")
      .upsert(alineacion(abiertaPenarol, { ARQ: puesto(jp.arquero), LI: puesto(jp.def1) }), { onConflict: "hincha_id,partido_id" });
    expect(error2).toBeNull();
    const { data } = await penarol.from("alineacion").select("hincha_id, partido_id, puestos");
    expect(data).toHaveLength(1);
    expect(data![0].hincha_id).toBe(usuario("hinchaPenarol").id);
    expect(Object.keys(data![0].puestos as object).sort()).toEqual(["ARQ", "LI"]);
  });

  it("las horas las pone el servidor: no se pueden antedatar y se conservan si el Puesto no cambia", async () => {
    const penarol = clienteComo("hinchaPenarol");
    const antedatada = "2000-01-01T00:00:00.000Z";
    await penarol
      .from("alineacion")
      .upsert(alineacion(abiertaPenarol, { ARQ: puesto(jp.arquero, antedatada), LD: puesto(jp.def2, antedatada) }), {
        onConflict: "hincha_id,partido_id",
      });
    const { data } = await penarol.from("alineacion").select("puestos, esquema_modificado_en").single();
    const puestos = data!.puestos as Record<string, { modificadoEn: string }>;
    // ARQ ya estaba con el mismo Jugador: conserva la hora del primer guardado.
    expect(new Date(puestos.ARQ.modificadoEn).getTime()).toBeGreaterThan(Date.now() - 5 * 60 * 1000);
    expect(new Date(puestos.LD.modificadoEn).getTime()).toBeGreaterThan(Date.now() - 5 * 60 * 1000);
    expect(new Date(data!.esquema_modificado_en!).getTime()).toBeGreaterThan(Date.now() - 5 * 60 * 1000);

    const arqAntes = puestos.ARQ.modificadoEn;
    await new Promise((r) => setTimeout(r, 20));
    await penarol
      .from("alineacion")
      .upsert(alineacion(abiertaPenarol, { ARQ: puesto(jp.arquero), LD: puesto(jp.def2) }), { onConflict: "hincha_id,partido_id" });
    const { data: despues } = await penarol.from("alineacion").select("puestos").single();
    expect((despues!.puestos as Record<string, { modificadoEn: string }>).ARQ.modificadoEn).toBe(arqAntes);
  });

  it("otro Hincha no lee ni modifica la Alineación ajena", async () => {
    const nacional = clienteComo("hinchaNacional");
    const { data } = await nacional.from("alineacion").select("id").eq("hincha_id", usuario("hinchaPenarol").id);
    expect(data).toEqual([]);
    const { data: modificadas } = await nacional
      .from("alineacion")
      .update({ puestos: {} })
      .eq("hincha_id", usuario("hinchaPenarol").id)
      .select();
    expect(modificadas ?? []).toEqual([]);
    const { data: intacta } = await clienteServicio()
      .from("alineacion")
      .select("puestos")
      .eq("hincha_id", usuario("hinchaPenarol").id)
      .single();
    expect(Object.keys(intacta!.puestos as object).length).toBeGreaterThan(0);
  });

  it("no se puede escribir a nombre de otro Hincha", async () => {
    const { error } = await clienteComo("hinchaNacional")
      .from("alineacion")
      .insert({ ...alineacion(abiertaPenarol, {}), hincha_id: usuario("hinchaPenarol").id } as never);
    expect(error).not.toBeNull();
    const { error: error2 } = await clienteComo("hinchaNacional")
      .from("alineacion")
      .insert({ ...alineacion(abiertaNacional, {}), hincha_id: usuario("hinchaPenarol").id } as never);
    expect(error2).not.toBeNull();
  });

  it("no se puede escribir para un Partido del otro Club", async () => {
    const { error } = await clienteComo("hinchaPenarol")
      .from("alineacion")
      .insert(alineacion(abiertaNacional, { ARQ: puesto(jn.arquero) }));
    expect(error).not.toBeNull();
    const { error: error2 } = await clienteComo("hinchaPenarol").from("alineacion").insert(alineacion(abiertaNacional, {}));
    expect(error2).not.toBeNull();
  });

  it("no se puede colocar Jugadores del otro Club", async () => {
    const { error } = await clienteComo("hinchaPenarol")
      .from("alineacion")
      .upsert(alineacion(abiertaPenarol, { ARQ: puesto(jn.arquero) }), { onConflict: "hincha_id,partido_id" });
    expect(error).not.toBeNull();
  });

  it("la base rechaza un jsonb con forma inválida", async () => {
    const penarol = clienteComo("hinchaPenarol");
    const casos = [
      { ...alineacion(abiertaPenarol, { DEL_I: puesto(jp.def1) }) }, // Puesto que no es del 4-3-3
      { ...alineacion(abiertaPenarol, { LI: puesto(jp.def1), LD: puesto(jp.def1) }) }, // Jugador repetido
      { ...alineacion(abiertaPenarol, { LI: { jugadorId: "x", modificadoEn: "ayer" } }) },
      { ...alineacion(abiertaPenarol, {}), esquema: "9-9-9" },
      { ...alineacion(abiertaPenarol, {}), puestos: [] },
    ];
    for (const caso of casos) {
      const { error } = await penarol.from("alineacion").upsert(caso as never, { onConflict: "hincha_id,partido_id" });
      expect(error, JSON.stringify(caso)).not.toBeNull();
    }
  });

  for (const [estado, partido] of [
    ["pendiente", () => pendiente],
    ["cerrada", () => cerrada],
    ["anulada", () => anulada],
  ] as const) {
    it(`no se puede escribir con la Votación ${estado}`, async () => {
      const { data: v } = await clienteServicio().rpc("votacion_de_partido", { partido: partido() }).single();
      expect(v!.estado).toBe(estado);
      const { error } = await clienteComo("hinchaPenarol")
        .from("alineacion")
        .insert(alineacion(partido(), { ARQ: puesto(jp.arquero) }));
      expect(error).not.toBeNull();
    });
  }

  it("con la Votación cerrada no se puede modificar la guardada, pero se puede leer", async () => {
    const servicio = clienteServicio();
    const { error } = await servicio.from("alineacion").insert({
      hincha_id: usuario("hinchaPenarol").id,
      ...alineacion(cerrada, { ARQ: puesto(jp.arquero) }),
    });
    expect(error).toBeNull();
    const penarol = clienteComo("hinchaPenarol");
    const { data: modificadas } = await penarol.from("alineacion").update({ puestos: {} }).eq("partido_id", cerrada).select();
    expect(modificadas ?? []).toEqual([]);
    const { data: leida } = await penarol.from("alineacion").select("puestos").eq("partido_id", cerrada).single();
    expect(Object.keys(leida!.puestos as object)).toEqual(["ARQ"]);
  });

  it("no se puede mover una Alineación a otro Partido (cerrado)", async () => {
    const { data } = await clienteComo("hinchaPenarol")
      .from("alineacion")
      .update({ partido_id: pendiente })
      .eq("partido_id", abiertaPenarol)
      .select();
    expect(data ?? []).toEqual([]);
  });

  it("el Hincha no puede borrar su Alineación", async () => {
    const penarol = clienteComo("hinchaPenarol");
    await penarol.from("alineacion").delete().eq("partido_id", abiertaPenarol);
    const { data } = await clienteServicio()
      .from("alineacion")
      .select("id")
      .eq("hincha_id", usuario("hinchaPenarol").id)
      .eq("partido_id", abiertaPenarol);
    expect(data).toHaveLength(1);
  });
});

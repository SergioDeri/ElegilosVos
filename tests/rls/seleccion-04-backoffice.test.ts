// Tests de RLS del ticket 04 del feature Selección: el Admin con 2FA mantiene
// el Plantel de la Selección (sin número, con Disponibilidad registrada como
// en los Clubes) y carga, posterga y cancela Partidos de la Selección contra
// Rivales del catálogo que no son un Club. Nadie más los escribe, y los
// Hinchas todavía no ven nada de la Selección (ticket 05).
//
// Además: un Partido de la Selección no rompe los procesos de los Clubes
// (cierre, conteo, herencia). El cierre todavía no procesa la Selección
// (ticket 10): sus Partidos vencidos quedan sin resultado.
//
// El escenario de los procesos vive en 2002, antes de todo Partido del seed.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cerrarVotacion, cerrarVotacionesVencidas } from "@/lib/cierre/proceso";
import { materializarHerencias } from "@/lib/herencia/materializar";
import { contarPartido, leerAlineacionesDelPartido } from "@/lib/votacion/conteo";
import { borrarUsuario, clienteComo, clienteServicio, crearAdminConDosFactores, type Cliente } from "./helpers";

vi.mock("server-only", () => ({}));

const admin = await crearAdminConDosFactores();
if (!admin) console.warn("[seleccion-04] TOTP apagado en Supabase local: se saltean los tests de Admin con 2FA.");
const conDosFactores = admin !== null;

const sinPermisos: [string, () => Cliente][] = [
  ["un Hincha", () => clienteComo("hinchaPenarol")],
  ["un Admin sin 2FA (AAL1)", () => clienteComo("admin")],
];

const servicio = clienteServicio();
const jugadores: string[] = [];
const partidos: string[] = [];
const rivales: string[] = [];
const LEJOS = new Date(Date.UTC(2034, 5, 10, 23)).toISOString();

let rivalSeleccion = "";
let jugadorSeleccion = "";
let partidoSeleccion = "";

async function crearJugadorConServicio(club: string, numero: number | null, nombre = "Elegible de prueba") {
  const { data, error } = await servicio
    .from("jugador")
    .insert({ club_id: club, nombre, numero, posicion_natural: "MED" })
    .select("id")
    .single();
  if (error) throw error;
  jugadores.push(data.id);
  return data.id;
}

async function crearPartidoConServicio(inicio: string, extra: { estado?: "programado" | "cancelado"; creado_en?: string } = {}) {
  const { data, error } = await servicio
    .from("partido")
    .insert({ club_id: "seleccion", rival_id: rivalSeleccion, inicio, ...extra })
    .select("id")
    .single();
  if (error) throw error;
  partidos.push(data.id);
  return data.id;
}

async function rivalDelClub(club: "penarol" | "nacional") {
  const { data, error } = await servicio.from("rival").select("id").eq("club_id", club).single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  const rival = await servicio
    .from("rival")
    .insert({ nombre: `Selección rival ${crypto.randomUUID()}` })
    .select("id")
    .single();
  if (rival.error) throw rival.error;
  rivalSeleccion = rival.data.id;
  rivales.push(rivalSeleccion);
  jugadorSeleccion = await crearJugadorConServicio("seleccion", null);
  partidoSeleccion = await crearPartidoConServicio(LEJOS);
});

afterAll(async () => {
  if (partidos.length) await servicio.from("partido").delete().in("id", partidos);
  if (jugadores.length) await servicio.from("jugador").delete().in("id", jugadores);
  if (rivales.length) await servicio.from("rival").delete().in("id", rivales);
  if (admin) await borrarUsuario(admin.id);
});

describe("Plantel de la Selección", () => {
  it.skipIf(!conDosFactores)("el Admin con 2FA da de alta un elegible sin número", async () => {
    const { data, error } = await admin!.cliente
      .from("jugador")
      .insert({ club_id: "seleccion", nombre: "Federico Valverde", numero: null, posicion_natural: "MED" })
      .select("id, numero")
      .single();
    expect(error).toBeNull();
    jugadores.push(data!.id);
    expect(data!.numero).toBeNull();
  });

  it.skipIf(!conDosFactores)("el Admin con 2FA no puede ponerle número a un elegible", async () => {
    const { error } = await admin!.cliente
      .from("jugador")
      .insert({ club_id: "seleccion", nombre: "Con número", numero: 15, posicion_natural: "MED" });
    expect(error).not.toBeNull();
    const editado = await admin!.cliente.from("jugador").update({ numero: 15 }).eq("id", jugadorSeleccion).select("id");
    expect(editado.error).not.toBeNull();
  });

  it.skipIf(!conDosFactores)("el Admin con 2FA lee, edita y da de baja (lógica) a un elegible", async () => {
    const leidos = await admin!.cliente.from("jugador").select("id").eq("club_id", "seleccion").eq("id", jugadorSeleccion);
    expect(leidos.data).toHaveLength(1);

    const editado = await admin!.cliente
      .from("jugador")
      .update({ nombre: "Elegible renombrado", posicion_natural: "DEL" })
      .eq("id", jugadorSeleccion)
      .select("nombre, posicion_natural");
    expect(editado.data).toEqual([{ nombre: "Elegible renombrado", posicion_natural: "DEL" }]);

    const baja = await admin!.cliente.from("jugador").update({ en_plantel: false }).eq("id", jugadorSeleccion).select("en_plantel");
    expect(baja.data).toEqual([{ en_plantel: false }]);
    await admin!.cliente.from("jugador").update({ en_plantel: true }).eq("id", jugadorSeleccion);

    // La baja es lógica: nadie borra Jugadores por la API.
    const borrado = await admin!.cliente.from("jugador").delete().eq("id", jugadorSeleccion).select("id");
    expect(borrado.data ?? []).toEqual([]);
  });

  it.skipIf(!conDosFactores)(
    "los cambios de Disponibilidad de un elegible quedan registrados, aparte de los de su Club",
    async () => {
      // El mismo futbolista, cargado en su Club y en la Selección: dos entradas.
      const enElClub = await crearJugadorConServicio("penarol", 77, "Futbolista en los dos");
      const enLaSeleccion = await crearJugadorConServicio("seleccion", null, "Futbolista en los dos");

      const { error } = await admin!.cliente
        .from("jugador")
        .update({ disponibilidad: "lesionado", motivo_disponibilidad: "Desgarro" })
        .eq("id", enLaSeleccion);
      expect(error).toBeNull();

      const { data: eventos } = await servicio
        .from("evento_disponibilidad")
        .select("jugador_id, club_id, disponibilidad_anterior, disponibilidad_nueva, motivo")
        .in("jugador_id", [enElClub, enLaSeleccion]);
      expect(eventos).toEqual([
        {
          jugador_id: enLaSeleccion,
          club_id: "seleccion",
          disponibilidad_anterior: "disponible",
          disponibilidad_nueva: "lesionado",
          motivo: "Desgarro",
        },
      ]);

      // La lesión en la Selección no saca al Jugador de su Club.
      const { data: club } = await servicio.from("jugador").select("disponibilidad").eq("id", enElClub).single();
      expect(club!.disponibilidad).toBe("disponible");
    },
  );

  it.each(sinPermisos)("%s no escribe el Plantel de la Selección", async (_, cliente) => {
    const alta = await cliente()
      .from("jugador")
      .insert({ club_id: "seleccion", nombre: "Intruso", numero: null, posicion_natural: "DEL" });
    expect(alta.error).not.toBeNull();

    const edicion = await cliente()
      .from("jugador")
      .update({ disponibilidad: "suspendido" })
      .eq("id", jugadorSeleccion)
      .select("id");
    expect(edicion.data ?? []).toEqual([]);
    const { data } = await servicio.from("jugador").select("disponibilidad").eq("id", jugadorSeleccion).single();
    expect(data!.disponibilidad).toBe("disponible");
  });

  it("los Hinchas todavía no ven el Plantel de la Selección", async () => {
    const { data } = await clienteComo("hinchaPenarol").from("jugador").select("id").eq("club_id", "seleccion");
    expect(data).toEqual([]);
  });
});

describe("Partidos de la Selección", () => {
  it.skipIf(!conDosFactores)("el Admin con 2FA carga, posterga, cancela y reactiva un Partido de la Selección", async () => {
    const { data, error } = await admin!.cliente
      .from("partido")
      .insert({ club_id: "seleccion", rival_id: rivalSeleccion, inicio: LEJOS })
      .select("id")
      .single();
    expect(error).toBeNull();
    const id = data!.id;
    partidos.push(id);

    const nuevoInicio = new Date(Date.UTC(2034, 5, 15, 20)).toISOString();
    const postergado = await admin!.cliente.from("partido").update({ inicio: nuevoInicio }).eq("id", id).select("inicio");
    expect(new Date(postergado.data![0]!.inicio).toISOString()).toBe(nuevoInicio);

    const cancelado = await admin!.cliente.from("partido").update({ estado: "cancelado" }).eq("id", id).select("estado");
    expect(cancelado.data).toEqual([{ estado: "cancelado" }]);

    const reactivado = await admin!.cliente.from("partido").update({ estado: "programado" }).eq("id", id).select("estado");
    expect(reactivado.data).toEqual([{ estado: "programado" }]);
  });

  it.skipIf(!conDosFactores)("la Selección no juega contra un Club", async () => {
    for (const club of ["penarol", "nacional"] as const) {
      const rivalClub = await rivalDelClub(club);
      const alta = await admin!.cliente.from("partido").insert({ club_id: "seleccion", rival_id: rivalClub, inicio: LEJOS });
      expect(alta.error?.code).toBe("23514");
      const cambio = await admin!.cliente.from("partido").update({ rival_id: rivalClub }).eq("id", partidoSeleccion);
      expect(cambio.error?.code).toBe("23514");
    }
  });

  it.each(sinPermisos)("%s no carga ni cambia Partidos de la Selección", async (_, cliente) => {
    const alta = await cliente().from("partido").insert({ club_id: "seleccion", rival_id: rivalSeleccion, inicio: LEJOS });
    expect(alta.error).not.toBeNull();

    const cancelar = await cliente().from("partido").update({ estado: "cancelado" }).eq("id", partidoSeleccion).select("id");
    expect(cancelar.data ?? []).toEqual([]);
    const { data } = await servicio.from("partido").select("estado").eq("id", partidoSeleccion).single();
    expect(data!.estado).toBe("programado");
  });

  it("los Hinchas todavía no ven los Partidos de la Selección", async () => {
    const { data } = await clienteComo("hinchaNacional").from("partido").select("id").eq("club_id", "seleccion");
    expect(data).toEqual([]);
  });
});

describe("los procesos de los Clubes con Partidos de la Selección", () => {
  const T = Date.UTC(2002, 2, 10, 23);
  const ahora = new Date(T + 30 * 24 * 60 * 60 * 1000);
  let vencido = "";
  let canceladoVencido = "";

  beforeAll(async () => {
    const creadoEn = new Date(T - 20 * 24 * 60 * 60 * 1000).toISOString();
    vencido = await crearPartidoConServicio(new Date(T).toISOString(), { creado_en: creadoEn });
    canceladoVencido = await crearPartidoConServicio(new Date(T + 1000).toISOString(), {
      creado_en: creadoEn,
      estado: "cancelado",
    });
  });

  it("el cierre no procesa todavía los Partidos de la Selección ni falla por ellos", async () => {
    const resumen = await cerrarVotacionesVencidas(servicio, ahora);
    expect(resumen.errores).toEqual([]);
    const ids = resumen.cerrados.map((c) => c.partidoId);
    expect(ids).not.toContain(vencido);
    expect(ids).not.toContain(canceladoVencido);

    expect(await cerrarVotacion(servicio, vencido, ahora)).toEqual({ partidoId: vencido, estado: null, creado: false });
    const { data } = await servicio.from("resultado_votacion").select("partido_id").in("partido_id", [vencido, canceladoVencido]);
    expect(data).toEqual([]);
  });

  it("el conteo no cuenta todavía la Votación de la Selección", async () => {
    expect(await contarPartido(servicio, vencido)).toBeNull();
    expect(await leerAlineacionesDelPartido(servicio, vencido)).toEqual([]);
  });

  it("la herencia no procesa la Selección", async () => {
    const resultados = await materializarHerencias(servicio, ahora);
    expect(resultados.map((r) => r.club).sort()).toEqual(["nacional", "penarol"]);
  });
});

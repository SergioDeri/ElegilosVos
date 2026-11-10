// Tests del ticket 11 del feature Selección: 11 Real de la Selección.
//
// - El Admin con 2FA lo carga, corrige y borra con la misma validación que en
//   los Clubes: exactamente 11 Jugadores distintos, todos elegibles del
//   Plantel de la Selección (no la fila de un Club del mismo Jugador), Partido
//   ya empezado y no cancelado.
// - Un Hincha (con Club o sin Club) y el Admin sin 2FA no lo escriben.
// - Lo lee cualquier usuario con perfil (con Club o sin Club); el anónimo no.
//   El 11 Real de un Club sigue siendo solo de sus Hinchas.
//
// Partidos propios en 2005 (ya empezados) y en 2100 (no empezado), creados y
// borrados con la service role; el 11 Real se va en cascada.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SELECCION, type ClubOSeleccion } from "@/domain/comun/tipos";
import { creadorDePartidos } from "./datos";
import {
  borrarUsuario,
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  crearAdminConDosFactores,
  crearUsuario,
} from "./helpers";

const adminAal2 = await crearAdminConDosFactores({ club: null });
if (!adminAal2) console.warn("[seleccion-11] TOTP apagado en Supabase local: se saltean los tests de Admin con 2FA.");
const conDosFactores = adminAal2 !== null;
const sinClub = await crearUsuario({ club: null });

const creados: string[] = [];
const crearPartido = creadorDePartidos(creados, { creadoEn: "2004-12-01T00:00:00Z" });

async function jugadoresDe(club: ClubOSeleccion) {
  const { data, error } = await clienteServicio().from("jugador").select("id").eq("club_id", club).order("nombre");
  if (error) throw error;
  return data.map((j) => j.id);
}

let jugado = ""; // Selección, 2005: ya empezó.
let otro = ""; // Selección, 2005: para los rechazos.
let cancelado = ""; // Selección, 2005, cancelado.
let futuro = ""; // Selección, 2100: no empezó.
let delClub = ""; // Peñarol, 2005: su 11 Real no lo lee el Hincha sin Club.
let elegibles: string[] = [];
let penarol: string[] = [];

beforeAll(async () => {
  jugado = await crearPartido(SELECCION, "2005-03-10T23:00:00Z");
  otro = await crearPartido(SELECCION, "2005-03-20T23:00:00Z");
  cancelado = await crearPartido(SELECCION, "2005-03-25T23:00:00Z", { estado: "cancelado" });
  futuro = await crearPartido(SELECCION, "2100-03-10T23:00:00Z");
  delClub = await crearPartido("penarol", "2005-03-12T23:00:00Z");
  elegibles = await jugadoresDe(SELECCION);
  penarol = await jugadoresDe("penarol");
  expect(elegibles.length).toBeGreaterThanOrEqual(12);
  const { error } = await clienteServicio().from("once_real").insert({ partido_id: delClub, jugadores: penarol.slice(0, 11) });
  if (error) throw error;
});

afterAll(async () => {
  await borrarUsuario(sinClub.id);
  if (adminAal2) await borrarUsuario(adminAal2.id);
  if (creados.length) {
    const { error } = await clienteServicio().from("partido").delete().in("id", creados);
    if (error) throw error;
  }
});

describe("sin 2FA no se escribe el 11 Real de la Selección", () => {
  it("ningún Hincha lo carga: con Club ni sin Club", async () => {
    for (const cliente of [clienteComo("hinchaPenarol"), clienteComo("hinchaNacional"), sinClub.cliente]) {
      const ins = await cliente.from("once_real").insert({ partido_id: jugado, jugadores: elegibles.slice(0, 11) });
      expect(ins.error).not.toBeNull();
    }
  });

  it("el Admin sin 2FA (AAL1) tampoco", async () => {
    const ins = await clienteComo("admin").from("once_real").insert({ partido_id: jugado, jugadores: elegibles.slice(0, 11) });
    expect(ins.error).not.toBeNull();
  });

  it("el anónimo tampoco", async () => {
    const ins = await clienteAnonimo().from("once_real").insert({ partido_id: jugado, jugadores: elegibles.slice(0, 11) });
    expect(ins.error).not.toBeNull();
  });
});

describe.skipIf(!conDosFactores)("el Admin con 2FA y el 11 Real de la Selección", () => {
  const admin = () => adminAal2!.cliente;

  it("lo carga con 11 elegibles en un Partido que ya empezó", async () => {
    const { data, error } = await admin()
      .from("once_real")
      .insert({ partido_id: jugado, jugadores: elegibles.slice(0, 11) })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.jugadores).toEqual(elegibles.slice(0, 11));
  });

  it("lo lee cualquier usuario con perfil, con Club o sin Club; el anónimo no", async () => {
    for (const cliente of [clienteComo("hinchaPenarol"), clienteComo("hinchaNacional"), sinClub.cliente]) {
      const { data, error } = await cliente.from("once_real").select("jugadores").eq("partido_id", jugado);
      expect(error).toBeNull();
      expect(data).toEqual([{ jugadores: elegibles.slice(0, 11) }]);
    }
    const { data: anon } = await clienteAnonimo().from("once_real").select("partido_id").eq("partido_id", jugado);
    expect(anon ?? []).toEqual([]);
  });

  it("el historial lo trae embebido en el Partido del resultado, para cualquier Hincha", async () => {
    const { error } = await clienteServicio()
      .from("resultado_votacion")
      .insert({ partido_id: jugado, estado: "sin_alineaciones", cierre: "2005-03-10T22:00:00Z", apariciones: { alineaciones: 0, porJugador: [] } });
    expect(error).toBeNull();
    const { data } = await sinClub.cliente
      .from("resultado_votacion")
      .select("estado, partido(id, once_real(jugadores))")
      .eq("partido_id", jugado)
      .single();
    expect(data!.partido!.once_real?.jugadores).toEqual(elegibles.slice(0, 11));
  });

  it("ningún Hincha ni el Admin sin 2FA lo corrigen ni lo borran", async () => {
    for (const cliente of [clienteComo("hinchaPenarol"), sinClub.cliente, clienteComo("admin")]) {
      const upd = await cliente.from("once_real").update({ jugadores: elegibles.slice(1, 12) }).eq("partido_id", jugado).select();
      expect(upd.data ?? []).toEqual([]);
      const del = await cliente.from("once_real").delete().eq("partido_id", jugado).select();
      expect(del.data ?? []).toEqual([]);
    }
    const { data } = await clienteServicio().from("once_real").select("jugadores").eq("partido_id", jugado).single();
    expect(data!.jugadores).toEqual(elegibles.slice(0, 11));
  });

  it("lo corrige", async () => {
    const { data, error } = await admin()
      .from("once_real")
      .update({ jugadores: elegibles.slice(1, 12) })
      .eq("partido_id", jugado)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.jugadores).toEqual(elegibles.slice(1, 12));
  });

  it("rechaza 10 o 12 Jugadores, repetidos y los que no son elegibles de la Selección", async () => {
    const intentos = [
      elegibles.slice(0, 10),
      elegibles.slice(0, 12),
      [...elegibles.slice(0, 10), elegibles[0]!],
      [...elegibles.slice(0, 10), penarol[0]!],
      [...elegibles.slice(0, 10), crypto.randomUUID()],
    ];
    for (const jugadores of intentos) {
      const ins = await admin().from("once_real").insert({ partido_id: otro, jugadores });
      expect(ins.error, JSON.stringify(jugadores)).not.toBeNull();
    }
    const upd = await admin()
      .from("once_real")
      .update({ jugadores: [...elegibles.slice(0, 10), penarol[0]!] })
      .eq("partido_id", jugado)
      .select();
    expect(upd.error).not.toBeNull();
  });

  it("rechaza un Partido que no empezó o cancelado", async () => {
    for (const partido of [futuro, cancelado]) {
      const ins = await admin().from("once_real").insert({ partido_id: partido, jugadores: elegibles.slice(0, 11) });
      expect(ins.error).not.toBeNull();
    }
  });

  it("lo borra", async () => {
    const { data, error } = await admin().from("once_real").delete().eq("partido_id", jugado).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("el 11 Real de un Club sigue siendo de sus Hinchas", () => {
  it("el Hincha sin Club y el del otro Club no lo leen", async () => {
    for (const cliente of [sinClub.cliente, clienteComo("hinchaNacional")]) {
      const { data } = await cliente.from("once_real").select("partido_id").eq("partido_id", delClub);
      expect(data).toEqual([]);
    }
    const { data } = await clienteComo("hinchaPenarol").from("once_real").select("partido_id").eq("partido_id", delClub);
    expect(data).toHaveLength(1);
  });
});

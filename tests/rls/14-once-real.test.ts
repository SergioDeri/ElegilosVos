// Tests del ticket 14: 11 Real (`once_real`).
//
// Partidos propios en 2001 (ya empezados) y en 2100 (no empezado), creados y
// borrados con la service role; el 11 Real se va en cascada.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ClubId } from "@/domain/comun/tipos";
import {
  borrarUsuario,
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  crearAdminConDosFactores,
} from "./helpers";
import { creadorDePartidos } from "./datos";

const adminAal2 = await crearAdminConDosFactores({ club: "nacional" });
const conDosFactores = adminAal2 !== null;

const creados: string[] = [];

const crearPartido = creadorDePartidos(creados, { creadoEn: "2000-12-01T00:00:00Z" });

async function jugadoresDe(club: ClubId) {
  const { data, error } = await clienteServicio().from("jugador").select("id").eq("club_id", club).order("numero");
  if (error) throw error;
  return data.map((j) => j.id);
}

let jugado = ""; // Peñarol, 2001: ya empezó.
let otro = ""; // Peñarol, 2001: para los rechazos.
let cancelado = ""; // Peñarol, 2001, cancelado.
let futuro = ""; // Peñarol, 2100: no empezó.
let penarol: string[] = [];
let nacional: string[] = [];

beforeAll(async () => {
  jugado = await crearPartido("penarol", "2001-01-10T23:00:00Z");
  otro = await crearPartido("penarol", "2001-01-20T23:00:00Z");
  cancelado = await crearPartido("penarol", "2001-01-25T23:00:00Z", { estado: "cancelado" });
  futuro = await crearPartido("penarol", "2100-01-10T23:00:00Z");
  penarol = await jugadoresDe("penarol");
  nacional = await jugadoresDe("nacional");
  expect(penarol.length).toBeGreaterThanOrEqual(12);
});

afterAll(async () => {
  if (adminAal2) await borrarUsuario(adminAal2.id);
  if (creados.length) {
    const { error } = await clienteServicio().from("partido").delete().in("id", creados);
    if (error) throw error;
  }
});

describe("sin 2FA no se escribe el 11 Real", () => {
  it("el Hincha no lo carga, ni corrige ni borra", async () => {
    const hincha = clienteComo("hinchaPenarol");
    const ins = await hincha.from("once_real").insert({ partido_id: jugado, jugadores: penarol.slice(0, 11) });
    expect(ins.error).not.toBeNull();
  });

  it("el Admin sin 2FA (AAL1) tampoco", async () => {
    const ins = await clienteComo("admin").from("once_real").insert({ partido_id: jugado, jugadores: penarol.slice(0, 11) });
    expect(ins.error).not.toBeNull();
  });

  it("el anónimo tampoco", async () => {
    const ins = await clienteAnonimo().from("once_real").insert({ partido_id: jugado, jugadores: penarol.slice(0, 11) });
    expect(ins.error).not.toBeNull();
  });
});

describe.skipIf(!conDosFactores)("el Admin con 2FA", () => {
  const admin = () => adminAal2!.cliente;

  it("carga el 11 Real de un Partido que ya empezó", async () => {
    const { data, error } = await admin()
      .from("once_real")
      .insert({ partido_id: jugado, jugadores: penarol.slice(0, 11) })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.jugadores).toEqual(penarol.slice(0, 11));
  });

  it("el Hincha del Club lo lee; el del otro Club y el anónimo no", async () => {
    const { data: delClub } = await clienteComo("hinchaPenarol").from("once_real").select("partido_id").eq("partido_id", jugado);
    expect(delClub).toHaveLength(1);
    const { data: delOtro } = await clienteComo("hinchaNacional").from("once_real").select("partido_id").eq("partido_id", jugado);
    expect(delOtro).toEqual([]);
    const { data: anon } = await clienteAnonimo().from("once_real").select("partido_id").eq("partido_id", jugado);
    expect(anon ?? []).toEqual([]);
  });

  it("el Hincha ni el Admin sin 2FA lo corrigen ni lo borran", async () => {
    for (const cliente of [clienteComo("hinchaPenarol"), clienteComo("admin")]) {
      const upd = await cliente.from("once_real").update({ jugadores: penarol.slice(1, 12) }).eq("partido_id", jugado).select();
      expect(upd.data ?? []).toEqual([]);
      const del = await cliente.from("once_real").delete().eq("partido_id", jugado).select();
      expect(del.data ?? []).toEqual([]);
    }
    const { data } = await clienteServicio().from("once_real").select("jugadores").eq("partido_id", jugado).single();
    expect(data!.jugadores).toEqual(penarol.slice(0, 11));
  });

  it("lo corrige", async () => {
    const { data, error } = await admin()
      .from("once_real")
      .update({ jugadores: penarol.slice(1, 12) })
      .eq("partido_id", jugado)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.jugadores).toEqual(penarol.slice(1, 12));
  });

  it("el historial del Hincha lo trae embebido en el Partido del resultado", async () => {
    const { error } = await clienteServicio()
      .from("resultado_votacion")
      .insert({ partido_id: jugado, estado: "sin_alineaciones", cierre: "2001-01-10T22:00:00Z" });
    expect(error).toBeNull();
    const { data } = await clienteComo("hinchaPenarol")
      .from("resultado_votacion")
      .select("estado, partido(id, once_real(jugadores))")
      .eq("partido_id", jugado)
      .single();
    expect(data!.partido!.once_real?.jugadores).toEqual(penarol.slice(1, 12));
  });

  it("rechaza 10 o 12 Jugadores, repetidos y de otro Club", async () => {
    const intentos = [
      penarol.slice(0, 10),
      penarol.slice(0, 12),
      [...penarol.slice(0, 10), penarol[0]!],
      [...penarol.slice(0, 10), nacional[0]!],
      [...penarol.slice(0, 10), crypto.randomUUID()],
    ];
    for (const jugadores of intentos) {
      const ins = await admin().from("once_real").insert({ partido_id: otro, jugadores });
      expect(ins.error, JSON.stringify(jugadores)).not.toBeNull();
    }
    const upd = await admin()
      .from("once_real")
      .update({ jugadores: [...penarol.slice(0, 10), nacional[0]!] })
      .eq("partido_id", jugado)
      .select();
    expect(upd.error).not.toBeNull();
  });

  it("rechaza un Partido que no empezó o cancelado", async () => {
    for (const partido of [futuro, cancelado]) {
      const ins = await admin().from("once_real").insert({ partido_id: partido, jugadores: penarol.slice(0, 11) });
      expect(ins.error).not.toBeNull();
    }
  });

  it("no lo mueve a otro Partido", async () => {
    const upd = await admin().from("once_real").update({ partido_id: otro }).eq("partido_id", jugado).select();
    expect(upd.error).not.toBeNull();
  });

  it("lo borra", async () => {
    const { data, error } = await admin().from("once_real").delete().eq("partido_id", jugado).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("la base valida también para la service role", () => {
  it("rechaza 10 Jugadores", async () => {
    const ins = await clienteServicio().from("once_real").insert({ partido_id: otro, jugadores: penarol.slice(0, 10) });
    expect(ins.error).not.toBeNull();
  });
});

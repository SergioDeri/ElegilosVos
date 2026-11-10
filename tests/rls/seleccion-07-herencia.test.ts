// Tests del ticket 07 del feature Selección: Herencia en la Selección contra
// Supabase local, con `materializarHerencias` (src/lib/herencia) y la service
// role, siguiendo `10-herencia.test.ts`.
//
// Escenario en 2034 (Partidos y `ahora` explícitos): un Partido viejo de la
// Selección con la Votación cerrada y una fecha doble (A y B) con las dos
// Votaciones abiertas. A hereda del viejo como en los Clubes; B copia lo que
// el Hincha tiene en A. Los Jugadores no Disponibles y de baja son propios del
// test. Todo se borra al final.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SELECCION } from "@/domain/comun/tipos";
import { materializarHerencias } from "@/lib/herencia/materializar";
import { creadorDePartidos, guardarConServicio, jugadoresDisponibles } from "./datos";
import { borrarUsuario, clienteServicio, crearUsuario, usuario } from "./helpers";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2034, 5, 1, 22);
const en = (ms: number) => new Date(T + ms);
/** Las Votaciones de A (en 5 días) y B (en 10 días) están abiertas; la del viejo cerró. */
const ahora = en(0);

const t1 = en(-40 * DIA).toISOString();
const t2 = en(-2 * DIA).toISOString();

const partidos: string[] = [];
const jugadoresPropios: string[] = [];
let viejoId = "";
let aId = "";
let bId = "";
let sinClub: { id: string } | null = null;
let j: { arquero: string; def: string; otroDef: string; lesionado: string; baja: string };

const crearPartido = creadorDePartidos(partidos, { creadoEn: en(-60 * DIA) });
const hinchaPenarol = () => usuario("hinchaPenarol").id;
const hinchaNacional = () => usuario("hinchaNacional").id;

async function crearJugador(nombre: string, extra: { disponibilidad?: "lesionado"; motivo_disponibilidad?: string; en_plantel?: boolean }) {
  const { data, error } = await clienteServicio()
    .from("jugador")
    .insert({ club_id: SELECCION, nombre, numero: null, posicion_natural: "MED", ...extra })
    .select("id")
    .single();
  if (error) throw error;
  jugadoresPropios.push(data.id);
  return data.id;
}

function guardar442(hinchaId: string, partidoId: string, puestos: Record<string, { jugadorId: string; modificadoEn: string }>) {
  return guardarConServicio(hinchaId, partidoId, { esquema: "4-4-2", esquemaModificadoEn: t1, puestos });
}

async function puestosDe(hinchaId: string, partidoId: string) {
  const { data, error } = await clienteServicio()
    .from("alineacion")
    .select("puestos")
    .eq("partido_id", partidoId)
    .eq("hincha_id", hinchaId)
    .maybeSingle();
  if (error) throw error;
  return data?.puestos ?? null;
}

async function cuantasEn(partidoId: string) {
  const { count, error } = await clienteServicio()
    .from("alineacion")
    .select("id", { count: "exact", head: true })
    .eq("partido_id", partidoId);
  if (error) throw error;
  return count;
}

beforeAll(async () => {
  const disponibles = await jugadoresDisponibles(SELECCION);
  j = {
    arquero: disponibles.arquero,
    def: disponibles.defensores[0]!,
    otroDef: disponibles.defensores[1]!,
    lesionado: await crearJugador("Lesionado de la Selección", { disponibilidad: "lesionado", motivo_disponibilidad: "Desgarro" }),
    baja: await crearJugador("Baja de la Selección", { en_plantel: false }),
  };

  viejoId = await crearPartido(SELECCION, en(-30 * DIA));
  aId = await crearPartido(SELECCION, en(5 * DIA));
  bId = await crearPartido(SELECCION, en(10 * DIA));

  // El de Peñarol solo votó el Partido viejo (cerrado), con un lesionado y una baja.
  await guardar442(hinchaPenarol(), viejoId, {
    ARQ: { jugadorId: j.arquero, modificadoEn: t1 },
    LI: { jugadorId: j.def, modificadoEn: t1 },
    MC_I: { jugadorId: j.lesionado, modificadoEn: t1 },
    MC_D: { jugadorId: j.baja, modificadoEn: t1 },
  });
  // El de Nacional ya armó A (abierta), también con un lesionado.
  await guardar442(hinchaNacional(), aId, {
    ARQ: { jugadorId: j.arquero, modificadoEn: t2 },
    LD: { jugadorId: j.otroDef, modificadoEn: t2 },
    MC_I: { jugadorId: j.lesionado, modificadoEn: t2 },
  });
  // Un Hincha sin Club (solo Selección) con Alineación en el viejo.
  sinClub = await crearUsuario({ club: null });
  await guardar442(sinClub.id, viejoId, { ARQ: { jugadorId: j.arquero, modificadoEn: t1 } });
});

afterAll(async () => {
  const servicio = clienteServicio();
  if (partidos.length) await servicio.from("partido").delete().in("id", partidos); // cascada a `alineacion`
  if (jugadoresPropios.length) await servicio.from("jugador").delete().in("id", jugadoresPropios);
  if (sinClub) await borrarUsuario(sinClub.id);
});

describe("materializarHerencias en la Selección", () => {
  it("el cron procesa las dos Votaciones abiertas de la fecha doble, en orden", async () => {
    const resultado = await materializarHerencias(clienteServicio(), ahora);
    const deLaSeleccion = resultado.filter((r) => r.club === SELECCION);
    expect(deLaSeleccion.map((r) => [r.partidoId, r.anteriorId])).toEqual([
      [aId, viejoId],
      [bId, aId],
    ]);
  });

  it("A (anterior cerrado) hereda del viejo como en los Clubes, sin no Disponibles ni bajas", async () => {
    expect(await puestosDe(hinchaPenarol(), aId)).toEqual({
      ARQ: { jugadorId: j.arquero, modificadoEn: t1 },
      LI: { jugadorId: j.def, modificadoEn: t1 },
    });
  });

  it("B (anterior abierto) copia lo que el Hincha tiene en A, sin no Disponibles", async () => {
    expect(await puestosDe(hinchaNacional(), bId)).toEqual({
      ARQ: { jugadorId: j.arquero, modificadoEn: t2 },
      LD: { jugadorId: j.otroDef, modificadoEn: t2 },
    });
    // Incluida la que A acaba de heredar en la misma corrida.
    expect(await puestosDe(hinchaPenarol(), bId)).toEqual(await puestosDe(hinchaPenarol(), aId));
  });

  it("hereda también un Hincha sin Club", async () => {
    const esperada = { ARQ: { jugadorId: j.arquero, modificadoEn: t1 } };
    expect(await puestosDe(sinClub!.id, aId)).toEqual(esperada);
    expect(await puestosDe(sinClub!.id, bId)).toEqual(esperada);
  });

  it("es idempotente: correrlo dos veces más no duplica Alineaciones", async () => {
    const antes = [await cuantasEn(aId), await cuantasEn(bId)];
    for (let i = 0; i < 2; i++) {
      const resultado = await materializarHerencias(clienteServicio(), ahora, { club: SELECCION });
      expect(resultado.map((r) => r.creadas)).toEqual([0, 0]);
    }
    expect([await cuantasEn(aId), await cuantasEn(bId)]).toEqual(antes);
  });

  it("cambiar la Alineación copiada no toca la del Partido anterior", async () => {
    const enA = await puestosDe(hinchaNacional(), aId);
    const cambio = { ARQ: { jugadorId: j.arquero, modificadoEn: en(HORA).toISOString() } };
    await guardar442(hinchaNacional(), bId, cambio);
    expect(await puestosDe(hinchaNacional(), bId)).toEqual(cambio);
    expect(await puestosDe(hinchaNacional(), aId)).toEqual(enA);
  });

  it("al entrar (un solo Hincha) materializa solo la suya", async () => {
    await clienteServicio().from("alineacion").delete().in("partido_id", [aId, bId]).eq("hincha_id", sinClub!.id);
    const resultado = await materializarHerencias(clienteServicio(), ahora, { club: SELECCION, hinchaId: sinClub!.id });
    expect(resultado.map((r) => r.creadas)).toEqual([1, 1]);
  });
});

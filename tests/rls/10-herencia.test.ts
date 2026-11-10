// Tests del ticket 10: materialización de la Herencia de Alineación contra
// Supabase local, con `materializarHerencias` (src/lib/herencia) y la service
// role.
//
// El escenario vive en 2033 (Partidos y `ahora` explícito) para no cambiar qué
// Votación está abierta hoy; los Jugadores no Disponibles y de baja son
// propios del test. Todo se borra al final.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { numeroDeClubDeLaBase } from "@/domain/comun/tipos";
import { alineacionDesdeFila } from "@/domain/armado";
import { contar } from "@/domain/conteo";
import { materializarHerencias } from "@/lib/herencia/materializar";
import { creadorDePartidos, guardarConServicio } from "./datos";
import { borrarUsuario, clienteComo, clienteServicio, crearUsuario, usuario } from "./helpers";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2033, 2, 1, 22);
const en = (ms: number) => new Date(T + ms);
/** Durante la Votación de B (abre al terminar A, cierra 1 h antes de B). */
const ahora = en(DIA);

const t1 = en(-5 * DIA).toISOString();
const t2 = en(-4 * DIA).toISOString();

const partidos: string[] = [];
const jugadoresPropios: string[] = [];
let anteriorId = "";
let abiertoId = "";
let descartable: { id: string } | null = null;
let j: { arquero: string; def: string; lesionado: string; baja: string };

const crearPartido = creadorDePartidos(partidos, { creadoEn: en(-10 * DIA) });

async function crearJugador(nombre: string, extra: { disponibilidad?: "lesionado"; motivo_disponibilidad?: string; en_plantel?: boolean }) {
  const { data, error } = await clienteServicio()
    .from("jugador")
    .insert({ club_id: "penarol", nombre, numero: 98, posicion_natural: "MED", ...extra })
    .select("id")
    .single();
  if (error) throw error;
  jugadoresPropios.push(data.id);
  return data.id;
}

/** Alineación 4-4-2 (elegido a mano en t1) con los Puestos dados. */
function guardar442(hinchaId: string, partidoId: string, puestos: Record<string, { jugadorId: string; modificadoEn: string }>) {
  return guardarConServicio(hinchaId, partidoId, { esquema: "4-4-2", esquemaModificadoEn: t1, puestos });
}

async function alineacionesDe(partidoId: string) {
  const { data, error } = await clienteServicio()
    .from("alineacion")
    .select("hincha_id, esquema, esquema_elegido_a_mano, esquema_modificado_en, puestos")
    .eq("partido_id", partidoId);
  if (error) throw error;
  return data;
}

const hinchaPenarol = () => usuario("hinchaPenarol").id;

beforeAll(async () => {
  const servicio = clienteServicio();
  const { data: disponibles, error } = await servicio
    .from("jugador")
    .select("id, posicion_natural")
    .eq("club_id", "penarol")
    .eq("en_plantel", true)
    .eq("disponibilidad", "disponible");
  if (error) throw error;
  j = {
    arquero: disponibles.find((x) => x.posicion_natural === "ARQ")!.id,
    def: disponibles.find((x) => x.posicion_natural === "DEF")!.id,
    lesionado: await crearJugador("Lesionado de prueba", { disponibilidad: "lesionado", motivo_disponibilidad: "Desgarro" }),
    baja: await crearJugador("Baja de prueba", { en_plantel: false }),
  };

  anteriorId = await crearPartido("penarol", en(0));
  await crearPartido("penarol", en(3 * DIA), { estado: "cancelado" }); // se saltea: no es "el anterior"
  abiertoId = await crearPartido("penarol", en(7 * DIA));

  // Alineación del Hincha en el Partido anterior (con horas explícitas).
  await guardar442(hinchaPenarol(), anteriorId, {
    ARQ: { jugadorId: j.arquero, modificadoEn: t1 },
    LI: { jugadorId: j.def, modificadoEn: t2 },
    MC_I: { jugadorId: j.lesionado, modificadoEn: t1 },
    MC_D: { jugadorId: j.baja, modificadoEn: t2 },
  });

  // Un Hincha de Peñarol con Alineación en el anterior, que todavía no heredó.
  descartable = await crearUsuario({ club: "penarol" });
  await guardar442(descartable.id, anteriorId, { ARQ: { jugadorId: j.arquero, modificadoEn: t1 } });
});

afterAll(async () => {
  const servicio = clienteServicio();
  if (partidos.length) await servicio.from("partido").delete().in("id", partidos); // cascada a `alineacion`
  if (jugadoresPropios.length) await servicio.from("jugador").delete().in("id", jugadoresPropios);
  if (descartable) await borrarUsuario(descartable.id);
});

describe("materializarHerencias", () => {
  it("al entrar (un solo Hincha): materializa solo la de ese Hincha", async () => {
    const resultado = await materializarHerencias(clienteServicio(), ahora, { club: "penarol", hinchaId: hinchaPenarol() });
    expect(resultado).toEqual([{ club: "penarol", partidoId: abiertoId, anteriorId, creadas: 1 }]);
    expect((await alineacionesDe(abiertoId)).map((a) => a.hincha_id)).toEqual([hinchaPenarol()]);
  });

  it("excluye no Disponibles y bajas, y conserva horas y Esquema elegido a mano", async () => {
    const [heredada] = (await alineacionesDe(abiertoId)).filter((a) => a.hincha_id === hinchaPenarol());
    expect(heredada).toMatchObject({ esquema: "4-4-2", esquema_elegido_a_mano: true });
    expect(new Date(heredada!.esquema_modificado_en!).toISOString()).toBe(t1);
    expect(heredada!.puestos).toEqual({
      ARQ: { jugadorId: j.arquero, modificadoEn: t1 },
      LI: { jugadorId: j.def, modificadoEn: t2 },
    });
  });

  it("no hereda a un Hincha al que el Admin le cambió el Club Favorito", async () => {
    const { error } = await clienteServicio().from("perfil").update({ club_favorito_id: "nacional" }).eq("id", descartable!.id);
    expect(error).toBeNull();
    const resultado = await materializarHerencias(clienteServicio(), ahora);
    expect(resultado).toContainEqual({ club: "penarol", partidoId: abiertoId, anteriorId, creadas: 0 });
    expect((await alineacionesDe(abiertoId)).map((a) => a.hincha_id)).toEqual([hinchaPenarol()]);
  });

  it("materializa para los Hinchas del Club con Alineación en el anterior", async () => {
    // De vuelta en Peñarol: ahora sí hereda.
    await clienteServicio().from("perfil").update({ club_favorito_id: "penarol" }).eq("id", descartable!.id);
    const resultado = await materializarHerencias(clienteServicio(), ahora);
    expect(resultado).toContainEqual({ club: "penarol", partidoId: abiertoId, anteriorId, creadas: 1 });
    expect((await alineacionesDe(abiertoId)).map((a) => a.hincha_id).sort()).toEqual([hinchaPenarol(), descartable!.id].sort());
  });

  it("es idempotente: correrla de nuevo no duplica ni pisa los cambios del Hincha", async () => {
    const cambio = { ARQ: { jugadorId: j.arquero, modificadoEn: en(2 * HORA + 60_000).toISOString() } };
    await guardar442(hinchaPenarol(), abiertoId, cambio);

    for (let i = 0; i < 2; i++) {
      const resultado = await materializarHerencias(clienteServicio(), ahora);
      expect(resultado).toContainEqual({ club: "penarol", partidoId: abiertoId, anteriorId, creadas: 0 });
    }
    const filas = await alineacionesDe(abiertoId);
    expect(filas).toHaveLength(2);
    expect(filas.find((a) => a.hincha_id === hinchaPenarol())!.puestos).toEqual(cambio);
  });

  it("sin Votación abierta no hace nada", async () => {
    const resultado = await materializarHerencias(clienteServicio(), en(HORA)); // durante el Partido anterior
    expect(resultado.every((r) => r.creadas === 0 && r.partidoId === null)).toBe(true);
  });
});

describe("una Alineación heredada que el Hincha nunca tocó", () => {
  it("el Hincha la lee como suya y cuenta en el conteo", async () => {
    // Se la vuelve a heredar desde cero, sin tocarla.
    await clienteServicio().from("alineacion").delete().eq("partido_id", abiertoId).eq("hincha_id", hinchaPenarol());
    await materializarHerencias(clienteServicio(), ahora, { club: "penarol", hinchaId: hinchaPenarol() });

    const { data, error } = await clienteComo("hinchaPenarol")
      .from("alineacion")
      .select("esquema, esquema_elegido_a_mano, esquema_modificado_en, puestos")
      .eq("partido_id", abiertoId)
      .single();
    expect(error).toBeNull();
    const alineacion = alineacionDesdeFila(data!);
    expect(Object.keys(alineacion.puestos).sort()).toEqual(["ARQ", "LI"]);

    // Otro Hincha no la ve.
    const { data: ajenas } = await clienteComo("hinchaNacional").from("alineacion").select("id").eq("partido_id", abiertoId);
    expect(ajenas).toEqual([]);

    const { data: jugadores } = await clienteServicio()
      .from("jugador")
      .select("id, numero, posicion_natural, disponibilidad, en_plantel")
      .eq("club_id", "penarol");
    const resultado = contar({
      alineaciones: [alineacion],
      jugadores: jugadores!.map((x) => ({
        id: x.id,
        numero: numeroDeClubDeLaBase(x.numero),
        posicionNatural: x.posicion_natural,
        disponibilidad: x.disponibilidad,
        enPlantel: x.en_plantel,
      })),
    });
    expect(resultado.alineacionesQueCuentan).toBe(1);
  });
});

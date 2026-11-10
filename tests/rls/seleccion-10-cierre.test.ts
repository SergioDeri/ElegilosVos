// Tests del ticket 10 del feature Selección: cierre de la Selección (11
// Elegido y Gran Ausente final).
//
// - El cierre (`cerrarVotacionesVencidas`, lo que corre el cron) procesa la
//   Selección, también dos Votaciones de una fecha doble que cierran cerca.
// - Las apariciones quedan congeladas con el resultado inmutable.
// - El Gran Ausente final se deriva de las apariciones congeladas y la
//   Convocatoria: si se carga después del cierre, aparece sin modificar el
//   resultado.
// - Una vez publicado el Gran Ausente final, la Convocatoria no se corrige ni
//   se borra (ni el Admin con 2FA).
// - Los resultados de la Selección los lee cualquier usuario con perfil.
//
// El escenario vive en 2004 (antes de todo Partido del seed), con `ahora`
// explícito, como en 12-cierre. Los Partidos se borran al final con la
// service role (resultados y Convocatorias en cascada).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SELECCION } from "@/domain/comun/tipos";
import { cerrarVotacionesVencidas } from "@/lib/cierre/proceso";
import { leerGranAusenteFinal } from "@/lib/cierre/gran-ausente";
import { leerConvocados } from "@/lib/convocatoria/lecturas";
import { creadorDePartidos, guardarConServicio, jugadoresDisponibles } from "./datos";
import {
  borrarUsuario,
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  crearAdminConDosFactores,
  crearUsuario,
  usuario,
  type Cliente,
} from "./helpers";

vi.mock("server-only", () => ({}));

const admin = await crearAdminConDosFactores();
if (!admin) console.warn("[seleccion-10] TOTP apagado en Supabase local: se saltean los tests de Admin con 2FA.");
const conDosFactores = admin !== null;
const sinClub = await crearUsuario({ club: null });

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2004, 2, 10, 23);
const en = (ms: number) => new Date(T + ms);

const servicio = clienteServicio();
const partidos: string[] = [];
const crearPartido = creadorDePartidos(partidos, { creadoEn: en(-30 * DIA) });
const convocatorias: string[] = [];

let ida = ""; // Fecha doble: la ida, con Convocatoria cargada antes del cierre.
let vuelta = ""; // 5 días después: copia la ida y cierra sin Convocatoria.
let arquero = "";
let campo: string[] = [];

const puesto = (jugadorId: string) => ({ jugadorId, modificadoEn: en(-3 * DIA).toISOString() });

async function convocar(cliente: Cliente, jugadores: string[], aplicaA: string[]) {
  const { data, error } = await cliente.rpc("guardar_convocatoria", { convocatoria: null as never, jugadores, partidos: aplicaA });
  if (data) convocatorias.push(data);
  return { data, error };
}

async function resultado(partidoId: string) {
  const { data, error } = await servicio.from("resultado_votacion").select().eq("partido_id", partidoId).maybeSingle();
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  ida = await crearPartido(SELECCION, en(0));
  vuelta = await crearPartido(SELECCION, en(5 * DIA));
  ({ arquero, campo } = await jugadoresDisponibles(SELECCION));
  const [c0, c1, c2, c3] = campo as [string, string, string, string];
  // Votan un Hincha de cada Club y uno sin Club: un solo resultado.
  for (const [hincha, puestos] of [
    [usuario("hinchaPenarol").id, { ARQ: puesto(arquero), LI: puesto(c0), LD: puesto(c1) }],
    [usuario("hinchaNacional").id, { ARQ: puesto(arquero), LI: puesto(c0), ZAG_I: puesto(c2) }],
    [sinClub.id, { ARQ: puesto(arquero), LD: puesto(c3) }],
  ] as const) {
    await guardarConServicio(hincha, ida, { esquema: "4-3-3", esquemaModificadoEn: en(-5 * DIA), puestos });
  }
  // Convocatoria de la ida, cargada con la Votación abierta: c0 no está.
  const { error } = await convocar(servicio, [arquero, c1, c2, c3], [ida]);
  if (error) throw error;
}, 60_000);

afterAll(async () => {
  if (partidos.length) await servicio.from("partido").delete().in("id", partidos);
  if (convocatorias.length) await servicio.from("convocatoria").delete().in("id", convocatorias);
  await borrarUsuario(sinClub.id);
  if (admin) await borrarUsuario(admin.id);
});

describe("el cierre procesa la Selección", () => {
  it("con dos Votaciones de una fecha doble que cierran cerca, cierra cada una a su hora", async () => {
    // Pasó el cierre de la ida, no el de la vuelta.
    const primera = await cerrarVotacionesVencidas(servicio, en(DIA));
    expect(primera.errores).toEqual([]);
    const ids1 = new Map(primera.cerrados.map((c) => [c.partidoId, c]));
    expect(ids1.get(ida)).toEqual({ partidoId: ida, estado: "con_once", creado: true });
    expect(ids1.has(vuelta)).toBe(false);
    expect(await resultado(vuelta)).toBeNull();

    const segunda = await cerrarVotacionesVencidas(servicio, en(10 * DIA));
    expect(segunda.errores).toEqual([]);
    const ids2 = new Map(segunda.cerrados.map((c) => [c.partidoId, c]));
    expect(ids2.get(vuelta)).toEqual({ partidoId: vuelta, estado: "con_once", creado: true });
    expect(ids2.has(ida)).toBe(false); // ya tenía resultado
  });

  it("congela el 11 Elegido con los votos de todos los Hinchas", async () => {
    const fila = (await resultado(ida))!;
    expect(fila.estado).toBe("con_once");
    expect(fila.esquema).toBe("4-3-3");
    expect(fila.alineaciones_que_cuentan).toBe(3);
    const once = fila.once as { puesto: string; jugadorId: string }[];
    expect(once.find((a) => a.puesto === "ARQ")?.jugadorId).toBe(arquero);
  });

  it("las apariciones quedan congeladas con el resultado, sin datos de Hinchas", async () => {
    const fila = (await resultado(ida))!;
    const apariciones = fila.apariciones as { alineaciones: number; porJugador: { jugadorId: string; apariciones: number }[] };
    expect(apariciones.alineaciones).toBe(3);
    const porJugador = new Map(apariciones.porJugador.map((a) => [a.jugadorId, a.apariciones]));
    expect(porJugador.get(arquero)).toBe(3);
    expect(porJugador.get(campo[0]!)).toBe(2);
    expect(porJugador.get(campo[3]!)).toBe(1);
    for (const id of [usuario("hinchaPenarol").id, usuario("hinchaNacional").id, sinClub.id]) {
      expect(JSON.stringify(fila)).not.toContain(id);
    }
  });

  it("la vuelta contó las Alineaciones copiadas de la ida (materializadas antes del cierre)", async () => {
    const fila = (await resultado(vuelta))!;
    expect(fila.alineaciones_que_cuentan).toBe(3);
    expect((fila.apariciones as { alineaciones: number }).alineaciones).toBe(3);
  });
});

describe("Gran Ausente final", () => {
  it("con Convocatoria es el no convocado que figura en más Alineaciones del cierre", async () => {
    const final = await leerGranAusenteFinal(clienteComo("hinchaNacional"), ida);
    expect(final?.granAusente).toEqual({
      tipo: "gran_ausente",
      jugadores: [{ jugadorId: campo[0]!, apariciones: 2, porcentaje: (2 / 3) * 100 }],
    });
  });

  it("sin Convocatoria todavía no hay Gran Ausente final", async () => {
    const final = await leerGranAusenteFinal(clienteComo("hinchaPenarol"), vuelta);
    expect(final?.convocados).toBeNull();
    expect(final?.granAusente).toBeNull();
    expect(final?.apariciones.alineaciones).toBe(3);
  });

  it("Convocatoria cargada después del cierre: aparece el Gran Ausente sin modificar el resultado", async () => {
    const antes = await resultado(vuelta);
    const { error } = await convocar(admin?.cliente ?? servicio, [arquero, campo[0]!], [vuelta]);
    expect(error).toBeNull();
    expect(await resultado(vuelta)).toEqual(antes);

    const final = await leerGranAusenteFinal(sinClub.cliente, vuelta);
    expect(final?.granAusente?.tipo).toBe("gran_ausente");
    expect(final?.granAusente?.jugadores.map((j) => j.jugadorId)).toEqual([campo[1]!, campo[2]!, campo[3]!].sort());
  });
});

describe("lectura de los resultados de la Selección", () => {
  it("los lee cualquier Hincha, con Club o sin Club; sin sesión, no", async () => {
    for (const cliente of [clienteComo("hinchaPenarol"), clienteComo("hinchaNacional"), sinClub.cliente]) {
      const { data } = await cliente.from("resultado_votacion").select("partido_id, apariciones").eq("partido_id", ida);
      expect(data).toHaveLength(1);
    }
    const { data: anon } = await clienteAnonimo().from("resultado_votacion").select("partido_id").eq("partido_id", ida);
    expect(anon ?? []).toEqual([]);
  });
});

describe("la Convocatoria queda fija después de publicado el Gran Ausente final", () => {
  let convocatoriaIda = "";
  beforeAll(async () => {
    const { data } = await servicio.from("convocatoria_partido").select("convocatoria_id").eq("partido_id", ida).single();
    convocatoriaIda = data!.convocatoria_id;
  });

  it.skipIf(!conDosFactores)("el Admin con 2FA no la corrige", async () => {
    const { error } = await admin!.cliente.rpc("guardar_convocatoria", {
      convocatoria: convocatoriaIda,
      jugadores: [arquero, campo[0]!],
      partidos: [ida],
    });
    expect(error?.code).toBe("EV100");
    const directo = await admin!.cliente.from("convocatoria_jugador").insert({ convocatoria_id: convocatoriaIda, jugador_id: campo[0]! });
    expect(directo.error?.code).toBe("EV100");
    const sacar = await admin!.cliente.from("convocatoria_jugador").delete().eq("convocatoria_id", convocatoriaIda);
    expect(sacar.error?.code).toBe("EV100");
    const sinPartido = await admin!.cliente.from("convocatoria_partido").delete().eq("partido_id", ida);
    expect(sinPartido.error?.code).toBe("EV100");
    expect(await leerConvocados(servicio, ida)).toEqual([arquero, campo[1]!, campo[2]!, campo[3]!].sort());
  });

  it.skipIf(!conDosFactores)("el Admin con 2FA no la borra", async () => {
    const { error } = await admin!.cliente.from("convocatoria").delete().eq("id", convocatoriaIda);
    expect(error?.code).toBe("EV100");
    expect(await leerConvocados(servicio, ida)).not.toBeNull();
  });

  it.skipIf(!conDosFactores)("la cargada después del cierre también queda fija", async () => {
    const { data } = await servicio.from("convocatoria_partido").select("convocatoria_id").eq("partido_id", vuelta).single();
    const { error } = await admin!.cliente.rpc("guardar_convocatoria", {
      convocatoria: data!.convocatoria_id,
      jugadores: [arquero],
      partidos: [vuelta],
    });
    expect(error?.code).toBe("EV100");
    expect(await leerConvocados(servicio, vuelta)).toEqual([arquero, campo[0]!].sort());
  });

  it.skipIf(!conDosFactores)("una Convocatoria de un Partido que todavía no cerró se sigue corrigiendo", async () => {
    const lejos = await crearPartido(SELECCION, new Date(Date.UTC(2035, 10, 20, 23)));
    const { data: id, error } = await convocar(admin!.cliente, [arquero], [lejos]);
    expect(error).toBeNull();
    const corregida = await admin!.cliente.rpc("guardar_convocatoria", { convocatoria: id!, jugadores: [campo[0]!], partidos: [lejos] });
    expect(corregida.error).toBeNull();
    expect(await leerConvocados(servicio, lejos)).toEqual([campo[0]!]);
  });
});

describe("el resultado de la Selección sigue inmutable", () => {
  it("ni la service role ni el Admin con 2FA cambian las apariciones congeladas", async () => {
    const antes = await resultado(ida);
    const upd = await servicio.from("resultado_votacion").update({ apariciones: null }).eq("partido_id", ida);
    expect(upd.error).not.toBeNull();
    const del = await servicio.from("resultado_votacion").delete().eq("partido_id", ida);
    expect(del.error).not.toBeNull();
    if (admin) {
      const updAdmin = await admin.cliente.from("resultado_votacion").update({ apariciones: null }).eq("partido_id", ida).select();
      expect(updAdmin.data ?? []).toEqual([]);
    }
    expect(await resultado(ida)).toEqual(antes);
  });
});

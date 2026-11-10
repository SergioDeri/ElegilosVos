// Tests del ticket 12 del feature Selección: compartir en la Selección.
//
// - "Mi 11" de la Selección se arma con el cliente del usuario: un Hincha de
//   Peñarol, uno de Nacional y uno sin Club obtienen la suya y ninguno la de
//   otro, aunque pase el id del dueño.
// - El 11 Elegido de la Selección (público, con service role) sale solo de un
//   resultado `con_once`, con nombres completos sin número y el destacado: el
//   Gran Ausente final con Convocatoria, el Más Pedido sin ella. Sin datos de
//   Hinchas.
//
// Escenario en 2007 (Votaciones cerradas para la base). Los Partidos y la
// Convocatoria se borran al final con la service role.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SELECCION } from "@/domain/comun/tipos";
import { modeloMiAlineacion, modeloOnceElegido } from "@/lib/compartir/datos";
import { creadorDePartidos, guardarConServicio, jugadoresDisponibles, once433, puestos433 } from "./datos";
import { borrarUsuario, clienteAnonimo, clienteComo, clienteServicio, crearUsuario, usuario } from "./helpers";

vi.mock("server-only", () => ({}));

const servicio = clienteServicio();
const partidos: string[] = [];
const convocatorias: string[] = [];
const crearPartido = creadorDePartidos(partidos, { creadoEn: "2007-01-01T00:00:00Z" });
const sinClub = await crearUsuario({ club: null });

let conConvocatoria = ""; // c10 no convocado y elegido: Gran Ausente final.
let sinConvocatoria = ""; // Más Pedido.
let todosConvocados = ""; // Convocatoria sin ningún no convocado elegido: sin destacado.
let sinAlineaciones = "";
let arquero = "";
let campo: string[] = [];
const nombres = new Map<string, string>();

const hinchas = () => [usuario("hinchaPenarol").id, usuario("hinchaNacional").id, sinClub.id];

beforeAll(async () => {
  ({ arquero, campo } = await jugadoresDisponibles(SELECCION));
  const { data, error } = await servicio.from("jugador").select("id, nombre").eq("club_id", SELECCION);
  if (error) throw error;
  for (const j of data) nombres.set(j.id, j.nombre);

  conConvocatoria = await crearPartido(SELECCION, "2007-03-10T22:00:00Z");
  sinConvocatoria = await crearPartido(SELECCION, "2007-03-17T22:00:00Z");
  todosConvocados = await crearPartido(SELECCION, "2007-03-24T22:00:00Z");
  sinAlineaciones = await crearPartido(SELECCION, "2007-03-31T22:00:00Z");

  const once = once433(arquero, campo);
  const enElOnce = once.map((a) => a.jugadorId);
  const afuera = campo[10]!; // elegido en dos de tres Alineaciones, no está en el 11
  // Cada Hincha guarda su Alineación del primer Partido (dos con `afuera` en lugar del delantero).
  for (const [i, hincha] of hinchas().entries()) {
    const puestos = puestos433(arquero, i === 0 ? campo : [...campo.slice(0, 9), afuera], "2007-03-05T12:00:00Z");
    await guardarConServicio(hincha, conConvocatoria, { esquema: "4-3-3", esquemaModificadoEn: "2007-03-05T12:00:00Z", puestos });
  }

  for (const [partido, convocados] of [
    [conConvocatoria, enElOnce],
    [todosConvocados, [...enElOnce, afuera]],
  ] as const) {
    const { data: id, error: e } = await servicio.rpc("guardar_convocatoria", {
      convocatoria: null as never,
      jugadores: [...convocados],
      partidos: [partido],
    });
    if (e) throw e;
    convocatorias.push(id);
  }

  const apariciones = {
    alineaciones: 3,
    porJugador: [...new Set([...enElOnce, afuera])].map((jugadorId) => ({
      jugadorId,
      apariciones: jugadorId === afuera ? 2 : jugadorId === enElOnce[10] ? 1 : 3,
    })),
  };
  const conOnce = (partido_id: string, cierre: string) => ({
    partido_id,
    estado: "con_once" as const,
    esquema: "4-3-3",
    once: once.map((a) => ({ ...a, origen: "votos", votos: 3 })),
    alineaciones_que_cuentan: 3,
    apariciones,
    cierre,
  });
  const resultados = await servicio.from("resultado_votacion").insert([
    conOnce(conConvocatoria, "2007-03-10T21:00:00Z"),
    conOnce(sinConvocatoria, "2007-03-17T21:00:00Z"),
    conOnce(todosConvocados, "2007-03-24T21:00:00Z"),
    {
      partido_id: sinAlineaciones,
      estado: "sin_alineaciones",
      alineaciones_que_cuentan: 0,
      apariciones: { alineaciones: 0, porJugador: [] },
      cierre: "2007-03-31T21:00:00Z",
    },
  ]);
  if (resultados.error) throw resultados.error;
}, 60_000);

afterAll(async () => {
  if (partidos.length) await servicio.from("partido").delete().in("id", partidos);
  if (convocatorias.length) await servicio.from("convocatoria").delete().in("id", convocatorias);
  await borrarUsuario(sinClub.id);
});

describe("imagen de Mi 11 de la Selección", () => {
  it("un Hincha de cada Club y uno sin Club obtienen la suya, con nombres completos y sin número", async () => {
    const clientes = [clienteComo("hinchaPenarol"), clienteComo("hinchaNacional"), sinClub.cliente];
    for (const [i, hincha] of hinchas().entries()) {
      const modelo = await modeloMiAlineacion(clientes[i]!, hincha, conConvocatoria);
      expect(modelo).not.toBeNull();
      expect(modelo!.titulo).toBe("Mi 11");
      expect(modelo!.club).toBe("Selección");
      expect(modelo!.clubId).toBe(SELECCION);
      expect(modelo!.destacado).toBeNull();
      expect(modelo!.puestos).toHaveLength(11);
      for (const p of modelo!.puestos) {
        expect(p.numero).toBeNull();
        expect([...nombres.values()]).toContain(p.nombre);
        expect(p.renglones.join(" ")).toBe(p.nombre);
      }
    }
  });

  it("ninguno obtiene la Alineación de otro, aunque pase el id del dueño", async () => {
    const [penarol, nacional, solo] = hinchas() as [string, string, string];
    expect(await modeloMiAlineacion(clienteComo("hinchaNacional"), penarol, conConvocatoria)).toBeNull();
    expect(await modeloMiAlineacion(sinClub.cliente, nacional, conConvocatoria)).toBeNull();
    expect(await modeloMiAlineacion(clienteComo("hinchaPenarol"), solo, conConvocatoria)).toBeNull();
    await expect(modeloMiAlineacion(clienteAnonimo(), penarol, conConvocatoria)).rejects.toMatchObject({ code: "42501" });
  });

  it("sin Alineación para el Partido no hay imagen", async () => {
    expect(await modeloMiAlineacion(sinClub.cliente, sinClub.id, sinConvocatoria)).toBeNull();
  });
});

describe("imagen del 11 Elegido de la Selección", () => {
  it("lleva los nombres completos sin número y al Gran Ausente final, sin datos de Hinchas", async () => {
    const modelo = await modeloOnceElegido(servicio, conConvocatoria);
    expect(modelo).not.toBeNull();
    expect(modelo!.titulo).toBe("El 11 Elegido por la hinchada");
    expect(modelo!.club).toBe("Selección");
    expect(modelo!.clubId).toBe(SELECCION);
    for (const p of modelo!.puestos) {
      expect(p.numero).toBeNull();
      expect(p.renglones.join(" ")).toBe(p.nombre);
    }
    expect(modelo!.puestos.map((p) => p.nombre)).toEqual(once433(arquero, campo).map((a) => nombres.get(a.jugadorId!)));
    expect(modelo!.destacado).toEqual({
      titulo: "Gran Ausente final",
      jugadores: [{ nombre: nombres.get(campo[10]!), porcentaje: "66,7 %" }],
    });

    const texto = JSON.stringify(modelo);
    for (const id of [...hinchas(), usuario("admin").id]) expect(texto).not.toContain(id);
    expect(texto).not.toMatch(/hincha_id|alineaciones|votos|email|apariciones/i);
    expect(Object.keys(modelo!).sort()).toEqual(
      ["alt", "club", "clubId", "destacado", "esquema", "esquemaId", "fecha", "nombreArchivo", "partido", "puestos", "rival", "titulo"].sort(),
    );
  });

  it("sin Convocatoria destaca al Más Pedido", async () => {
    const modelo = await modeloOnceElegido(servicio, sinConvocatoria);
    expect(modelo!.destacado?.titulo).toBe("Más Pedido");
    const masPedidos = once433(arquero, campo)
      .slice(0, 10)
      .map((a) => nombres.get(a.jugadorId!));
    expect(modelo!.destacado!.jugadores.map((j) => j.nombre).sort()).toEqual(masPedidos.sort());
    expect(modelo!.destacado!.jugadores.every((j) => j.porcentaje === "100 %")).toBe(true);
  });

  it("con Convocatoria y ningún no convocado elegido no destaca a nadie", async () => {
    expect((await modeloOnceElegido(servicio, todosConvocados))!.destacado).toBeNull();
  });

  it("no hay imagen con un estado distinto de con_once", async () => {
    expect(await modeloOnceElegido(servicio, sinAlineaciones)).toBeNull();
  });
});

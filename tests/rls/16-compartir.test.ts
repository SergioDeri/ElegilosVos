// Tests del ticket 16: datos de las imágenes para compartir.
//
// - "Mi 11" se arma con el cliente del usuario: nadie obtiene la Alineación de
//   otro Hincha, aunque pase el id del dueño.
// - El 11 Elegido (público, con service role) solo sale de un resultado
//   `con_once` y no lleva datos de Hinchas.
//
// Escenario en 2002 (Votaciones cerradas para la base). Los Partidos se borran
// al final con la service role (Alineaciones y resultados en cascada).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { numeroDeClubDeLaBase } from "@/domain/comun/tipos";
import { modeloMiAlineacion, modeloOnceElegido } from "@/lib/compartir/datos";
import { creadorDePartidos, once433, puestos433 } from "./datos";
import { borrarUsuario, clienteAnonimo, clienteComo, clienteServicio, crearUsuario, usuario } from "./helpers";

vi.mock("server-only", () => ({}));

const creados: string[] = [];
let otroHinchaPenarol: Awaited<ReturnType<typeof crearUsuario>> | null = null;

let conOnce: string;
let sinAlineaciones: string;
let sinResultado: string;
let jugadores: { id: string; nombre: string; numero: number; posicion_natural: string }[];

const crearPartido = creadorDePartidos(creados, { creadoEn: "2002-01-01T00:00:00Z" });

beforeAll(async () => {
  const servicio = clienteServicio();
  const { data, error } = await servicio
    .from("jugador")
    .select("id, nombre, numero, posicion_natural")
    .eq("club_id", "penarol")
    .eq("en_plantel", true)
    .order("numero");
  if (error) throw error;
  jugadores = data.map((j) => ({ ...j, numero: numeroDeClubDeLaBase(j.numero) }));

  conOnce = await crearPartido("penarol", "2002-03-10T22:00:00Z");
  sinAlineaciones = await crearPartido("penarol", "2002-03-17T22:00:00Z");
  sinResultado = await crearPartido("penarol", "2002-03-24T22:00:00Z");

  // 4-3-3 con el arquero y los primeros 10 de campo.
  const arquero = jugadores.find((j) => j.posicion_natural === "ARQ")!.id;
  const campo = jugadores.filter((j) => j.posicion_natural !== "ARQ").map((j) => j.id);
  const once = once433(arquero, campo);
  const puestos = puestos433(arquero, campo, "2002-03-05T12:00:00Z");
  const alineacion = await servicio.from("alineacion").insert({
    hincha_id: usuario("hinchaPenarol").id,
    partido_id: conOnce,
    esquema: "4-3-3",
    esquema_elegido_a_mano: true,
    esquema_modificado_en: "2002-03-05T12:00:00Z",
    puestos,
  });
  if (alineacion.error) throw alineacion.error;

  const resultados = await servicio.from("resultado_votacion").insert([
    {
      partido_id: conOnce,
      estado: "con_once",
      esquema: "4-3-3",
      once: once.map((a) => ({ ...a, origen: "votos", votos: 1 })),
      alineaciones_que_cuentan: 1,
      cierre: "2002-03-10T21:00:00Z",
    },
    { partido_id: sinAlineaciones, estado: "sin_alineaciones", alineaciones_que_cuentan: 0, cierre: "2002-03-17T21:00:00Z" },
  ]);
  if (resultados.error) throw resultados.error;

  otroHinchaPenarol = await crearUsuario({ club: "penarol" });
});

afterAll(async () => {
  if (otroHinchaPenarol) await borrarUsuario(otroHinchaPenarol.id);
  if (creados.length) {
    const { error } = await clienteServicio().from("partido").delete().in("id", creados);
    if (error) throw error;
  }
});

describe("imagen de Mi 11", () => {
  it("el dueño obtiene su Alineación con Club, Rival, fecha, Esquema y Jugadores por Puesto", async () => {
    const modelo = await modeloMiAlineacion(clienteComo("hinchaPenarol"), usuario("hinchaPenarol").id, conOnce);
    expect(modelo).not.toBeNull();
    expect(modelo!.titulo).toBe("Mi 11");
    expect(modelo!.club).toBe("Peñarol");
    expect(modelo!.rival).not.toBe("");
    expect(modelo!.fecha).toContain("2002");
    expect(modelo!.esquema).toBe("4-3-3");
    expect(modelo!.puestos).toHaveLength(11);
    expect(modelo!.puestos.every((p) => p.nombre !== null && p.numero !== null)).toBe(true);
  });

  it("otro Hincha del mismo Club no obtiene la Alineación ajena, aunque pase el id del dueño", async () => {
    const modelo = await modeloMiAlineacion(otroHinchaPenarol!.cliente, usuario("hinchaPenarol").id, conOnce);
    expect(modelo).toBeNull();
  });

  it("un Hincha de otro Club ni un invitado la obtienen", async () => {
    const dueno = usuario("hinchaPenarol").id;
    expect(await modeloMiAlineacion(clienteComo("hinchaNacional"), dueno, conOnce)).toBeNull();
    // Sin sesión la base ni siquiera da permiso sobre la tabla (la ruta responde 401 antes).
    await expect(modeloMiAlineacion(clienteAnonimo(), dueno, conOnce)).rejects.toMatchObject({ code: "42501" });
  });

  it("sin Alineación para el Partido no hay imagen", async () => {
    expect(await modeloMiAlineacion(clienteComo("hinchaPenarol"), usuario("hinchaPenarol").id, sinResultado)).toBeNull();
  });
});

describe("imagen del 11 Elegido", () => {
  it("sale del resultado con_once, sin datos de Hinchas", async () => {
    const modelo = await modeloOnceElegido(clienteServicio(), conOnce);
    expect(modelo).not.toBeNull();
    expect(modelo!.titulo).toBe("El 11 Elegido por la hinchada");
    expect(modelo!.esquema).toBe("4-3-3");
    expect(modelo!.puestos.every((p) => p.nombre !== null)).toBe(true);
    expect(modelo!.destacado).toBeNull(); // el destacado es solo de la Selección

    const texto = JSON.stringify(modelo);
    for (const nombre of ["hinchaPenarol", "hinchaNacional", "admin"] as const) {
      expect(texto).not.toContain(usuario(nombre).id);
      expect(texto).not.toContain(usuario(nombre).email);
    }
    expect(texto).not.toMatch(/hincha_id|alineaciones|votos|email/i);
    // Solo los campos del modelo (lista blanca). clubId y esquemaId (ticket 04
    // de diseño pixel) son del Partido y del resultado, no de los Hinchas: la
    // página pública los usa para las Camisetas y la cancha.
    expect(Object.keys(modelo!).sort()).toEqual(
      ["alt", "club", "clubId", "destacado", "esquema", "esquemaId", "fecha", "nombreArchivo", "partido", "puestos", "rival", "titulo"].sort(),
    );
    for (const p of modelo!.puestos) {
      expect(Object.keys(p).sort()).toEqual(["nombre", "numero", "puesto", "renglones", "sigla", "x", "yDesdeArriba"].sort());
    }
  });

  it("no hay imagen sin resultado, con un estado distinto de con_once, ni con un id inválido", async () => {
    const servicio = clienteServicio();
    expect(await modeloOnceElegido(servicio, sinResultado)).toBeNull();
    expect(await modeloOnceElegido(servicio, sinAlineaciones)).toBeNull();
    expect(await modeloOnceElegido(servicio, crypto.randomUUID())).toBeNull();
    expect(await modeloOnceElegido(servicio, "no-es-un-uuid")).toBeNull();
  });
});

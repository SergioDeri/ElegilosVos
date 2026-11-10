// Tests de RLS del ticket 13 del feature Selección: preferencias de
// notificación y avisos de la Selección.
//
// - RLS de `preferencia_notificacion`: cada Hincha lee, crea y cambia solo la
//   suya; anon no accede; cascada al borrar la cuenta.
// - Proceso `enviarNotificaciones` con un envío falso, en un escenario en 2003
//   con una fecha doble de la Selección y una Votación de Peñarol: los avisos
//   respetan "mi club" y "Selección", y un Hincha sin Club recibe solo los de
//   la Selección. Al final se borra todo lo creado y se restauran las
//   preferencias de los usuarios estándar.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SELECCION } from "@/domain/comun/tipos";
import type { MensajePush, SuscripcionPush } from "@/domain/notificaciones";
import { enviarNotificaciones, type EnviarPush } from "@/lib/notificaciones/proceso";
import { creadorDePartidos } from "./datos";
import { borrarUsuario, clienteAnonimo, clienteComo, clienteServicio, crearUsuario, usuario } from "./helpers";

vi.mock("server-only", () => ({}));

const P256DH = "BLlKA3Z0rjh4r1zf9dh0XU7iSiNfRr0KqQSlDWMNASyEcHKazYILP-fa3_o6lOzTbscjdNWJmoyUcBdAlvhGZH8";
const AUTH = "dGqD8bRY8VSDmHmb6-boAQ";
const endpoint = (nombre: string) => `https://push.rls.test/s13-${nombre}/${crypto.randomUUID()}`;

const servicio = clienteServicio();
const ESTANDAR = ["hinchaPenarol", "hinchaNacional"] as const;

async function borrarPreferenciasEstandar() {
  const { error } = await servicio
    .from("preferencia_notificacion")
    .delete()
    .in("hincha_id", ESTANDAR.map((n) => usuario(n).id));
  if (error) throw error;
}

beforeAll(borrarPreferenciasEstandar);
afterAll(borrarPreferenciasEstandar);

describe("preferencia_notificacion: cada Hincha lee y cambia solo la suya", () => {
  it("sin fila guardada el Hincha no lee nada (los dos interruptores prendidos por defecto)", async () => {
    const { data, error } = await clienteComo("hinchaPenarol").from("preferencia_notificacion").select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("la crea a su nombre, con los dos prendidos por defecto, y la cambia", async () => {
    const penarol = clienteComo("hinchaPenarol");
    const { data: creada, error } = await penarol.from("preferencia_notificacion").insert({}).select().single();
    expect(error).toBeNull();
    expect(creada).toMatchObject({ hincha_id: usuario("hinchaPenarol").id, mi_club: true, seleccion: true });

    const { data: cambiada } = await penarol
      .from("preferencia_notificacion")
      .upsert({ mi_club: true, seleccion: false }, { onConflict: "hincha_id" })
      .select();
    expect(cambiada).toMatchObject([{ hincha_id: usuario("hinchaPenarol").id, seleccion: false }]);
  });

  it("otro Hincha no la lee ni la cambia; anon no accede", async () => {
    const nacional = clienteComo("hinchaNacional");
    const { data: leidas } = await nacional.from("preferencia_notificacion").select();
    expect(leidas).toEqual([]);
    const { data: cambiadas } = await nacional
      .from("preferencia_notificacion")
      .update({ seleccion: true })
      .eq("hincha_id", usuario("hinchaPenarol").id)
      .select();
    expect(cambiadas).toEqual([]);
    const { data: anon, error } = await clienteAnonimo().from("preferencia_notificacion").select();
    expect(error ?? anon).toBeTruthy();
    expect(anon ?? []).toEqual([]);
    const { error: errorAnon } = await clienteAnonimo()
      .from("preferencia_notificacion")
      .insert({ hincha_id: usuario("hinchaPenarol").id, seleccion: true });
    expect(errorAnon).not.toBeNull();

    const { data } = await servicio
      .from("preferencia_notificacion")
      .select("seleccion")
      .eq("hincha_id", usuario("hinchaPenarol").id)
      .single();
    expect(data).toEqual({ seleccion: false });
  });

  it("no se crea a nombre de otro Hincha ni se pasa a otro Hincha", async () => {
    const { error } = await clienteComo("hinchaNacional")
      .from("preferencia_notificacion")
      .insert({ hincha_id: usuario("hinchaPenarol").id, mi_club: false });
    expect(error).not.toBeNull();
    const { error: errorDueño } = await clienteComo("hinchaPenarol")
      .from("preferencia_notificacion")
      .update({ hincha_id: usuario("hinchaNacional").id })
      .eq("hincha_id", usuario("hinchaPenarol").id);
    expect(errorDueño).not.toBeNull();
  });

  it("el Hincha no la borra (para apagar un aviso se cambia el interruptor)", async () => {
    const { error } = await clienteComo("hinchaPenarol")
      .from("preferencia_notificacion")
      .delete()
      .eq("hincha_id", usuario("hinchaPenarol").id);
    expect(error).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Proceso de notificaciones (escenario en 2003)
// -----------------------------------------------------------------------------
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2003, 4, 10, 20);
const en = (ms: number) => new Date(T + ms);

describe("proceso de notificaciones: Selección y preferencias", () => {
  const partidos: string[] = [];
  const crearPartido = creadorDePartidos(partidos, { creadoEn: en(-60 * DIA) });
  let sinClub: Awaited<ReturnType<typeof crearUsuario>> | null = null;
  let peru = "";
  let vene = "";
  let pen = "";
  let rival = "";
  const deSinClub = endpoint("sin-club");
  const dePenarol = endpoint("penarol");
  const deNacional = endpoint("nacional");
  const mios = new Set([deSinClub, dePenarol, deNacional]);

  let llamadas: { endpoint: string; mensaje: MensajePush }[] = [];
  const enviar: EnviarPush = async (s: SuscripcionPush, mensaje) => {
    if (mios.has(s.endpoint)) llamadas.push({ endpoint: s.endpoint, mensaje });
    return "ok";
  };
  const recibido = (url: string) =>
    llamadas
      .filter((l) => l.endpoint === url)
      .map((l) => l.mensaje.etiqueta)
      .sort();
  async function correr(ahora: Date) {
    llamadas = [];
    return enviarNotificaciones(servicio, ahora, enviar);
  }

  beforeAll(async () => {
    // Fecha doble: abren 14 días antes de cada inicio (T - 4 días y T + 1 día).
    peru = await crearPartido(SELECCION, en(10 * DIA));
    vene = await crearPartido(SELECCION, en(15 * DIA));
    // Peñarol: abierta desde que se cargó (T - 60 días).
    pen = await crearPartido("penarol", en(7 * DIA));
    const { data } = await servicio.from("partido").select("rival(nombre)").eq("id", peru).single();
    rival = data!.rival!.nombre;

    sinClub = await crearUsuario({ club: null });
    for (const [cliente, url] of [
      [sinClub.cliente, deSinClub],
      [clienteComo("hinchaPenarol"), dePenarol],
      [clienteComo("hinchaNacional"), deNacional],
    ] as const) {
      const { error } = await cliente.rpc("registrar_suscripcion_push", { p_endpoint: url, p_p256dh: P256DH, p_auth: AUTH });
      if (error) throw error;
    }
    // Peñarol apaga la Selección; Nacional apaga "mi club". Sin Club, nada guardado.
    await borrarPreferenciasEstandar();
    for (const [nombre, fila] of [
      ["hinchaPenarol", { mi_club: true, seleccion: false }],
      ["hinchaNacional", { mi_club: false, seleccion: true }],
    ] as const) {
      const { error } = await clienteComo(nombre).from("preferencia_notificacion").insert(fila);
      if (error) throw error;
    }
  });

  afterAll(async () => {
    await servicio.from("suscripcion_push").delete().in("endpoint", [...mios]);
    if (partidos.length) {
      await servicio.from("notificacion_enviada").delete().in("referencia", partidos);
      await servicio.from("partido").delete().in("id", partidos);
    }
    if (sinClub) await borrarUsuario(sinClub.id);
  });

  it("Votación abierta: cada Hincha recibe lo que tiene prendido; el sin Club, solo la Selección", async () => {
    await correr(en(0));
    expect(recibido(deSinClub)).toEqual([`votacion:${peru}`]);
    expect(recibido(dePenarol)).toEqual([`votacion:${pen}`]);
    expect(recibido(deNacional)).toEqual([`votacion:${peru}`]);
    const mensaje = llamadas.find((l) => l.endpoint === deSinClub)!.mensaje;
    expect(mensaje.cuerpo).toContain(rival);
    expect(mensaje.url).toBe(`/seleccion?partido=${peru}`);
  });

  it("fecha doble: al abrir la segunda, un aviso más, sin repetir el primero", async () => {
    await correr(en(2 * DIA));
    expect(recibido(deSinClub)).toEqual([`votacion:${vene}`]);
    expect(recibido(deNacional)).toEqual([`votacion:${vene}`]);
    expect(recibido(dePenarol)).toEqual([]);
  });

  it("cierra pronto: solo el Partido que cierra, una vez", async () => {
    const ahora = en(10 * DIA - 3 * HORA);
    await correr(ahora);
    expect(recibido(deSinClub)).toEqual([`votacion:${peru}`]);
    expect(llamadas.find((l) => l.endpoint === deSinClub)!.mensaje.titulo).toBe(
      "Cierra pronto la Votación de la Selección",
    );
    await correr(ahora);
    expect(llamadas).toEqual([]);

    const { data } = await servicio
      .from("notificacion_enviada")
      .select("tipo, referencia")
      .eq("hincha_id", sinClub!.id)
      .order("enviado_en");
    expect(data!.map((n) => `${n.tipo} ${n.referencia}`).sort()).toEqual(
      [`votacion_abierta ${peru}`, `votacion_abierta ${vene}`, `cierra_pronto ${peru}`].sort(),
    );
  });

  it("borrar la cuenta se lleva sus preferencias (cascada)", async () => {
    const { error } = await sinClub!.cliente.from("preferencia_notificacion").insert({ seleccion: false });
    expect(error).toBeNull();
    await borrarUsuario(sinClub!.id);
    const { count } = await servicio
      .from("preferencia_notificacion")
      .select("hincha_id", { count: "exact", head: true })
      .eq("hincha_id", sinClub!.id);
    expect(count).toBe(0);
    sinClub = null;
  });
});

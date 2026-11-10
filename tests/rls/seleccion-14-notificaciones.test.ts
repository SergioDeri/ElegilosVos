// Tests de integración del ticket 14 del feature Selección: avisos de
// Convocatoria cargada (con el Gran Ausente provisorio) y Gran Ausente final
// (con el 11 Elegido), con el proceso `enviarNotificaciones` y un envío falso.
//
// Escenario en 2005 con una fecha doble de la Selección:
// - la ida tiene Convocatoria con la Votación abierta: aviso de Convocatoria
//   con el Gran Ausente provisorio; al cierre, aviso del Gran Ausente final;
// - la vuelta cierra sin Convocatoria (no se avisa) y el Admin la carga tarde:
//   ahí sale el aviso, sin Gran Ausente porque todos los elegidos están
//   convocados.
// Cada aviso sale una sola vez por Hincha y solo a los que tienen "Selección"
// prendido (con Club o sin Club). Las Convocatorias se cargan con la service
// role para fijar `actualizado_en` en 2005. Al final se borra todo lo creado.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SELECCION } from "@/domain/comun/tipos";
import type { MensajePush, SuscripcionPush } from "@/domain/notificaciones";
import { cerrarVotacionesVencidas } from "@/lib/cierre/proceso";
import { enviarNotificaciones, type EnviarPush } from "@/lib/notificaciones/proceso";
import { creadorDePartidos, guardarConServicio, jugadoresDisponibles } from "./datos";
import { borrarUsuario, clienteComo, clienteServicio, crearUsuario, usuario } from "./helpers";

vi.mock("server-only", () => ({}));

const P256DH = "BLlKA3Z0rjh4r1zf9dh0XU7iSiNfRr0KqQSlDWMNASyEcHKazYILP-fa3_o6lOzTbscjdNWJmoyUcBdAlvhGZH8";
const AUTH = "dGqD8bRY8VSDmHmb6-boAQ";
const endpoint = (nombre: string) => `https://push.rls.test/s14-${nombre}/${crypto.randomUUID()}`;

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2005, 6, 10, 20);
const en = (ms: number) => new Date(T + ms);

const servicio = clienteServicio();
const ESTANDAR = ["hinchaPenarol", "hinchaNacional"] as const;

async function borrarPreferenciasEstandar() {
  const { error } = await servicio
    .from("preferencia_notificacion")
    .delete()
    .in("hincha_id", ESTANDAR.map((n) => usuario(n).id));
  if (error) throw error;
}

describe("proceso de notificaciones: Convocatoria y Gran Ausente final de la Selección", () => {
  const partidos: string[] = [];
  const convocatorias: string[] = [];
  const crearPartido = creadorDePartidos(partidos, { creadoEn: en(-30 * DIA) });
  let sinClub: Awaited<ReturnType<typeof crearUsuario>> | null = null;
  let ida = "";
  let vuelta = "";
  let rival = "";
  let ausente = ""; // nombre del no convocado más elegido en la ida
  let arquero = "";
  let campo: string[] = [];
  const deSinClub = endpoint("sin-club");
  const dePenarol = endpoint("penarol");
  const deNacional = endpoint("nacional");
  const mios = new Set([deSinClub, dePenarol, deNacional]);

  let llamadas: { endpoint: string; mensaje: MensajePush }[] = [];
  const enviar: EnviarPush = async (s: SuscripcionPush, mensaje) => {
    if (mios.has(s.endpoint)) llamadas.push({ endpoint: s.endpoint, mensaje });
    return "ok";
  };
  // Solo los avisos de los Partidos de este escenario.
  const recibido = (url: string) =>
    llamadas
      .filter((l) => l.endpoint === url && partidos.some((p) => l.mensaje.etiqueta.endsWith(p)))
      .map((l) => l.mensaje.etiqueta)
      .sort();
  const mensaje = (url: string, etiqueta: string) =>
    llamadas.find((l) => l.endpoint === url && l.mensaje.etiqueta === etiqueta)!.mensaje;
  async function correr(ahora: Date) {
    llamadas = [];
    return enviarNotificaciones(servicio, ahora, enviar);
  }

  /** Carga la Convocatoria con la service role, con `actualizado_en` en el escenario. */
  async function convocar(jugadores: string[], aplicaA: string[], actualizadoEn: Date) {
    const { data, error } = await servicio
      .from("convocatoria")
      .insert({ creado_en: actualizadoEn.toISOString(), actualizado_en: actualizadoEn.toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    convocatorias.push(data.id);
    const { error: e1 } = await servicio
      .from("convocatoria_jugador")
      .insert(jugadores.map((jugador_id) => ({ convocatoria_id: data.id, jugador_id })));
    if (e1) throw e1;
    const { error: e2 } = await servicio
      .from("convocatoria_partido")
      .insert(aplicaA.map((partido_id) => ({ convocatoria_id: data.id, partido_id })));
    if (e2) throw e2;
  }

  beforeAll(async () => {
    // Fecha doble: la ida abre en T - 14 días y cierra en T - 1 h; la vuelta,
    // de T - 9 días a T + 5 días - 1 h.
    ida = await crearPartido(SELECCION, en(0));
    vuelta = await crearPartido(SELECCION, en(5 * DIA));
    const { data } = await servicio.from("partido").select("rival(nombre)").eq("id", ida).single();
    rival = data!.rival!.nombre;
    ({ arquero, campo } = await jugadoresDisponibles(SELECCION));
    const [c0, c1] = campo as [string, string];
    const { data: jugador } = await servicio.from("jugador").select("nombre").eq("id", c0).single();
    ausente = jugador!.nombre;

    sinClub = await crearUsuario({ club: null });
    const puesto = (jugadorId: string) => ({ jugadorId, modificadoEn: en(-5 * DIA).toISOString() });
    for (const hincha of [sinClub.id, usuario("hinchaNacional").id]) {
      await guardarConServicio(hincha, ida, {
        esquema: "4-3-3",
        esquemaModificadoEn: en(-5 * DIA),
        puestos: { ARQ: puesto(arquero), LI: puesto(c0), LD: puesto(c1) },
      });
    }

    for (const [cliente, url] of [
      [sinClub.cliente, deSinClub],
      [clienteComo("hinchaPenarol"), dePenarol],
      [clienteComo("hinchaNacional"), deNacional],
    ] as const) {
      const { error } = await cliente.rpc("registrar_suscripcion_push", { p_endpoint: url, p_p256dh: P256DH, p_auth: AUTH });
      if (error) throw error;
    }
    // Peñarol apaga la Selección; Nacional y el sin Club, nada guardado (prendido).
    await borrarPreferenciasEstandar();
    const { error } = await clienteComo("hinchaPenarol")
      .from("preferencia_notificacion")
      .insert({ mi_club: true, seleccion: false });
    if (error) throw error;
  }, 60_000);

  afterAll(async () => {
    await servicio.from("suscripcion_push").delete().in("endpoint", [...mios]);
    if (partidos.length) {
      await servicio.from("notificacion_enviada").delete().in("referencia", partidos);
      await servicio.from("partido").delete().in("id", partidos);
    }
    if (convocatorias.length) await servicio.from("convocatoria").delete().in("id", convocatorias);
    await borrarPreferenciasEstandar();
    if (sinClub) await borrarUsuario(sinClub.id);
  });

  it("Convocatoria cargada con la Votación abierta: aviso con el Gran Ausente provisorio, una sola vez", async () => {
    const ahora = en(-3 * DIA);
    // Primero, sin Convocatoria: solo la apertura de las dos Votaciones.
    await correr(ahora);
    expect(recibido(deSinClub)).toEqual([`votacion:${ida}`, `votacion:${vuelta}`].sort());

    // c0 figura en las dos Alineaciones y no está convocado.
    await convocar([arquero, campo[1]!, campo[2]!], [ida], en(-3 * DIA + HORA));
    await correr(en(-3 * DIA + 2 * HORA));
    expect(recibido(deSinClub)).toEqual([`convocatoria:${ida}`]);
    expect(recibido(deNacional)).toEqual([`convocatoria:${ida}`]);
    expect(recibido(dePenarol)).toEqual([]);
    const aviso = mensaje(deSinClub, `convocatoria:${ida}`);
    expect(aviso.titulo).toBe("Salió la Convocatoria de la Selección");
    expect(aviso.cuerpo).toContain(rival);
    expect(aviso.cuerpo).toContain(`Gran Ausente por ahora: ${ausente}`);
    expect(aviso.url).toBe(`/seleccion/parcial?partido=${ida}`);

    await correr(en(-3 * DIA + 3 * HORA));
    expect(recibido(deSinClub)).toEqual([]);
    expect(recibido(deNacional)).toEqual([]);
  });

  it("al cierre con Convocatoria: aviso del 11 Elegido con el Gran Ausente final, una sola vez", async () => {
    const { errores } = await cerrarVotacionesVencidas(servicio, en(HORA));
    expect(errores).toEqual([]);
    await correr(en(2 * HORA));
    expect(recibido(deSinClub)).toEqual([`once:${ida}`]);
    expect(recibido(deNacional)).toEqual([`once:${ida}`]);
    expect(recibido(dePenarol)).toEqual([]);
    const aviso = mensaje(deNacional, `once:${ida}`);
    expect(aviso.titulo).toBe("Salió el 11 Elegido de la Selección");
    expect(aviso.cuerpo).toContain(rival);
    expect(aviso.cuerpo).toContain(`Gran Ausente: ${ausente}`);
    expect(aviso.url).toBe(`/seleccion/resultados/${ida}`);

    await correr(en(3 * HORA));
    expect(recibido(deSinClub)).toEqual([]);
  });

  it("cierre sin Convocatoria: no avisa; cuando el Admin la carga tarde, sale el aviso (sin Gran Ausente si no lo hay)", async () => {
    const { errores } = await cerrarVotacionesVencidas(servicio, en(5 * DIA));
    expect(errores).toEqual([]);
    await correr(en(5 * DIA + HORA));
    expect(recibido(deSinClub)).toEqual([]);

    // Dos días después, la Convocatoria con todos los elegidos en la vuelta (copias de la ida).
    await convocar([arquero, ...campo.slice(0, 3)], [vuelta], en(7 * DIA));
    await correr(en(7 * DIA + HORA));
    expect(recibido(deSinClub)).toEqual([`once:${vuelta}`]);
    expect(recibido(deNacional)).toEqual([`once:${vuelta}`]);
    expect(recibido(dePenarol)).toEqual([]);
    const aviso = mensaje(deSinClub, `once:${vuelta}`);
    expect(aviso.cuerpo).toContain(rival);
    expect(aviso.cuerpo).not.toContain("Gran Ausente");
    expect(aviso.url).toBe(`/seleccion/resultados/${vuelta}`);

    await correr(en(7 * DIA + 2 * HORA));
    expect(recibido(deSinClub)).toEqual([]);

    const { data } = await servicio
      .from("notificacion_enviada")
      .select("tipo, referencia")
      .eq("hincha_id", sinClub!.id)
      .in("referencia", partidos);
    expect(data!.map((n) => `${n.tipo} ${n.referencia}`).sort()).toEqual(
      [
        `votacion_abierta ${ida}`,
        `votacion_abierta ${vuelta}`,
        `convocatoria_cargada ${ida}`,
        `gran_ausente_final ${ida}`,
        `gran_ausente_final ${vuelta}`,
      ].sort(),
    );
  });
});

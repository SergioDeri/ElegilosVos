// Tests del ticket 15: notificaciones push.
//
// - RLS de `suscripcion_push` (cada Hincha solo ve/crea/borra las suyas) y de
//   `notificacion_enviada` (inaccesible por la API); cascada al borrar la cuenta.
// - Proceso `enviarNotificaciones` con un envío falso inyectado, en un
//   escenario en 2001 (Partidos y `ahora` explícito; no toca las Votaciones de
//   hoy). Al final se borra todo lo creado.
// - Ruta de cron: 401 sin secreto; sin claves VAPID no envía.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { esquema } from "@/domain/esquemas";
import type { MensajePush, SuscripcionPush } from "@/domain/notificaciones";
import { cerrarVotacion } from "@/lib/cierre/proceso";
import { enviarNotificaciones, type EnviarPush } from "@/lib/notificaciones/proceso";
import { borrarUsuario, clienteAnonimo, clienteComo, clienteServicio, crearUsuario, usuario } from "./helpers";
import { creadorDePartidos } from "./datos";

vi.mock("server-only", () => ({}));

// Claves con el formato real (P-256 de 65 bytes y auth de 16, en base64url).
const P256DH = "BLlKA3Z0rjh4r1zf9dh0XU7iSiNfRr0KqQSlDWMNASyEcHKazYILP-fa3_o6lOzTbscjdNWJmoyUcBdAlvhGZH8";
const AUTH = "dGqD8bRY8VSDmHmb6-boAQ";
const endpoint = (nombre: string) => `https://push.rls.test/${nombre}/${crypto.randomUUID()}`;

const endpointsCreados: string[] = [];

async function suscribir(nombre: "hinchaPenarol" | "hinchaNacional" | "admin", url: string) {
  endpointsCreados.push(url);
  const { error } = await clienteComo(nombre).rpc("registrar_suscripcion_push", {
    p_endpoint: url,
    p_p256dh: P256DH,
    p_auth: AUTH,
    p_user_agent: "vitest",
  });
  if (error) throw error;
}

afterAll(async () => {
  if (endpointsCreados.length) {
    const { error } = await clienteServicio().from("suscripcion_push").delete().in("endpoint", endpointsCreados);
    if (error) throw error;
  }
});

describe("suscripcion_push: cada Hincha solo accede a las suyas", () => {
  const dePenarol = endpoint("penarol");

  beforeAll(async () => {
    endpointsCreados.push(dePenarol);
    const { error } = await clienteComo("hinchaPenarol")
      .from("suscripcion_push")
      .insert({ endpoint: dePenarol, p256dh: P256DH, auth: AUTH });
    if (error) throw error;
  });

  it("el dueño la lee (con hincha_id de su sesión)", async () => {
    const { data, error } = await clienteComo("hinchaPenarol").from("suscripcion_push").select().eq("endpoint", dePenarol);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]!.hincha_id).toBe(usuario("hinchaPenarol").id);
  });

  it("otro Hincha no la lee ni la borra; anon no accede", async () => {
    const nacional = clienteComo("hinchaNacional");
    const { data } = await nacional.from("suscripcion_push").select().eq("endpoint", dePenarol);
    expect(data).toEqual([]);
    const { data: todas } = await nacional.from("suscripcion_push").select("hincha_id");
    expect(todas!.every((s) => s.hincha_id === usuario("hinchaNacional").id)).toBe(true);
    const { data: borradas } = await nacional.from("suscripcion_push").delete().eq("endpoint", dePenarol).select();
    expect(borradas).toEqual([]);
    const { data: anon, error } = await clienteAnonimo().from("suscripcion_push").select();
    expect(error ?? anon).toBeTruthy();
    expect(anon ?? []).toEqual([]);
    const { count } = await clienteServicio()
      .from("suscripcion_push")
      .select("id", { count: "exact", head: true })
      .eq("endpoint", dePenarol);
    expect(count).toBe(1);
  });

  it("no se puede crear a nombre de otro Hincha ni modificar", async () => {
    const { error } = await clienteComo("hinchaNacional")
      .from("suscripcion_push")
      .insert({ hincha_id: usuario("hinchaPenarol").id, endpoint: endpoint("ajena"), p256dh: P256DH, auth: AUTH });
    expect(error).not.toBeNull();
    const { error: errorUpdate } = await clienteComo("hinchaPenarol")
      .from("suscripcion_push")
      .update({ auth: AUTH })
      .eq("endpoint", dePenarol);
    expect(errorUpdate).not.toBeNull();
  });

  it("la base valida endpoint https y el formato de las claves", async () => {
    const penarol = clienteComo("hinchaPenarol");
    for (const fila of [
      { endpoint: "http://push.rls.test/x", p256dh: P256DH, auth: AUTH },
      { endpoint: endpoint("corta"), p256dh: "abc", auth: AUTH },
      { endpoint: endpoint("corta"), p256dh: P256DH, auth: "abc" },
    ]) {
      const { error } = await penarol.from("suscripcion_push").insert(fila);
      expect(error).not.toBeNull();
    }
  });

  it("el dueño la borra", async () => {
    const { data } = await clienteComo("hinchaPenarol").from("suscripcion_push").delete().eq("endpoint", dePenarol).select();
    expect(data).toHaveLength(1);
  });

  it("registrar_suscripcion_push: idempotente; si el navegador cambia de cuenta, pasa a la de la sesión; anon no", async () => {
    const url = endpoint("compartido");
    await suscribir("hinchaPenarol", url);
    await suscribir("hinchaPenarol", url);
    await suscribir("hinchaNacional", url);
    const { data } = await clienteServicio().from("suscripcion_push").select("hincha_id").eq("endpoint", url);
    expect(data).toEqual([{ hincha_id: usuario("hinchaNacional").id }]);
    const { error } = await clienteAnonimo().rpc("registrar_suscripcion_push", {
      p_endpoint: endpoint("anon"),
      p_p256dh: P256DH,
      p_auth: AUTH,
    });
    expect(error).not.toBeNull();
    await clienteServicio().from("suscripcion_push").delete().eq("endpoint", url);
  });
});

describe("notificacion_enviada: sin acceso por la API", () => {
  it("ni leer ni escribir", async () => {
    for (const cliente of [clienteComo("hinchaPenarol"), clienteAnonimo()]) {
      const { data, error } = await cliente.from("notificacion_enviada").select();
      expect(error ?? data).toBeTruthy();
      expect(data ?? []).toEqual([]);
      const { error: errorInsert } = await cliente.from("notificacion_enviada").insert({
        hincha_id: usuario("hinchaPenarol").id,
        tipo: "votacion_abierta",
        referencia: crypto.randomUUID(),
      });
      expect(errorInsert).not.toBeNull();
    }
  });
});

describe("borrado de cuenta", () => {
  it("se lleva sus suscripciones y su registro de enviados (cascada)", async () => {
    const descartable = await crearUsuario({ club: "penarol" });
    try {
      const { error } = await descartable.cliente
        .from("suscripcion_push")
        .insert({ endpoint: endpoint("descartable"), p256dh: P256DH, auth: AUTH });
      expect(error).toBeNull();
      const servicio = clienteServicio();
      await servicio
        .from("notificacion_enviada")
        .insert({ hincha_id: descartable.id, tipo: "votacion_abierta", referencia: crypto.randomUUID() });
    } finally {
      await borrarUsuario(descartable.id);
    }
    const servicio = clienteServicio();
    const { count: suscripciones } = await servicio
      .from("suscripcion_push")
      .select("id", { count: "exact", head: true })
      .eq("hincha_id", descartable.id);
    const { count: enviadas } = await servicio
      .from("notificacion_enviada")
      .select("hincha_id", { count: "exact", head: true })
      .eq("hincha_id", descartable.id);
    expect(suscripciones).toBe(0);
    expect(enviadas).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// Proceso de notificaciones (escenario en 2001)
// -----------------------------------------------------------------------------
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2001, 2, 10, 20);
const en = (ms: number) => new Date(T + ms);

describe("proceso de notificaciones", () => {
  const partidos: string[] = [];
  const eventos: string[] = [];
  let pA = ""; // Peñarol, ya cerrado con 11 Elegido.
  let pB = ""; // Peñarol, Votación abierta desde T + 2 h hasta T + 5 días - 1 h.
  let nB = ""; // Nacional, Votación abierta en la misma ventana.
  let jugadorX = ""; // En la Alineación de hinchaPenarol para pB.
  const okPenarol = endpoint("ok-penarol");
  const vencidaPenarol = endpoint("vencida-penarol");
  const okNacional = endpoint("ok-nacional");
  const mios = new Set([okPenarol, vencidaPenarol, okNacional]);

  let llamadas: { endpoint: string; mensaje: MensajePush }[] = [];
  const enviar: EnviarPush = async (s: SuscripcionPush, mensaje) => {
    if (mios.has(s.endpoint)) llamadas.push({ endpoint: s.endpoint, mensaje });
    return s.endpoint.includes("/vencida-") ? "vencida" : "ok";
  };
  const recibido = (url: string) =>
    llamadas
      .filter((l) => l.endpoint === url)
      .map((l) => l.mensaje.etiqueta)
      .sort();
  async function correr(ahora: Date) {
    llamadas = [];
    return enviarNotificaciones(clienteServicio(), ahora, enviar);
  }

  const crearPartido = creadorDePartidos(partidos, { creadoEn: en(-30 * DIA) });

  async function guardarAlineacion(hinchaId: string, partidoId: string, jugadores: string[]) {
    const puestos = Object.fromEntries(
      esquema("4-3-3").puestos.map((p, i) => [p.id, { jugadorId: jugadores[i]!, modificadoEn: en(-DIA).toISOString() }]),
    );
    const { error } = await clienteServicio().from("alineacion").insert({
      hincha_id: hinchaId,
      partido_id: partidoId,
      esquema: "4-3-3",
      esquema_elegido_a_mano: true,
      esquema_modificado_en: en(-DIA).toISOString(),
      puestos,
    });
    if (error) throw error;
  }

  beforeAll(async () => {
    pA = await crearPartido("penarol", en(0));
    pB = await crearPartido("penarol", en(5 * DIA));
    await crearPartido("nacional", en(0));
    nB = await crearPartido("nacional", en(5 * DIA));

    const { data: plantel, error } = await clienteServicio()
      .from("jugador")
      .select("id, posicion_natural")
      .eq("club_id", "penarol")
      .eq("en_plantel", true)
      .eq("disponibilidad", "disponible")
      .order("numero");
    if (error) throw error;
    const once = [
      plantel.find((j) => j.posicion_natural === "ARQ")!.id,
      ...plantel.filter((j) => j.posicion_natural !== "ARQ").map((j) => j.id),
    ];
    jugadorX = once[1]!;
    await guardarAlineacion(usuario("hinchaPenarol").id, pA, once);
    await guardarAlineacion(usuario("hinchaPenarol").id, pB, once);
    expect(await cerrarVotacion(clienteServicio(), pA, en(-HORA))).toMatchObject({ estado: "con_once", creado: true });

    await suscribir("hinchaPenarol", okPenarol);
    await suscribir("hinchaPenarol", vencidaPenarol);
    await suscribir("hinchaNacional", okNacional);
  });

  afterAll(async () => {
    const servicio = clienteServicio();
    await servicio.from("jugador").update({ disponibilidad: "disponible", motivo_disponibilidad: null }).eq("id", jugadorX);
    const referencias = [...partidos, ...eventos];
    if (referencias.length) await servicio.from("notificacion_enviada").delete().in("referencia", referencias);
    if (eventos.length) await servicio.from("evento_disponibilidad").delete().in("id", eventos);
    if (partidos.length) {
      const { error } = await servicio.from("partido").delete().in("id", partidos);
      if (error) throw error;
    }
  });

  it("abrió la Votación y salió el 11 Elegido: a cada Hincha lo de su Club; limpia la suscripción vencida (410)", async () => {
    const resumen = await correr(en(3 * HORA));
    expect(recibido(okPenarol)).toEqual([`once:${pA}`, `votacion:${pB}`]);
    expect(llamadas.find((l) => l.mensaje.etiqueta === `once:${pA}`)!.mensaje.url).toBe(`/resultados/${pA}`);
    expect(recibido(okNacional)).toEqual([`votacion:${nB}`]);
    expect(resumen).toMatchObject({ avisos: 3, suscripcionesBorradas: 1 });

    const { data } = await clienteServicio().from("suscripcion_push").select("endpoint").in("endpoint", [...mios]);
    expect(data!.map((s) => s.endpoint).sort()).toEqual([okNacional, okPenarol].sort());

    const { data: registro } = await clienteServicio()
      .from("notificacion_enviada")
      .select("hincha_id, tipo, referencia")
      .in("referencia", partidos);
    expect(registro).toHaveLength(3);
  });

  it("correrlo otra vez no reenvía nada", async () => {
    const resumen = await correr(en(4 * HORA));
    expect(llamadas).toEqual([]);
    expect(resumen).toMatchObject({ avisos: 0, enviados: 0 });
  });

  it("jugador tuyo no disponible: avisa solo a quien lo tiene en su Alineación de la Votación abierta", async () => {
    const servicio = clienteServicio();
    // El cambio real (ahora, no en 2001) queda fuera de la ventana del escenario;
    // el evento del escenario se inserta a mano con su hora.
    await servicio.from("jugador").update({ disponibilidad: "lesionado", motivo_disponibilidad: "test 15" }).eq("id", jugadorX);
    const { data: evento, error } = await servicio
      .from("evento_disponibilidad")
      .insert({
        jugador_id: jugadorX,
        club_id: "penarol",
        disponibilidad_anterior: "disponible",
        disponibilidad_nueva: "lesionado",
        momento: en(4 * HORA).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    eventos.push(evento.id);

    await correr(en(5 * HORA));
    expect(recibido(okPenarol)).toEqual([`no_disponible:${jugadorX}`]);
    expect(llamadas[0]!.mensaje.titulo).toContain("lesionado");
    expect(recibido(okNacional)).toEqual([]);

    const { data: registro } = await servicio.from("notificacion_enviada").select("hincha_id, tipo").eq("referencia", evento.id);
    expect(registro).toEqual([{ hincha_id: usuario("hinchaPenarol").id, tipo: "jugador_no_disponible" }]);
  });

  it("cierra pronto: una vez por Hincha aunque dos corridas se pisen", async () => {
    const ahora = en(5 * DIA - 3 * HORA); // 2 horas antes del cierre
    llamadas = [];
    const resumenes = await Promise.all([
      enviarNotificaciones(clienteServicio(), ahora, enviar),
      enviarNotificaciones(clienteServicio(), ahora, enviar),
    ]);
    expect(recibido(okPenarol)).toEqual([`votacion:${pB}`]);
    expect(recibido(okNacional)).toEqual([`votacion:${nB}`]);
    expect(llamadas.every((l) => l.mensaje.titulo === "Cierra pronto la Votación")).toBe(true);
    expect(resumenes[0]!.avisos + resumenes[1]!.avisos).toBe(2);

    await correr(ahora);
    expect(llamadas).toEqual([]);
  });
});

describe("ruta de cron /api/cron/notificaciones", () => {
  async function llamar(headers: Record<string, string>, secreto: string | undefined) {
    const nombres = ["CRON_SECRET", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;
    const anteriores = nombres.map((n) => process.env[n]);
    for (const n of nombres) delete process.env[n];
    if (secreto !== undefined) process.env.CRON_SECRET = secreto;
    try {
      const { GET } = await import("@/app/api/cron/notificaciones/route");
      return await GET(new Request("http://localhost/api/cron/notificaciones", { headers }));
    } finally {
      nombres.forEach((n, i) => {
        if (anteriores[i] === undefined) delete process.env[n];
        else process.env[n] = anteriores[i];
      });
    }
  }

  it("responde 401 sin el secreto, con uno equivocado o sin CRON_SECRET configurado", async () => {
    expect((await llamar({}, "s3creto")).status).toBe(401);
    expect((await llamar({ authorization: "Bearer otro" }, "s3creto")).status).toBe(401);
    expect((await llamar({ authorization: "Bearer undefined" }, undefined)).status).toBe(401);
  });

  it("con el secreto pero sin claves VAPID no envía nada (y no falla)", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const respuesta = await llamar({ authorization: "Bearer s3creto" }, "s3creto");
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ salteado: true });
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});

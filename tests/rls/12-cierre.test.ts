// Tests del ticket 12: cierre de Votación y 11 Elegido (`resultado_votacion`).
//
// El escenario vive en 2001 (Partidos y `ahora` explícito): está antes de todo
// Partido del seed, así que no cambia ninguna Votación de hoy, y la base lo ve
// cerrado también con su propio now() (el trigger de inserción lo exige).
// Los Partidos se borran al final con la service role (sus resultados se van
// en cascada: es la única forma de que desaparezcan).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { calcularVotaciones } from "@/domain/calendario";
import { cerrarVotacion, cerrarVotacionesVencidas } from "@/lib/cierre/proceso";
import {
  borrarUsuario,
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  crearAdminConDosFactores,
  usuario,
} from "./helpers";
import { creadorDePartidos, guardarConServicio, jugadoresDisponibles, puestos433 } from "./datos";

vi.mock("server-only", () => ({}));

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const T = Date.UTC(2001, 0, 10, 23);
const en = (ms: number) => new Date(T + ms);

const creados: string[] = [];

const crearPartido = creadorDePartidos(creados, { creadoEn: en(-30 * DIA) });

/** 4-3-3 completo (Esquema elegido a mano 5 días antes de T), con los Puestos en `modificadoEn`. */
function guardar433(hinchaId: string, partidoId: string, arquero: string, campo: string[], modificadoEn: Date) {
  return guardarConServicio(hinchaId, partidoId, {
    esquema: "4-3-3",
    esquemaModificadoEn: en(-5 * DIA),
    puestos: puestos433(arquero, campo, modificadoEn),
  });
}

async function resultado(partidoId: string) {
  const { data, error } = await clienteServicio()
    .from("resultado_votacion")
    .select()
    .eq("partido_id", partidoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

let p1 = ""; // Penarol, con dos Alineaciones.
let p2 = ""; // Penarol, siguiente: hereda las de p1 al cerrar.
let n1 = ""; // Nacional, sin Alineaciones.
let jugadorQueSeLesiona = "";

beforeAll(async () => {
  p1 = await crearPartido("penarol", en(0));
  p2 = await crearPartido("penarol", en(10 * DIA));
  n1 = await crearPartido("nacional", en(0));
  const { arquero, campo } = await jugadoresDisponibles("penarol");
  jugadorQueSeLesiona = campo[0]!;
  await guardar433(usuario("hinchaPenarol").id, p1, arquero, campo, en(-3 * DIA));
  await guardar433(usuario("admin").id, p1, arquero, campo, en(-2 * DIA));
});

afterAll(async () => {
  const servicio = clienteServicio();
  await servicio.from("jugador").update({ disponibilidad: "disponible", motivo_disponibilidad: null }).eq("id", jugadorQueSeLesiona);
  if (creados.length) {
    const { error } = await servicio.from("partido").delete().in("id", creados);
    if (error) throw error;
  }
});

describe("proceso de cierre", () => {
  it("antes de la hora de cierre no genera nada", async () => {
    const r = await cerrarVotacion(clienteServicio(), p1, en(-HORA - 1));
    expect(r).toEqual({ partidoId: p1, estado: null, creado: false });
    expect(await resultado(p1)).toBeNull();
  });

  it("al pasar el cierre congela el 11 Elegido con la Disponibilidad del cierre", async () => {
    // Se lesiona DESPUÉS del cierre (ahora, no en 2001): al cierre estaba Disponible.
    const { error } = await clienteServicio()
      .from("jugador")
      .update({ disponibilidad: "lesionado", motivo_disponibilidad: "test 12" })
      .eq("id", jugadorQueSeLesiona);
    expect(error).toBeNull();

    const r = await cerrarVotacion(clienteServicio(), p1, en(-HORA));
    expect(r).toEqual({ partidoId: p1, estado: "con_once", creado: true });

    const fila = (await resultado(p1))!;
    expect(fila.estado).toBe("con_once");
    expect(fila.esquema).toBe("4-3-3");
    expect(fila.alineaciones_que_cuentan).toBe(2);
    expect(new Date(fila.cierre).getTime()).toBe(en(-HORA).getTime());
    const once = fila.once as { puesto: string; jugadorId: string; votos: number }[];
    expect(once).toHaveLength(11);
    expect(once.every((a) => a.votos === 2)).toBe(true);
    expect(once.map((a) => a.jugadorId)).toContain(jugadorQueSeLesiona);
    expect((fila.detalle as { esquemaGanador: string }).esquemaGanador).toBe("4-3-3");
    // El detalle no tiene datos de Hinchas.
    expect(JSON.stringify(fila.detalle)).not.toContain(usuario("hinchaPenarol").id);
  });

  it("es idempotente: correrlo otra vez no cambia ni duplica el resultado", async () => {
    const antes = await resultado(p1);
    const r = await cerrarVotacion(clienteServicio(), p1, en(DIA));
    expect(r).toEqual({ partidoId: p1, estado: "con_once", creado: false });
    expect(await resultado(p1)).toEqual(antes);
  });

  it("en paralelo, solo una corrida lo crea", async () => {
    const corridas = await Promise.all(
      Array.from({ length: 5 }, () => cerrarVotacion(clienteServicio(), n1, en(DIA))),
    );
    expect(corridas.filter((c) => c.creado)).toHaveLength(1);
    expect(corridas.every((c) => c.estado === "sin_alineaciones")).toBe(true);
    const { data } = await clienteServicio().from("resultado_votacion").select("partido_id").eq("partido_id", n1);
    expect(data).toHaveLength(1);
  });

  it("sin Alineaciones que cuentan queda 'sin_alineaciones', sin 11", async () => {
    const fila = (await resultado(n1))!;
    expect(fila).toMatchObject({ estado: "sin_alineaciones", esquema: null, once: null, alineaciones_que_cuentan: 0 });
  });

  it("cerrarVotacionesVencidas cierra los vencidos (con herencia, anulada y nunca_abrio) y no toca los de hoy", async () => {
    // Cargado después de su propio cierre: su Votación nunca abrió.
    const nuncaAbrio = await crearPartido("nacional", en(20 * DIA), { creadoEn: en(20 * DIA) });
    const cancelado = await crearPartido("nacional", en(25 * DIA), { estado: "cancelado" });
    const futuro2001 = await crearPartido("penarol", en(300 * DIA));
    const { count: antesFuera } = await clienteServicio()
      .from("resultado_votacion")
      .select("partido_id", { count: "exact", head: true })
      .not("partido_id", "in", `(${creados.join(",")})`);

    const ahora = en(30 * DIA);
    const resumen = await cerrarVotacionesVencidas(clienteServicio(), ahora);
    expect(resumen.errores).toEqual([]);
    const porPartido = new Map(resumen.cerrados.map((c) => [c.partidoId, c]));
    expect(porPartido.get(p2)).toEqual({ partidoId: p2, estado: "con_once", creado: true });
    expect(porPartido.get(nuncaAbrio)).toEqual({ partidoId: nuncaAbrio, estado: "nunca_abrio", creado: true });
    expect(porPartido.get(cancelado)).toEqual({ partidoId: cancelado, estado: "anulada", creado: true });
    expect(porPartido.has(p1)).toBe(false); // ya tenía resultado
    expect(porPartido.has(futuro2001)).toBe(false); // todavía no cerró en `ahora`
    expect(await resultado(futuro2001)).toBeNull();
    // p2 contó las Alineaciones heredadas de p1 (materializadas antes del cierre).
    expect((await resultado(p2))!.alineaciones_que_cuentan).toBe(2);

    const { count: despuesFuera } = await clienteServicio()
      .from("resultado_votacion")
      .select("partido_id", { count: "exact", head: true })
      .not("partido_id", "in", `(${creados.join(",")})`);
    expect(despuesFuera).toBe(antesFuera);

    // Segunda corrida: nada nuevo.
    const otra = await cerrarVotacionesVencidas(clienteServicio(), ahora);
    expect(otra.cerrados.filter((c) => creados.includes(c.partidoId))).toEqual([]);
  });

  it("la base no congela un resultado de una Votación que no cerró", async () => {
    const enElFuturo = await crearPartido("penarol", new Date(Date.UTC(2099, 0, 1)));
    const { error } = await clienteServicio()
      .from("resultado_votacion")
      .insert({ partido_id: enElFuturo, estado: "sin_alineaciones", cierre: new Date(Date.UTC(2099, 0, 1)).toISOString() });
    expect(error).not.toBeNull();
  });
});

describe("resultado_votacion: inmutable y solo lectura del propio Club", () => {
  it("el Hincha del Club lo lee; el del otro Club y anon no", async () => {
    const { data: propio } = await clienteComo("hinchaPenarol").from("resultado_votacion").select("partido_id").eq("partido_id", p1);
    expect(propio).toHaveLength(1);
    const { data: ajeno } = await clienteComo("hinchaNacional").from("resultado_votacion").select("partido_id").eq("partido_id", p1);
    expect(ajeno).toEqual([]);
    const { data: anon } = await clienteAnonimo().from("resultado_votacion").select("partido_id");
    expect(anon ?? []).toEqual([]);
    const { data: nacional } = await clienteComo("hinchaNacional").from("resultado_votacion").select("partido_id").eq("partido_id", n1);
    expect(nacional).toHaveLength(1);
  });

  it("el Admin sin 2FA solo lee los de su Club Favorito", async () => {
    const { data } = await clienteComo("admin").from("resultado_votacion").select("partido_id").eq("partido_id", n1);
    expect(data).toEqual([]);
  });

  it("el Hincha no puede insertar, modificar ni borrar", async () => {
    const hincha = clienteComo("hinchaPenarol");
    const ins = await hincha.from("resultado_votacion").insert({ partido_id: p2, estado: "anulada", cierre: en(0).toISOString() });
    expect(ins.error).not.toBeNull();
    const upd = await hincha.from("resultado_votacion").update({ esquema: "4-4-2" }).eq("partido_id", p1).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await hincha.from("resultado_votacion").delete().eq("partido_id", p1).select();
    expect(del.data ?? []).toEqual([]);
    expect((await resultado(p1))!.esquema).toBe("4-3-3");
  });

  it("el Admin con 2FA lo lee pero no lo puede modificar ni borrar", async (ctx) => {
    const admin = await crearAdminConDosFactores({ club: "nacional" });
    if (!admin) {
      console.warn("TOTP apagado en Supabase local: se saltea el test de Admin AAL2");
      ctx.skip();
      return;
    }
    try {
      const { data: leidos } = await admin.cliente.from("resultado_votacion").select("partido_id").in("partido_id", [p1, n1]);
      expect(leidos).toHaveLength(2);
      const upd = await admin.cliente.from("resultado_votacion").update({ esquema: "4-4-2" }).eq("partido_id", p1).select();
      expect(upd.data ?? []).toEqual([]);
      const del = await admin.cliente.from("resultado_votacion").delete().eq("partido_id", p1).select();
      expect(del.data ?? []).toEqual([]);
      const ins = await admin.cliente.from("resultado_votacion").insert({ partido_id: p2, estado: "anulada", cierre: en(0).toISOString() });
      expect(ins.error).not.toBeNull();

      // Con resultado, el Admin puede postergar o cancelar el Partido (se
      // suspendió en la última hora), pero el resultado queda igual, la
      // Votación no se reabre y el Partido no se borra.
      const postergar = await admin.cliente.from("partido").update({ inicio: en(DIA).toISOString() }).eq("id", p1).select("id");
      expect(postergar.error).toBeNull();
      expect(postergar.data).toHaveLength(1);
      const cancelar = await admin.cliente.from("partido").update({ estado: "cancelado" }).eq("id", p1).select("id");
      expect(cancelar.error).toBeNull();
      expect(cancelar.data).toHaveLength(1);
      const reactivar = await admin.cliente
        .from("partido")
        .update({ estado: "programado", inicio: en(0).toISOString() })
        .eq("id", p1)
        .select("id");
      expect(reactivar.error).toBeNull();
      const borrarConResultado = await admin.cliente.from("partido").delete().eq("id", p1).select();
      expect(borrarConResultado.error).not.toBeNull();
      const borrar = await admin.cliente.from("partido").delete().eq("id", n1).select();
      expect(borrar.error).not.toBeNull();
      const { data: n1Sigue } = await clienteServicio().from("partido").select("id").eq("id", n1);
      expect(n1Sigue).toHaveLength(1);
    } finally {
      await borrarUsuario(admin.id);
    }
    expect((await resultado(p1))!.esquema).toBe("4-3-3");
  });

  it("ni la service role lo puede modificar o borrar directamente", async () => {
    const upd = await clienteServicio().from("resultado_votacion").update({ esquema: "4-4-2" }).eq("partido_id", p1);
    expect(upd.error).not.toBeNull();
    const del = await clienteServicio().from("resultado_votacion").delete().eq("partido_id", p1);
    expect(del.error).not.toBeNull();
    expect((await resultado(p1))!.esquema).toBe("4-3-3");
  });
});

describe("una Votación con resultado queda definitiva aunque se postergue", () => {
  it("la Alineación no se puede crear ni editar aunque el Calendario la vea abierta", async () => {
    // Un Partido de 2001 ya cerrado, con resultado y con una Alineación del Hincha.
    const pasado = await crearPartido("penarol", en(200 * DIA));
    const { arquero, campo } = await jugadoresDisponibles("penarol");
    await guardar433(usuario("hinchaPenarol").id, pasado, arquero, campo, en(150 * DIA));
    const cierre = await cerrarVotacion(clienteServicio(), pasado, en(250 * DIA));
    expect(cierre.creado).toBe(true);

    // El Admin lo posterga: pasa a 1 minuto antes del Partido con la Votación
    // abierta hoy, así que el Calendario lo ve abierto.
    const { data: partidos } = await clienteServicio()
      .from("partido")
      .select("id, inicio, estado, creado_en")
      .eq("club_id", "penarol");
    const abierta = calcularVotaciones(
      partidos!.map((p) => ({ id: p.id, inicio: new Date(p.inicio), estado: p.estado, creadoEn: new Date(p.creado_en) })),
      new Date(),
    ).find((v) => v.estado === "abierta");
    if (!abierta) throw new Error("No hay Votación abierta para penarol: corré npm run db:reset (el seed crea una).");
    const inicioAbierto = abierta.cierra.getTime() + HORA;
    await clienteServicio().from("partido").update({ inicio: new Date(inicioAbierto - 60_000).toISOString() }).eq("id", pasado);

    const { data: votacion } = await clienteServicio().rpc("votacion_de_partido", { partido: pasado }).single();
    expect(votacion!.estado).toBe("abierta");
    const { data: estaAbierta } = await clienteComo("hinchaPenarol").rpc("votacion_abierta", { partido: pasado });
    expect(estaAbierta).toBe(false);

    const hincha = clienteComo("hinchaPenarol");
    const upd = await hincha
      .from("alineacion")
      .update({ puestos: {} })
      .eq("partido_id", pasado)
      .select();
    expect(upd.data ?? []).toEqual([]);

    // Sin la Alineación guardada, tampoco la puede crear.
    await clienteServicio().from("alineacion").delete().eq("partido_id", pasado);
    const ins = await hincha.from("alineacion").insert({ partido_id: pasado, esquema: "4-3-3", puestos: {} });
    expect(ins.error).not.toBeNull();

    // El resultado sigue igual.
    expect((await resultado(pasado))!.estado).toBe("con_once");

    // Limpieza inmediata: deja de interferir con la Votación abierta de hoy.
    await clienteServicio().from("partido").delete().eq("id", pasado);
  });
});

describe("ruta de cron /api/cron/cierre", () => {
  async function llamar(headers: Record<string, string>, secreto: string | undefined) {
    const anterior = process.env.CRON_SECRET;
    if (secreto === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = secreto;
    try {
      const { GET } = await import("@/app/api/cron/cierre/route");
      return await GET(new Request("http://localhost/api/cron/cierre", { headers }));
    } finally {
      if (anterior === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = anterior;
    }
  }

  it("responde 401 sin el secreto", async () => {
    expect((await llamar({}, "s3creto")).status).toBe(401);
  });

  it("responde 401 con un secreto equivocado", async () => {
    expect((await llamar({ authorization: "Bearer otro" }, "s3creto")).status).toBe(401);
    expect((await llamar({ authorization: "s3creto" }, "s3creto")).status).toBe(401);
  });

  it("responde 401 si el servidor no tiene CRON_SECRET configurado", async () => {
    expect((await llamar({ authorization: "Bearer undefined" }, undefined)).status).toBe(401);
    expect((await llamar({ authorization: "Bearer " }, "")).status).toBe(401);
  });
});

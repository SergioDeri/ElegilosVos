// Tests de la corrección A (post code-review):
//
// 1. Herencia: cada Hincha hereda su Alineación MÁS RECIENTE del Club entre
//    los Partidos anteriores no cancelados, aunque el Partido inmediatamente
//    anterior nunca haya abierto (abre >= cierra) o el Hincha no tenga
//    Alineación ahí (ADR-0002: los Hinchas inactivos no pierden su voto).
// 2. Votos del Club anterior: si el Admin cambia el Club Favorito de un
//    Hincha, su Alineación del Club anterior deja de contar (filtro en el
//    conteo) y además `cambiar_club_favorito` la borra si la Votación está
//    abierta.
//
// El escenario de Herencia vive en 2034 (`ahora` explícito); el de conteo usa
// la Votación abierta HOY del seed. Todo lo propio se borra al final.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { votacionAbierta } from "@/domain/calendario";
import type { ClubId } from "@/domain/comun/tipos";
import { materializarHerencias } from "@/lib/herencia/materializar";
import { contarPartido, leerAlineacionesDelPartido } from "@/lib/votacion/conteo";
import { creadorDePartidos } from "./datos";
import { borrarUsuario, clienteServicio, crearAdminConDosFactores, crearUsuario } from "./helpers";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

const partidos: string[] = [];
const usuarios: string[] = [];

// Cada llamada indica su `creado_en`.
const crearPartido = creadorDePartidos(partidos);

async function hincha(club: ClubId) {
  const { id } = await crearUsuario({ club });
  usuarios.push(id);
  return id;
}

type Puestos = Record<string, { jugadorId: string; modificadoEn: string }>;

async function guardar(hinchaId: string, partidoId: string, puestos: Puestos, esquema = "4-4-2") {
  const { error } = await clienteServicio()
    .from("alineacion")
    .upsert({ hincha_id: hinchaId, partido_id: partidoId, esquema, esquema_elegido_a_mano: false, puestos }, { onConflict: "hincha_id,partido_id" });
  if (error) throw error;
}

async function alineacionDe(hinchaId: string, partidoId: string) {
  const { data, error } = await clienteServicio()
    .from("alineacion")
    .select("esquema, puestos")
    .eq("hincha_id", hinchaId)
    .eq("partido_id", partidoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function jugadoresDisponibles(club: ClubId) {
  const { data, error } = await clienteServicio()
    .from("jugador")
    .select("id, posicion_natural")
    .eq("club_id", club)
    .eq("en_plantel", true)
    .eq("disponibilidad", "disponible");
  if (error) throw error;
  return {
    arquero: data.find((x) => x.posicion_natural === "ARQ")!.id,
    def: data.find((x) => x.posicion_natural === "DEF")!.id,
  };
}

afterAll(async () => {
  const servicio = clienteServicio();
  if (partidos.length) await servicio.from("partido").delete().in("id", partidos); // cascada a `alineacion`
  for (const id of usuarios) await borrarUsuario(id); // cascada a sus Alineaciones
});

describe("Herencia: la Alineación más reciente entre los Partidos anteriores no cancelados", () => {
  const T = Date.UTC(2034, 3, 1, 22);
  const en = (ms: number) => new Date(T + ms);
  const creado = en(-10 * DIA);
  /** Durante la Votación de C. */
  const ahora = en(4 * DIA);
  const t1 = en(-5 * DIA).toISOString();
  const t2 = en(-4 * DIA).toISOString();

  let a = "";
  let x = "";
  let b = "";
  let n = "";
  let c = "";
  let inactivo = "";
  let activo = "";
  let soloCancelado = "";
  let j: { arquero: string; def: string };

  beforeAll(async () => {
    j = await jugadoresDisponibles("penarol");
    a = await crearPartido("penarol", en(0), { creadoEn: creado });
    x = await crearPartido("penarol", en(2 * DIA), { creadoEn: creado, estado: "cancelado" });
    b = await crearPartido("penarol", en(3 * DIA), { creadoEn: creado });
    // Empieza 2 h después de B: su ventana es vacía (abre >= cierra), nunca abrió.
    n = await crearPartido("penarol", en(3 * DIA + 2 * HORA), { creadoEn: creado });
    c = await crearPartido("penarol", en(7 * DIA), { creadoEn: creado });

    [inactivo, activo, soloCancelado] = await Promise.all([hincha("penarol"), hincha("penarol"), hincha("penarol")]);
    // Inactivo: votó en A y tenía una en X (cancelado, no cuenta); no volvió.
    await guardar(inactivo, a, { ARQ: { jugadorId: j.arquero, modificadoEn: t1 } }, "4-3-3");
    await guardar(inactivo, x, { LI: { jugadorId: j.def, modificadoEn: t2 } }, "4-4-2");
    // Activo: votó en A y en B: hereda la de B.
    await guardar(activo, a, { ARQ: { jugadorId: j.arquero, modificadoEn: t1 } }, "4-3-3");
    await guardar(activo, b, { LI: { jugadorId: j.def, modificadoEn: t2 } }, "4-4-2");
    // Solo tenía Alineación en el Partido cancelado: no hereda nada.
    await guardar(soloCancelado, x, { ARQ: { jugadorId: j.arquero, modificadoEn: t1 } });
  });

  it("al entrar (un solo Hincha): el inactivo hereda la de A aunque el anterior (N) nunca abrió", async () => {
    const [resultado] = await materializarHerencias(clienteServicio(), ahora, { club: "penarol", hinchaId: inactivo });
    expect(resultado).toEqual({ club: "penarol", partidoId: c, anteriorId: n, creadas: 1 });
    expect(await alineacionDe(inactivo, c)).toEqual({ esquema: "4-3-3", puestos: { ARQ: { jugadorId: j.arquero, modificadoEn: t1 } } });
    expect(await alineacionDe(activo, c)).toBeNull();
  });

  it("el cron hereda a cada Hincha su Alineación más reciente, nunca la de un Partido cancelado", async () => {
    const resultado = await materializarHerencias(clienteServicio(), ahora, { club: "penarol" });
    expect(resultado).toEqual([{ club: "penarol", partidoId: c, anteriorId: n, creadas: 1 }]);
    expect(await alineacionDe(activo, c)).toEqual({ esquema: "4-4-2", puestos: { LI: { jugadorId: j.def, modificadoEn: t2 } } });
    expect(await alineacionDe(soloCancelado, c)).toBeNull();
  });

  it("es idempotente y no hereda a un Hincha que hoy es de otro Club", async () => {
    await clienteServicio().from("alineacion").delete().eq("partido_id", c).eq("hincha_id", inactivo);
    await clienteServicio().from("perfil").update({ club_favorito_id: "nacional" }).eq("id", inactivo);
    for (let i = 0; i < 2; i++) {
      const [resultado] = await materializarHerencias(clienteServicio(), ahora, { club: "penarol" });
      expect(resultado!.creadas).toBe(0);
    }
    expect(await alineacionDe(inactivo, c)).toBeNull();
  });
});

describe("Votos del Club anterior al cambiar el Club Favorito", () => {
  let abierto = "";
  let cerrado = "";
  let j: { arquero: string; def: string };

  beforeAll(async () => {
    const servicio = clienteServicio();
    const { data, error } = await servicio.from("partido").select("id, inicio, estado, creado_en").eq("club_id", "penarol");
    if (error) throw error;
    const abierta = votacionAbierta(
      data.map((p) => ({ id: p.id, inicio: new Date(p.inicio), estado: p.estado, creadoEn: new Date(p.creado_en) })),
      new Date(),
    );
    if (!abierta) throw new Error("No hay Votación abierta para Peñarol: corré npm run db:reset (el seed crea una).");
    abierto = abierta.partidoId;
    // Un Partido de Peñarol ya cerrado (muy en el pasado: no cambia qué Votación está abierta hoy).
    cerrado = await crearPartido("penarol", new Date(Date.UTC(2020, 0, 1, 20)), { creadoEn: new Date(Date.UTC(2019, 11, 1)) });
    j = await jugadoresDisponibles("penarol");
  });

  const puestos = (): Puestos => ({ ARQ: { jugadorId: j.arquero, modificadoEn: new Date().toISOString() } });

  it("el conteo solo cuenta Alineaciones de Hinchas cuyo Club Favorito de hoy es el del Partido", async () => {
    const cambiado = await hincha("penarol");
    await guardar(cambiado, abierto, puestos());
    const antes = await leerAlineacionesDelPartido(clienteServicio(), abierto);
    const conteoAntes = await contarPartido(clienteServicio(), abierto);

    // Cambio directo (sin pasar por la función): la fila sigue en la base.
    const { error } = await clienteServicio().from("perfil").update({ club_favorito_id: "nacional" }).eq("id", cambiado);
    expect(error).toBeNull();
    expect(await alineacionDe(cambiado, abierto)).not.toBeNull();

    const despues = await leerAlineacionesDelPartido(clienteServicio(), abierto);
    expect(despues).toHaveLength(antes.length - 1);
    // Con páginas chicas, igual.
    expect(await leerAlineacionesDelPartido(clienteServicio(), abierto, 1)).toHaveLength(antes.length - 1);
    // Sigue sin exponer quién votó.
    for (const fila of despues) {
      expect(Object.keys(fila).sort()).toEqual(["esquema", "esquema_elegido_a_mano", "esquema_modificado_en", "puestos"]);
    }
    const conteoDespues = await contarPartido(clienteServicio(), abierto);
    expect(conteoDespues!.resultado.alineacionesQueCuentan).toBe(conteoAntes!.resultado.alineacionesQueCuentan - 1);
  });

  it("cambiar_club_favorito borra la Alineación del Club anterior con la Votación abierta (y solo esa)", async () => {
    const admin = await crearAdminConDosFactores();
    if (!admin) return; // TOTP apagado en Supabase local
    usuarios.push(admin.id);
    const movido = await hincha("penarol");
    const testigo = await hincha("penarol");
    await guardar(movido, abierto, puestos());
    await guardar(movido, cerrado, puestos());
    await guardar(testigo, abierto, puestos());

    // Mismo Club: no toca nada.
    const mismo = await admin.cliente.rpc("cambiar_club_favorito", { hincha: movido, club: "penarol" });
    expect(mismo.error).toBeNull();
    expect(await alineacionDe(movido, abierto)).not.toBeNull();

    const { data, error } = await admin.cliente.rpc("cambiar_club_favorito", { hincha: movido, club: "nacional" });
    expect(error).toBeNull();
    expect(data).toBe("nacional");
    expect(await alineacionDe(movido, abierto)).toBeNull();
    // La de una Votación ya cerrada queda (historia), y las de otros Hinchas también.
    expect(await alineacionDe(movido, cerrado)).not.toBeNull();
    expect(await alineacionDe(testigo, abierto)).not.toBeNull();
  });
});

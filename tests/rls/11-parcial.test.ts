// Tests del ticket 11: Parcial en vivo.
//
// - La lectura de Alineaciones para el conteo pagina y lee MÁS de 1000 filas
//   (el límite de filas por pedido de Supabase).
// - El resultado es solo agregado: no contiene ids de Hinchas ni de Alineaciones.
// - Un Hincha no puede pedir el Parcial del otro Club, ni el de una Votación
//   que no está abierta.
//
// Crea ~1000 Hinchas descartables con la service role (sin login), un Partido
// en 2035 (no cambia qué Votación está abierta hoy) y sus Alineaciones; todo se
// borra al final.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parcialParaHincha } from "@/lib/parcial/acceso";
import { contarPartido, leerAlineacionesDelPartido } from "@/lib/votacion/conteo";
import { partidoAbierto } from "./datos";
import { clienteComo, clienteServicio, usuario } from "./helpers";

const PREFIJO_EMAIL = "parcial11.";
const CANTIDAD_433 = 700;
const CANTIDAD_442 = 305;
const CANTIDAD_VACIAS = 3; // sin Jugadores ni Esquema elegido a mano: no cuentan
const TOTAL = CANTIDAD_433 + CANTIDAD_442 + CANTIDAD_VACIAS;
const HORA = "2035-01-01T00:00:00.000Z";

let partidoFuturo = "";
let arqueroA = "";
let arqueroB = "";
const hinchas: string[] = [];
const alineaciones: string[] = [];

async function enParalelo<T>(cantidad: number, concurrencia: number, tarea: (i: number) => Promise<T>): Promise<T[]> {
  const resultados: T[] = new Array(cantidad);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: concurrencia }, async () => {
      while (siguiente < cantidad) {
        const i = siguiente++;
        resultados[i] = await tarea(i);
      }
    }),
  );
  return resultados;
}

async function borrarHinchasDescartables() {
  const servicio = clienteServicio();
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await servicio.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    ids.push(...data.users.filter((u) => u.email?.startsWith(PREFIJO_EMAIL)).map((u) => u.id));
    if (data.users.length < 1000) break;
  }
  await enParalelo(ids.length, 20, async (i) => {
    await servicio.auth.admin.deleteUser(ids[i]!);
  });
}

const calcularConServicio = async (partidoId: string) =>
  (await contarPartido(clienteServicio(), partidoId))?.resultado ?? null;

beforeAll(async () => {
  const servicio = clienteServicio();
  await borrarHinchasDescartables();

  const { data: arqueros, error: errorArqueros } = await servicio
    .from("jugador")
    .select("id")
    .eq("club_id", "penarol")
    .eq("posicion_natural", "ARQ")
    .eq("en_plantel", true)
    .eq("disponibilidad", "disponible")
    .order("numero")
    .limit(2);
  if (errorArqueros) throw errorArqueros;
  if (arqueros.length < 2) throw new Error("El seed necesita dos arqueros Disponibles de Peñarol.");
  [arqueroA, arqueroB] = [arqueros[0]!.id, arqueros[1]!.id];

  const { data: rival } = await servicio.from("rival").select("id").eq("activo", true).limit(1).single();
  const { data: partido, error: errorPartido } = await servicio
    .from("partido")
    .insert({ club_id: "penarol", rival_id: rival!.id, inicio: "2035-06-01T20:00:00Z", creado_en: "2035-05-01T00:00:00Z" })
    .select("id")
    .single();
  if (errorPartido) throw errorPartido;
  partidoFuturo = partido.id;

  const creados = await enParalelo(TOTAL, 20, async (i) => {
    const { data, error } = await servicio.auth.admin.createUser({
      email: `${PREFIJO_EMAIL}${i}.${crypto.randomUUID()}@rls.test`,
      email_confirm: true,
    });
    if (error) throw error;
    return data.user.id;
  });
  hinchas.push(...creados);
  // Hinchas de Peñarol: el conteo solo cuenta a los del Club del Partido (corrección A).
  for (let i = 0; i < hinchas.length; i += 100) {
    const { error } = await servicio.from("perfil").update({ club_favorito_id: "penarol" }).in("id", hinchas.slice(i, i + 100));
    if (error) throw error;
  }

  // Todas las filas con las mismas columnas (el insert masivo completa las que faltan con null).
  const filas = hinchas.map((hincha_id, i) => {
    const es442 = i >= CANTIDAD_433 && i < CANTIDAD_433 + CANTIDAD_442;
    const vacia = i >= CANTIDAD_433 + CANTIDAD_442;
    return {
      hincha_id,
      partido_id: partidoFuturo,
      esquema: es442 ? "4-4-2" : "4-3-3",
      esquema_elegido_a_mano: es442,
      esquema_modificado_en: es442 ? HORA : null,
      puestos: vacia ? {} : { ARQ: { jugadorId: es442 ? arqueroB : arqueroA, modificadoEn: HORA } },
    };
  });
  for (let i = 0; i < filas.length; i += 500) {
    const { data, error } = await servicio.from("alineacion").insert(filas.slice(i, i + 500)).select("id");
    if (error) throw error;
    alineaciones.push(...data.map((a) => a.id));
  }
}, 240_000);

afterAll(async () => {
  if (partidoFuturo) await clienteServicio().from("partido").delete().eq("id", partidoFuturo);
  await borrarHinchasDescartables();
}, 240_000);

describe("lectura de Alineaciones para el conteo", () => {
  it(`lee las ${TOTAL} Alineaciones del Partido (más de 1000: pagina)`, async () => {
    expect(TOTAL).toBeGreaterThan(1000);
    const filas = await leerAlineacionesDelPartido(clienteServicio(), partidoFuturo);
    expect(filas).toHaveLength(TOTAL);
  });

  it("con páginas chicas tampoco repite ni saltea filas", async () => {
    const filas = await leerAlineacionesDelPartido(clienteServicio(), partidoFuturo, 333);
    expect(filas).toHaveLength(TOTAL);
  });

  it("las filas leídas no traen hincha_id ni id", async () => {
    const [fila] = await leerAlineacionesDelPartido(clienteServicio(), partidoFuturo, 1);
    expect(Object.keys(fila!).sort()).toEqual(["esquema", "esquema_elegido_a_mano", "esquema_modificado_en", "puestos"]);
  });

  it("un Hincha no puede leer las Alineaciones ajenas (por eso el conteo usa la service role)", async () => {
    const { data } = await clienteComo("hinchaPenarol").from("alineacion").select("id").eq("partido_id", partidoFuturo);
    expect(data).toEqual([]);
  });
});

describe("contarPartido", () => {
  it("cuenta todas las Alineaciones del Partido", async () => {
    const conteo = await contarPartido(clienteServicio(), partidoFuturo);
    expect(conteo?.club).toBe("penarol");
    const r = conteo!.resultado;
    if (r.vacio) throw new Error("se esperaba un resultado con datos");
    expect(r.alineacionesQueCuentan).toBe(CANTIDAD_433 + CANTIDAD_442);
    expect(r.esquemaGanador).toBe("4-3-3");
    expect(r.esquemas.find((e) => e.esquema === "4-3-3")?.votos).toBe(CANTIDAD_433);
    expect(r.esquemas.find((e) => e.esquema === "4-4-2")?.votos).toBe(CANTIDAD_442);
    // Todas las Alineaciones aportan al Puesto de arquero (Tabla de Equivalencias).
    const arco = r.puestos.find((p) => p.puesto === "ARQ")!;
    expect(arco.candidatos.map((c) => [c.jugadorId, c.votos])).toEqual([
      [arqueroA, CANTIDAD_433],
      [arqueroB, CANTIDAD_442],
    ]);
    expect(r.once.find((a) => a.puesto === "ARQ")?.jugadorId).toBe(arqueroA);
  });

  it("el resultado no contiene nada que identifique a un Hincha o una Alineación", async () => {
    const conteo = await contarPartido(clienteServicio(), partidoFuturo);
    const json = JSON.stringify(conteo);
    expect(json).not.toMatch(/hincha|modificado|creado|actualizado/i);
    for (const id of [...hinchas, ...alineaciones]) expect(json).not.toContain(id);
    const r = conteo!.resultado;
    expect(Object.keys(r).sort()).toEqual(["alineacionesQueCuentan", "esquemaGanador", "esquemas", "once", "puestos", "vacio"]);
  });

  it("Partido inexistente: null", async () => {
    expect(await contarPartido(clienteServicio(), crypto.randomUUID())).toBeNull();
  });
});

describe("parcialParaHincha (acceso al Parcial)", () => {
  it("el Hincha ve el Parcial de la Votación abierta de su Club", async () => {
    const abierto = await partidoAbierto("penarol");
    const r = await parcialParaHincha(clienteComo("hinchaPenarol"), "penarol", abierto, calcularConServicio);
    expect(r.tipo).toBe("ok");
  });

  it("un Hincha no puede pedir el Parcial del otro Club (ni siquiera se calcula)", async () => {
    const abierto = await partidoAbierto("penarol");
    let calculado = false;
    const calcular = async (id: string) => {
      calculado = true;
      return calcularConServicio(id);
    };
    expect(await parcialParaHincha(clienteComo("hinchaNacional"), "nacional", abierto, calcular)).toEqual({
      tipo: "prohibido",
    });
    // Aunque mienta sobre su Club, RLS no le deja ver el Partido.
    expect(await parcialParaHincha(clienteComo("hinchaNacional"), "penarol", abierto, calcular)).toEqual({
      tipo: "prohibido",
    });
    expect(calculado).toBe(false);
  });

  it("sin la Votación abierta no hay Parcial", async () => {
    const r = await parcialParaHincha(clienteComo("hinchaPenarol"), "penarol", partidoFuturo, calcularConServicio);
    expect(r).toEqual({ tipo: "no_abierta" });
  });

  it("Partido inexistente o id inválido: prohibido", async () => {
    const penarol = clienteComo("hinchaPenarol");
    expect(await parcialParaHincha(penarol, "penarol", crypto.randomUUID(), calcularConServicio)).toEqual({
      tipo: "prohibido",
    });
    expect(await parcialParaHincha(penarol, "penarol", "no-es-un-uuid", calcularConServicio)).toEqual({
      tipo: "prohibido",
    });
  });

  it("los usuarios estándar no figuran en el resultado", async () => {
    const abierto = await partidoAbierto("penarol");
    const r = await parcialParaHincha(clienteComo("hinchaPenarol"), "penarol", abierto, calcularConServicio);
    const json = JSON.stringify(r);
    expect(json).not.toContain(usuario("hinchaPenarol").id);
    expect(json).not.toContain(usuario("hinchaNacional").id);
  });
});

// Datos de prueba compartidos por los tests de RLS: Partidos, Jugadores y
// Alineaciones creados con la service role. Uso típico:
//
//   const creados: string[] = [];
//   const crearPartido = creadorDePartidos(creados, { creadoEn: "2001-01-01T00:00:00Z" });
//   const id = await crearPartido("penarol", new Date(...), { estado: "cancelado" });
//   // afterAll: borrar los Partidos de `creados` (Alineaciones y resultados en cascada).
import { esquema, type PuestoId } from "@/domain/esquemas";
import { votacionAbierta } from "@/domain/calendario";
import type { ClubId, EstadoPartido } from "@/domain/comun/tipos";
import { leerPartidos } from "@/lib/club/lecturas";
import { clienteServicio } from "./helpers";

type Instante = Date | string;

const iso = (t: Instante) => (typeof t === "string" ? t : t.toISOString());

/**
 * Devuelve `crearPartido(club, inicio, { creadoEn?, estado? })`: crea un
 * Partido contra un Rival común (no es uno de los Clubes) y anota su id en
 * `creados`. `creadoEn` por defecto: el de `porDefecto` (sin él, now()).
 */
export function creadorDePartidos(creados: string[], porDefecto: { creadoEn?: Instante } = {}) {
  return async function crearPartido(
    club: ClubId,
    inicio: Instante,
    opciones: { creadoEn?: Instante; estado?: EstadoPartido } = {},
  ): Promise<string> {
    const servicio = clienteServicio();
    const { data: rival, error: errorRival } = await servicio
      .from("rival")
      .select("id")
      .eq("activo", true)
      .is("club_id", null)
      .limit(1)
      .single();
    if (errorRival) throw errorRival;
    const creadoEn = opciones.creadoEn ?? porDefecto.creadoEn;
    const { data, error } = await servicio
      .from("partido")
      .insert({
        club_id: club,
        rival_id: rival.id,
        inicio: iso(inicio),
        ...(creadoEn === undefined ? {} : { creado_en: iso(creadoEn) }),
        estado: opciones.estado ?? "programado",
      })
      .select("id")
      .single();
    if (error) throw error;
    creados.push(data.id);
    return data.id;
  };
}

/** El Partido con la Votación abierta hoy (el seed crea uno por Club). */
export async function partidoAbierto(club: ClubId): Promise<string> {
  const abierta = votacionAbierta(await leerPartidos(clienteServicio(), club), new Date());
  if (!abierta) throw new Error(`No hay Votación abierta para ${club}: corré npm run db:reset (el seed crea una).`);
  return abierta.partidoId;
}

/** Jugadores del Plantel Disponibles, por número: el primer arquero, los de campo y los defensores. */
export async function jugadoresDisponibles(club: ClubId) {
  const { data, error } = await clienteServicio()
    .from("jugador")
    .select("id, posicion_natural")
    .eq("club_id", club)
    .eq("en_plantel", true)
    .eq("disponibilidad", "disponible")
    .order("numero");
  if (error) throw error;
  return {
    arquero: data.find((j) => j.posicion_natural === "ARQ")!.id,
    campo: data.filter((j) => j.posicion_natural !== "ARQ").map((j) => j.id),
    defensores: data.filter((j) => j.posicion_natural === "DEF").map((j) => j.id),
  };
}

/** 4-3-3 completo: el arquero al arco y los primeros 10 de campo en el resto de los Puestos. */
export function once433(arquero: string, campo: readonly string[]): { puesto: PuestoId; jugadorId: string }[] {
  return esquema("4-3-3").puestos.map((p, i) => ({ puesto: p.id, jugadorId: i === 0 ? arquero : campo[i - 1]! }));
}

/** El 4-3-3 de `once433` como `puestos` de una Alineación, todos con la misma hora. */
export function puestos433(arquero: string, campo: readonly string[], modificadoEn: Instante) {
  return Object.fromEntries(once433(arquero, campo).map((a) => [a.puesto, { jugadorId: a.jugadorId, modificadoEn: iso(modificadoEn) }]));
}

/**
 * Guarda (upsert) una Alineación con la service role, con el Esquema elegido a
 * mano y las horas dadas (sin la service role, la base las sellaría).
 */
export async function guardarConServicio(
  hinchaId: string,
  partidoId: string,
  alineacion: { esquema: string; esquemaModificadoEn: Instante; puestos: Record<string, unknown> },
) {
  const { error } = await clienteServicio()
    .from("alineacion")
    .upsert(
      {
        hincha_id: hinchaId,
        partido_id: partidoId,
        esquema: alineacion.esquema,
        esquema_elegido_a_mano: true,
        esquema_modificado_en: iso(alineacion.esquemaModificadoEn),
        puestos: alineacion.puestos as never,
      },
      { onConflict: "hincha_id,partido_id" },
    );
  if (error) throw error;
}

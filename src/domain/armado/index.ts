/**
 * Armado de la Alineación (lógica pura de la pantalla principal del Hincha).
 *
 * - `votacionEnPantalla`: qué Partido (y qué Votación) se muestra.
 * - `textoCuentaRegresiva`: el texto de la cuenta regresiva al cierre.
 * - `validarAlineacion`: las reglas del Editor aplicadas a una Alineación
 *   completa que llega del cliente (no confiable), contra el Plantel actual.
 * - `alineacionDesdeFila` / `filaDesdeAlineacion`: adaptador entre la fila de
 *   la tabla `alineacion` y la `Alineacion` del Editor.
 */
import { calcularVotaciones, finDePartido, type PartidoCalendario, type Votacion } from "@/domain/calendario";
import {
  aJson,
  alineacionNueva,
  desdeJson,
  type Alineacion,
  type JugadorDelPlantel,
  type MotivoRechazo,
} from "@/domain/editor";
import { esPuestoDeArquero, type PuestoId } from "@/domain/esquemas";

/**
 * La Votación que ve el Hincha en la pantalla principal, o `null` si no hay
 * Partido para mostrar (no hay ninguno cargado que no haya terminado).
 *
 * 1. Si hay una Votación abierta, esa.
 * 2. Si no, la del primer Partido que todavía no terminó (inicio + 2 h), en
 *    orden cronológico: puede estar `cerrada` (el Partido está por empezar o
 *    en juego; la siguiente abre cuando termine), `anulada` (cancelado) o
 *    `pendiente`.
 *
 * `conOnceElegido`: ids de los Partidos cuya Votación ya tiene resultado
 * congelado. Si el Partido se postergó después del cierre, el Calendario
 * puede verla pendiente o abierta, pero es definitiva: se muestra `cerrada`
 * (o `anulada` si además se canceló).
 */
export function votacionEnPantalla(
  partidos: readonly PartidoCalendario[],
  ahora: Date,
  conOnceElegido: ReadonlySet<string> = new Set(),
): Votacion | null {
  const votaciones = calcularVotaciones(partidos, ahora).map((v) =>
    conOnceElegido.has(v.partidoId) && (v.estado === "abierta" || v.estado === "pendiente")
      ? { ...v, estado: "cerrada" as const }
      : v,
  );
  const abierta = votaciones.find((v) => v.estado === "abierta");
  if (abierta) return abierta;
  const inicioDe = new Map(partidos.map((p) => [p.id, p.inicio]));
  return (
    votaciones.find((v) => {
      const inicio = inicioDe.get(v.partidoId);
      return inicio !== undefined && finDePartido(inicio).getTime() > ahora.getTime();
    }) ?? null
  );
}

/**
 * Texto de una cuenta regresiva: desde la unidad más grande no nula hasta los
 * segundos ("2 d 3 h 5 min 9 s", "42 s"). Nunca negativo.
 */
export function textoCuentaRegresiva(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const partes: [number, string][] = [
    [Math.floor(total / 86400), "d"],
    [Math.floor((total % 86400) / 3600), "h"],
    [Math.floor((total % 3600) / 60), "min"],
    [total % 60, "s"],
  ];
  const desde = partes.findIndex(([n], i) => n > 0 || i === partes.length - 1);
  return partes
    .slice(desde)
    .map(([n, unidad]) => `${n} ${unidad}`)
    .join(" ");
}

export type ResultadoValidacion = { readonly ok: true } | { readonly ok: false; readonly motivo: MotivoRechazo };

/**
 * Verifica una Alineación (ya leída con `desdeJson`, que garantiza Esquema
 * válido, Puestos del Esquema y Jugadores sin repetir) contra el Plantel del
 * Club, con las mismas reglas que las operaciones del Editor:
 *
 * - todo Jugador colocado tiene que figurar en `plantel` (el del Club);
 * - regla del arquero en todos los Puestos;
 * - un Jugador que no estaba en la Alineación `guardada` es una elección
 *   nueva: tiene que estar en el Plantel y Disponible. Uno que ya estaba
 *   guardado puede quedarse o moverse aunque haya dejado de estar Disponible
 *   (como `mover` en el Editor).
 */
export function validarAlineacion(
  alineacion: Alineacion,
  guardada: Alineacion | null,
  plantel: readonly JugadorDelPlantel[],
): ResultadoValidacion {
  const yaEstaban = new Set(Object.values(guardada?.puestos ?? {}).map((o) => o.jugadorId));
  const porId = new Map(plantel.map((j) => [j.id, j]));
  for (const [puesto, ocupado] of Object.entries(alineacion.puestos) as [PuestoId, { jugadorId: string }][]) {
    const jugador = porId.get(ocupado.jugadorId);
    if (!jugador) return { ok: false, motivo: "jugador_desconocido" };
    const esArquero = jugador.posicionNatural === "ARQ";
    if (esArquero && !esPuestoDeArquero(puesto)) return { ok: false, motivo: "arquero_fuera_del_arco" };
    if (!esArquero && esPuestoDeArquero(puesto)) return { ok: false, motivo: "arco_solo_para_arqueros" };
    if (!yaEstaban.has(jugador.id)) {
      if (!jugador.enPlantel) return { ok: false, motivo: "jugador_fuera_del_plantel" };
      if (jugador.disponibilidad !== "disponible") return { ok: false, motivo: "jugador_no_disponible" };
    }
  }
  return { ok: true };
}

/** Columnas a pedir a la tabla `alineacion` para leer una Alineación (`alineacionDesdeFila`). */
export const COLUMNAS_ALINEACION = "esquema, esquema_elegido_a_mano, esquema_modificado_en, puestos";

/** Columnas de la tabla `alineacion` que guardan la Alineación. */
export interface FilaAlineacion {
  esquema: string;
  esquema_elegido_a_mano: boolean;
  /** timestamptz en ISO 8601 (Postgres devuelve "+00:00"). */
  esquema_modificado_en: string | null;
  /** `AlineacionJson["puestos"]` del Editor (jsonb). */
  puestos: unknown;
}

/** Fila → Alineación. Una fila ilegible (no debería pasar: la base valida el Esquema) se lee como Alineación nueva. */
export function alineacionDesdeFila(fila: FilaAlineacion): Alineacion {
  const leida = desdeJson({
    esquema: fila.esquema,
    esquemaElegidoAMano: fila.esquema_elegido_a_mano,
    esquemaModificadoEn: fila.esquema_modificado_en ?? undefined,
    puestos: fila.puestos,
  });
  return leida.ok ? leida.estado : alineacionNueva();
}

/** Alineación → columnas de la fila. */
export function filaDesdeAlineacion(alineacion: Alineacion): FilaAlineacion & { puestos: ReturnType<typeof aJson>["puestos"] } {
  const json = aJson(alineacion);
  return {
    esquema: json.esquema,
    esquema_elegido_a_mano: json.esquemaElegidoAMano,
    esquema_modificado_en: json.esquemaModificadoEn ?? null,
    puestos: json.puestos,
  };
}

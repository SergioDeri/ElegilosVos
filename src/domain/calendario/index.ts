/**
 * Calendario de Votación (lógica pura).
 *
 * A partir de los Partidos de UN Club y la hora actual calcula, para cada
 * Partido, el estado de su Votación y sus horas de apertura y cierre. El estado
 * de la Votación no se guarda en la base: se deriva siempre con esta regla.
 *
 * ## Regla (para replicarla en SQL)
 *
 * Todas las horas son instantes UTC (`timestamptz`). Sea P un Partido del Club:
 *
 * 1. **Orden**: los Partidos del Club se ordenan por `(inicio, creado_en, id)`
 *    ascendente. El desempate por `creado_en` e `id` solo importa si dos
 *    Partidos tienen el mismo `inicio`.
 * 2. **Anterior(P)**: el último Partido **no cancelado** del mismo Club que va
 *    antes que P en ese orden (P cancelado o no). Puede no existir.
 * 3. **fin(X)** = `X.inicio + DURACION_PARTIDO_MS` (2 horas).
 * 4. **cierra(P)** = `P.inicio - CIERRE_ANTES_DEL_INICIO_MS` (1 hora).
 * 5. **abre(P)** = `max(P.creado_en, fin(Anterior(P)))`, o `P.creado_en` si no
 *    hay Anterior.
 * 6. **Estado** (intervalo semiabierto `[abre, cierra)`):
 *    - `anulada`   si `P.estado = 'cancelado'` (a cualquier hora);
 *    - `pendiente` si `ahora < abre` y `ahora < cierra`;
 *    - `abierta`   si `abre <= ahora < cierra`;
 *    - `cerrada`   si `ahora >= cierra`.
 *
 * Equivalente SQL de "abierta": `estado = 'programado' and abre <= now() and
 * now() < cierra`.
 *
 * ## Consecuencias
 *
 * - **Partido cargado después de que terminó el anterior**: `creado_en` es
 *   mayor que `fin(Anterior)`, así que abre al cargarse.
 * - **Ventana vacía** (`abre >= cierra`): por ejemplo, un Partido cargado
 *   menos de 1 hora antes de su inicio, o uno que empieza menos de 3 horas
 *   después del inicio del anterior. Esa Votación **no abre nunca**: está
 *   `pendiente` hasta `cierra` y `cerrada` desde ahí, sin haber pasado por
 *   `abierta` (no pudo recibir Alineaciones). Se detecta con `abre >= cierra`.
 * - **A lo sumo una abierta por Club**: si A va antes que B y A no está
 *   cancelado, `abre(B) >= fin(A) = A.inicio + 2 h > A.inicio - 1 h = cierra(A)`;
 *   las ventanas de los Partidos no cancelados no se superponen, y los
 *   cancelados nunca están abiertos.
 * - **Postergación o cambio de horario**: basta con recalcular con el `inicio`
 *   nuevo; se mueven su cierre y la apertura del Partido siguiente.
 * - **Cancelación**: el Partido cancelado deja de ser Anterior de nadie; el
 *   siguiente abre cuando termina el último no cancelado previo (o al cargarse).
 *
 * ## Regla de la Selección (ADR-0005)
 *
 * Los Partidos de la Selección (`calcularVotaciones(partidos, ahora, SELECCION)`)
 * cambian solo el paso 5:
 *
 * 5'. **abre(P)** = `max(P.creado_en, P.inicio - APERTURA_SELECCION_ANTES_DEL_INICIO_MS)`
 *     (14 días). No mira el Partido anterior.
 *
 * Cierre (4), estados (6), postergación y cancelación son iguales. Como la
 * apertura no depende del anterior, **puede haber más de una abierta a la
 * vez** (una fecha doble: dos Partidos con unos 5 días de diferencia); por eso
 * se consultan con `votacionesAbiertas` (en plural). Un Partido cargado a
 * menos de 14 días de su inicio abre al cargarse; uno cargado a menos de 1
 * hora, nunca (ventana vacía). Cancelar uno no cambia la Votación de los demás.
 *
 * Equivalente SQL: en `votacion_de_partido`, si el Partido es de la Selección
 * (`club.es_seleccion`), `abre = greatest(creado_en, inicio - interval '14 days')`.
 */
import { SELECCION, type ClubOSeleccion, type EstadoPartido } from "@/domain/comun/tipos";

/** La Votación cierra este tiempo antes del inicio del Partido (1 hora). */
export const CIERRE_ANTES_DEL_INICIO_MS = 60 * 60 * 1000;

/** En la Selección, la Votación abre este tiempo antes del inicio (14 días). */
export const APERTURA_SELECCION_ANTES_DEL_INICIO_MS = 14 * 24 * 60 * 60 * 1000;

/** Un Partido se considera terminado este tiempo después de su inicio (2 horas). */
export const DURACION_PARTIDO_MS = 2 * 60 * 60 * 1000;

/** Lo que el Calendario necesita de un Partido (tabla `partido`). */
export interface PartidoCalendario {
  id: string;
  /** Hora de inicio (UTC). */
  inicio: Date;
  estado: EstadoPartido;
  /** Momento en que se cargó el Partido. */
  creadoEn: Date;
}

export type EstadoVotacion = "pendiente" | "abierta" | "cerrada" | "anulada";

export interface Votacion {
  partidoId: string;
  estado: EstadoVotacion;
  /** Hora de apertura (incluida). Si `abre >= cierra`, la Votación no abre nunca. */
  abre: Date;
  /** Hora de cierre (excluida): el inicio menos 1 hora. */
  cierra: Date;
}

/** Hora de cierre de la Votación de un Partido que empieza en `inicio`. */
export function cierreDeVotacion(inicio: Date): Date {
  return new Date(inicio.getTime() - CIERRE_ANTES_DEL_INICIO_MS);
}

/** Hora en que se considera terminado un Partido que empieza en `inicio`. */
export function finDePartido(inicio: Date): Date {
  return new Date(inicio.getTime() + DURACION_PARTIDO_MS);
}

function compararPartidos(a: PartidoCalendario, b: PartidoCalendario): number {
  return (
    a.inicio.getTime() - b.inicio.getTime() ||
    a.creadoEn.getTime() - b.creadoEn.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Calcula la Votación de cada Partido de un Club (o de la Selección) en el
 * instante `ahora`. Todos los Partidos deben ser del mismo dueño, `de`: con
 * `SELECCION` aplica la regla de la Selección; con un Club, o sin `de`, la de
 * los Clubes. Devuelve una Votación por Partido (cancelados incluidos), en
 * orden cronológico `(inicio, creadoEn, id)`.
 */
export function calcularVotaciones(partidos: readonly PartidoCalendario[], ahora: Date, de?: ClubOSeleccion): Votacion[] {
  const ordenados = [...partidos].sort(compararPartidos);
  const t = ahora.getTime();
  const seleccion = de === SELECCION;
  let anterior: PartidoCalendario | null = null;

  return ordenados.map((p) => {
    const abre = seleccion
      ? new Date(Math.max(p.creadoEn.getTime(), p.inicio.getTime() - APERTURA_SELECCION_ANTES_DEL_INICIO_MS))
      : anterior
        ? new Date(Math.max(p.creadoEn.getTime(), finDePartido(anterior.inicio).getTime()))
        : p.creadoEn;
    const cierra = cierreDeVotacion(p.inicio);
    const estado: EstadoVotacion =
      p.estado === "cancelado"
        ? "anulada"
        : t >= cierra.getTime()
          ? "cerrada"
          : t >= abre.getTime()
            ? "abierta"
            : "pendiente";
    if (p.estado !== "cancelado") anterior = p;
    return { partidoId: p.id, estado, abre, cierra };
  });
}

/**
 * Las Votaciones abiertas en el instante `ahora`, en orden cronológico. En la
 * Selección (`de = SELECCION`) puede haber más de una; en un Club, a lo sumo una.
 */
export function votacionesAbiertas(partidos: readonly PartidoCalendario[], ahora: Date, de?: ClubOSeleccion): Votacion[] {
  return calcularVotaciones(partidos, ahora, de).filter((v) => v.estado === "abierta");
}

/**
 * La Votación abierta del Club en el instante `ahora`, o `null` si no hay
 * ninguna. Por la regla de apertura de los Clubes nunca hay más de una. Solo
 * para Clubes: en la Selección, `votacionesAbiertas`.
 */
export function votacionAbierta(partidos: readonly PartidoCalendario[], ahora: Date): Votacion | null {
  return calcularVotaciones(partidos, ahora).find((v) => v.estado === "abierta") ?? null;
}

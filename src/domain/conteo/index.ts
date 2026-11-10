// Motor de Conteo (ticket 05, ADR-0001). Lógica pura.
//
// Recibe las Alineaciones de una Votación y los Jugadores del Club, y calcula
// el Esquema más votado, los votos por Puesto y el 11 asignado. Sirve tanto
// para el Parcial como para el 11 Elegido. No sabe quién votó.
//
// Tipos de entrada propios y mínimos, para no acoplarse a la forma de la
// Alineación del Editor (ticket 06): el que llama adapta sus datos.
import type { Disponibilidad, PosicionNatural } from "@/domain/comun/tipos";
import {
  esPuestoDeArquero,
  esquema,
  esquemas,
  puestoEquivalente,
  type EsquemaId,
  type PuestoId,
} from "@/domain/esquemas";
import { asignacionDeCostoMinimo } from "./hungaro";

// ---------- Entrada ----------

export interface PuestoOcupadoParaConteo {
  readonly jugadorId: string;
  /** Hora de la última modificación de ese Puesto en la Alineación. */
  readonly modificadoEn: Date;
}

export interface AlineacionParaConteo {
  readonly esquema: EsquemaId;
  readonly esquemaElegidoAMano: boolean;
  /**
   * Hora en que se eligió el Esquema, si se conoce. Si no viene, se usa la
   * última modificación de sus Puestos (ver `contar`, desempate de Esquemas).
   */
  readonly esquemaModificadoEn?: Date;
  /** Puestos ocupados. Se ignoran los que no pertenecen al Esquema. */
  readonly puestos: Readonly<Partial<Record<PuestoId, PuestoOcupadoParaConteo>>>;
}

export interface JugadorParaConteo {
  readonly id: string;
  /** Número de camiseta; null en la Selección (sin número). */
  readonly numero: number | null;
  readonly posicionNatural: PosicionNatural;
  /** Disponibilidad al momento del conteo (al cierre, para el 11 Elegido). */
  readonly disponibilidad: Disponibilidad;
  readonly enPlantel: boolean;
}

export interface EntradaConteo {
  readonly alineaciones: readonly AlineacionParaConteo[];
  /** Jugadores del Club (los votos a ids que no están acá se descartan). */
  readonly jugadores: readonly JugadorParaConteo[];
}

// ---------- Salida ----------

export interface VotosDeEsquema {
  readonly esquema: EsquemaId;
  /** Alineaciones que cuentan con este Esquema. */
  readonly votos: number;
  /** 0..100, sobre las Alineaciones que cuentan. Sin redondear. */
  readonly porcentaje: number;
}

export interface Candidato {
  readonly jugadorId: string;
  readonly votos: number;
  /** 0..100, sobre los votos válidos del Puesto. Sin redondear. */
  readonly porcentaje: number;
}

export interface VotosDePuesto {
  readonly puesto: PuestoId;
  /** Votos válidos que recibió el Puesto (con colisiones, una Alineación puede aportar dos). */
  readonly totalVotos: number;
  /** Ordenados: más votos, después hora de consolidación, después orden fijo de Jugador. */
  readonly candidatos: readonly Candidato[];
}

/**
 * `votos`: el Jugador salió de la asignación óptima por sus votos en ese Puesto.
 * `vacante`: el Puesto no tenía votos asignables y se completó con la regla
 * de vacantes; `jugadorId` es `null` si no había ningún Disponible adecuado.
 */
export type OrigenAsignacion = "votos" | "vacante";

export interface Asignacion {
  readonly puesto: PuestoId;
  readonly jugadorId: string | null;
  readonly origen: OrigenAsignacion;
  /** Votos de ese Jugador en ese Puesto (0 en las vacantes). */
  readonly votos: number;
}

export interface ResultadoConteoVacio {
  readonly vacio: true;
  readonly alineacionesQueCuentan: 0;
}

export interface ResultadoConteoConDatos {
  readonly vacio: false;
  readonly alineacionesQueCuentan: number;
  /** Todos los Esquemas, en el orden del catálogo. */
  readonly esquemas: readonly VotosDeEsquema[];
  readonly esquemaGanador: EsquemaId;
  /** Los 11 Puestos del Esquema ganador, en su orden. */
  readonly puestos: readonly VotosDePuesto[];
  /** El 11 asignado, en el orden de los Puestos del Esquema ganador. */
  readonly once: readonly Asignacion[];
}

export type ResultadoConteo = ResultadoConteoVacio | ResultadoConteoConDatos;

// ---------- Reglas auxiliares ----------

/** Posición natural que corresponde a cada Puesto (para el último recurso de vacantes). */
const POSICION_DEL_PUESTO: Record<PuestoId, PosicionNatural> = {
  ARQ: "ARQ",
  LI: "DEF",
  LD: "DEF",
  ZAG_I: "DEF",
  ZAG_C: "DEF",
  ZAG_D: "DEF",
  CAR_I: "DEF",
  CAR_D: "DEF",
  CINCO: "MED",
  MC_I: "MED",
  MC_D: "MED",
  INT_I: "MED",
  INT_D: "MED",
  VOL_I: "MED",
  VOL_D: "MED",
  ENG: "MED",
  EXT_I: "DEL",
  EXT_D: "DEL",
  DEL: "DEL",
  DEL_I: "DEL",
  DEL_D: "DEL",
};

/** Sin hora conocida: pierde cualquier desempate por hora. */
const SIN_HORA = Number.POSITIVE_INFINITY;

function puedeSumar(j: JugadorParaConteo | undefined): j is JugadorParaConteo {
  return j !== undefined && j.enPlantel && j.disponibilidad === "disponible";
}

function respetaArquero(j: JugadorParaConteo, puesto: PuestoId): boolean {
  return (j.posicionNatural === "ARQ") === esPuestoDeArquero(puesto);
}

/**
 * Orden fijo de Jugadores: número de camiseta y, si se repite, id. Los
 * Jugadores sin número (los de la Selección) van después de los numerados y
 * entre ellos deciden por id.
 */
function compararOrdenFijo(a: JugadorParaConteo, b: JugadorParaConteo): number {
  if (a.numero !== b.numero) {
    if (a.numero === null) return 1;
    if (b.numero === null) return -1;
    return a.numero - b.numero;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

interface Acumulado {
  votos: number;
  /** Hora de consolidación: la mayor `modificadoEn` entre sus votos (ms). */
  hora: number;
}

function sumar(m: Map<string, Acumulado>, clave: string, hora: number): void {
  const a = m.get(clave);
  if (a) {
    a.votos++;
    if (hora > a.hora) a.hora = hora;
  } else {
    m.set(clave, { votos: 1, hora });
  }
}

// ---------- Motor ----------

/**
 * Cuenta las Alineaciones de una Votación según ADR-0001.
 *
 * 1. **Qué cuenta.** Una Alineación cuenta si tiene al menos un Jugador
 *    colocado en un Puesto de su Esquema (aunque ese Jugador ya no esté
 *    Disponible) o si su Esquema se eligió a mano. Si ninguna cuenta, el
 *    resultado es `{ vacio: true }`.
 *
 * 2. **Esquema ganador.** Cada Alineación que cuenta es un voto a su Esquema.
 *    Gana el de más votos. Empate: gana el que *llegó antes a ese total*, o
 *    sea, el de menor hora de consolidación, que es la hora del voto más
 *    reciente que recibió. La hora de una Alineación es `esquemaModificadoEn`
 *    si viene y, si no, la mayor `modificadoEn` de sus Puestos (una
 *    Alineación sin ninguna hora no aporta hora). Si sigue el empate, decide
 *    el orden del catálogo.
 *
 * 3. **Votos por Puesto.** Cada Jugador colocado en una Alineación que cuenta
 *    suma un voto en el Puesto equivalente del Esquema ganador (Tabla de
 *    Equivalencias); si dos Puestos de origen caen en el mismo, los dos
 *    suman ahí. Se descartan los votos a Jugadores desconocidos, no
 *    Disponibles o fuera del Plantel, y los que violan la regla del arquero
 *    con la posición natural actual. La hora de consolidación de un
 *    candidato en un Puesto es la mayor `modificadoEn` de sus votos ahí.
 *
 * 4. **Asignación óptima** (algoritmo húngaro sobre Puestos × candidatos).
 *    Solo se asigna un Jugador a un Puesto donde tiene votos. Entre todas las
 *    asignaciones de Jugadores distintos se elige, en este orden:
 *    a. la de más votos en total;
 *    b. la que deja menos Puestos sin Jugador votado;
 *    c. la de menor suma de horas de consolidación de los pares elegidos (a
 *       igual cantidad de pares, la de votos consolidados antes en promedio);
 *    d. orden fijo: recorriendo los Puestos en el orden del Esquema, en cada
 *       uno el Jugador de menor número de camiseta (después id) que todavía
 *       permita llegar al óptimo de a–c; la vacante, al final.
 *    a–c se codifican en un único costo con pesos lexicográficos; d se
 *    resuelve fijando Puesto por Puesto y verificando que el óptimo se
 *    mantiene.
 *
 * 5. **Vacantes.** Los Puestos que quedan sin Jugador se completan en el
 *    orden del Esquema con, primero, el Disponible libre con más votos
 *    válidos en el Esquema ganador (en cualquier Puesto; desempate por hora
 *    de consolidación de su último voto y orden fijo); y como último recurso,
 *    con el Disponible libre de la posición natural del Puesto de menor
 *    número de camiseta. Siempre respetando la regla del arquero. Si no hay
 *    nadie, el Puesto queda con `jugadorId: null`.
 *
 * El resultado no depende del orden de las Alineaciones, de sus Puestos ni
 * de los Jugadores.
 */
export function contar(entrada: EntradaConteo): ResultadoConteo {
  const jugadores = new Map<string, JugadorParaConteo>();
  for (const j of entrada.jugadores) jugadores.set(j.id, j);

  // Puestos válidos de cada Esquema (para ignorar basura que venga de afuera).
  const puestosDe = new Map<EsquemaId, Set<PuestoId>>(
    esquemas().map((e) => [e.id, new Set(e.puestos.map((p) => p.id))]),
  );

  // 1 y 2: qué cuenta y votos por Esquema.
  const votosEsquema = new Map<EsquemaId, Acumulado>();
  const queCuentan: { alineacion: AlineacionParaConteo; puestos: [PuestoId, PuestoOcupadoParaConteo][] }[] = [];
  for (const a of entrada.alineaciones) {
    const validos = puestosDe.get(a.esquema);
    if (!validos) continue;
    const puestos = (Object.entries(a.puestos) as [PuestoId, PuestoOcupadoParaConteo | undefined][]).filter(
      (e): e is [PuestoId, PuestoOcupadoParaConteo] => e[1] !== undefined && validos.has(e[0]),
    );
    if (puestos.length === 0 && !a.esquemaElegidoAMano) continue;
    queCuentan.push({ alineacion: a, puestos });

    let hora = a.esquemaModificadoEn?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (a.esquemaModificadoEn === undefined) {
      for (const [, o] of puestos) hora = Math.max(hora, o.modificadoEn.getTime());
    }
    sumar(votosEsquema, a.esquema, hora);
  }

  const total = queCuentan.length;
  if (total === 0) return { vacio: true, alineacionesQueCuentan: 0 };

  const catalogo = esquemas();
  const horaEsquema = (id: EsquemaId) => {
    const h = votosEsquema.get(id)?.hora ?? SIN_HORA;
    return h === Number.NEGATIVE_INFINITY ? SIN_HORA : h;
  };
  const ganador = [...catalogo]
    .map((e, orden) => ({ id: e.id, orden, votos: votosEsquema.get(e.id)?.votos ?? 0, hora: horaEsquema(e.id) }))
    .sort((a, b) => b.votos - a.votos || a.hora - b.hora || a.orden - b.orden)[0].id;

  // 3: votos por Puesto del Esquema ganador.
  const puestosGanador = esquema(ganador).puestos.map((p) => p.id);
  const traduccion = new Map<EsquemaId, Map<PuestoId, PuestoId>>(
    catalogo.map((e) => [e.id, new Map(e.puestos.map((p) => [p.id, puestoEquivalente(e.id, p.id, ganador)]))]),
  );
  const votosPuesto = new Map<PuestoId, Map<string, Acumulado>>(puestosGanador.map((p) => [p, new Map()]));
  const votosJugador = new Map<string, Acumulado>();
  for (const { alineacion, puestos } of queCuentan) {
    const mapa = traduccion.get(alineacion.esquema)!;
    for (const [puesto, ocupado] of puestos) {
      const j = jugadores.get(ocupado.jugadorId);
      if (!puedeSumar(j)) continue;
      const destino = mapa.get(puesto)!;
      if (!respetaArquero(j, destino)) continue;
      const hora = ocupado.modificadoEn.getTime();
      sumar(votosPuesto.get(destino)!, j.id, hora);
      sumar(votosJugador, j.id, hora);
    }
  }

  const ordenCandidato = (votos: Map<string, Acumulado>) => (a: string, b: string) => {
    const va = votos.get(a)!;
    const vb = votos.get(b)!;
    return vb.votos - va.votos || va.hora - vb.hora || compararOrdenFijo(jugadores.get(a)!, jugadores.get(b)!);
  };

  const puestos: VotosDePuesto[] = puestosGanador.map((puesto) => {
    const votos = votosPuesto.get(puesto)!;
    let totalVotos = 0;
    for (const a of votos.values()) totalVotos += a.votos;
    const candidatos = [...votos.keys()].sort(ordenCandidato(votos)).map((jugadorId) => {
      const v = votos.get(jugadorId)!.votos;
      return { jugadorId, votos: v, porcentaje: (v / totalVotos) * 100 };
    });
    return { puesto, totalVotos, candidatos };
  });

  // 4: asignación óptima.
  const asignados = asignarPorVotos(
    puestosGanador,
    [...votosJugador.keys()].map((id) => jugadores.get(id)!).sort(compararOrdenFijo),
    votosPuesto,
  );

  // 5: vacantes.
  const ocupados = new Set(asignados.filter((x): x is string => x !== null));
  const libres = (j: JugadorParaConteo) => puedeSumar(j) && !ocupados.has(j.id);
  const conVotos = [...votosJugador.keys()].sort(ordenCandidato(votosJugador)).map((id) => jugadores.get(id)!);
  const todos = [...jugadores.values()].sort(compararOrdenFijo);

  const once: Asignacion[] = puestosGanador.map((puesto, i) => {
    const id = asignados[i];
    if (id !== null) return { puesto, jugadorId: id, origen: "votos", votos: votosPuesto.get(puesto)!.get(id)!.votos };
    const relleno =
      conVotos.find((j) => libres(j) && respetaArquero(j, puesto)) ??
      todos.find((j) => libres(j) && j.posicionNatural === POSICION_DEL_PUESTO[puesto]);
    if (relleno) ocupados.add(relleno.id);
    return { puesto, jugadorId: relleno?.id ?? null, origen: "vacante", votos: 0 };
  });

  return {
    vacio: false,
    alineacionesQueCuentan: total,
    esquemas: catalogo.map((e) => {
      const votos = votosEsquema.get(e.id)?.votos ?? 0;
      return { esquema: e.id, votos, porcentaje: (votos / total) * 100 };
    }),
    esquemaGanador: ganador,
    puestos,
    once,
  };
}

/**
 * Pasos 4a–d de `contar`. Devuelve, para cada Puesto, el id del Jugador
 * asignado por votos o `null` si queda vacante.
 *
 * Matriz: filas = Puestos; columnas = candidatos (en orden fijo) + una
 * columna "vacante" propia de cada Puesto, de costo 0. El costo de poner un
 * candidato con `v` votos y hora de consolidación `h` en un Puesto es
 * `-v·A - B + (h - hMin)`, con `B > 11·(hMax - hMin)` y `A > 12·B`, de modo
 * que un voto pesa más que cualquier diferencia de Puestos cubiertos, y un
 * Puesto cubierto más que cualquier diferencia de horas.
 */
function asignarPorVotos(
  puestos: readonly PuestoId[],
  candidatos: readonly JugadorParaConteo[],
  votosPuesto: ReadonlyMap<PuestoId, ReadonlyMap<string, Acumulado>>,
): (string | null)[] {
  const n = puestos.length;
  const c = candidatos.length;
  if (c === 0) return puestos.map(() => null);

  let hMin = Number.POSITIVE_INFINITY;
  let hMax = Number.NEGATIVE_INFINITY;
  let sumaVotos = 0;
  for (const votos of votosPuesto.values()) {
    for (const a of votos.values()) {
      hMin = Math.min(hMin, a.hora);
      hMax = Math.max(hMax, a.hora);
      sumaVotos += a.votos;
    }
  }
  const B = BigInt(11) * BigInt(hMax - hMin) + BigInt(1);
  const A = BigInt(12) * B + BigInt(1);
  const PROHIBIDO = A * BigInt(sumaVotos + 1) * BigInt(100);
  const INFINITO = PROHIBIDO * BigInt(1000);
  const CERO = BigInt(0);

  const costos: bigint[][] = puestos.map((puesto, i) => {
    const votos = votosPuesto.get(puesto)!;
    const fila: bigint[] = candidatos.map((j) => {
      const a = votos.get(j.id);
      return a ? -BigInt(a.votos) * A - B + BigInt(a.hora - hMin) : PROHIBIDO;
    });
    for (let k = 0; k < n; k++) fila.push(k === i ? CERO : PROHIBIDO);
    return fila;
  });

  const optimo = asignacionDeCostoMinimo(costos, INFINITO);

  // 4d: fijar Puesto por Puesto la primera opción (en orden fijo) que mantiene el óptimo.
  const fijas = new Map<number, number>();
  const restringida = () =>
    costos.map((fila, i) =>
      fila.map((costo, col) => {
        const fija = fijas.get(i);
        if (fija !== undefined) return col === fija ? costo : PROHIBIDO;
        for (const otra of fijas.values()) if (otra === col) return PROHIBIDO;
        return costo;
      }),
    );
  for (let i = 0; i < n; i++) {
    const elegida = optimo.columnaDeFila[i];
    for (let col = 0; col < c + n; col++) {
      if (costos[i][col] === PROHIBIDO) continue;
      fijas.set(i, col);
      // La columna de la solución óptima siempre sirve; las anteriores se verifican.
      if (col === elegida && sinFijasPrevias(fijas, optimo.columnaDeFila, i)) break;
      if (asignacionDeCostoMinimo(restringida(), INFINITO).costo === optimo.costo) break;
    }
  }

  return puestos.map((_, i) => {
    const col = fijas.get(i)!;
    return col < c ? candidatos[col].id : null;
  });
}

/** ¿Las fijaciones hasta la fila `i` coinciden con la solución óptima original? */
function sinFijasPrevias(fijas: ReadonlyMap<number, number>, original: readonly number[], i: number): boolean {
  for (let k = 0; k <= i; k++) if (fijas.get(k) !== original[k]) return false;
  return true;
}

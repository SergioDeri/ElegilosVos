/**
 * Editor de Alineación (lógica pura).
 *
 * Modela la Alineación de un Hincha y las operaciones que despacha la UI.
 * Todas las operaciones son inmutables: devuelven un estado nuevo o un rechazo
 * con motivo, y nunca modifican el estado que reciben. El tiempo entra como
 * parámetro (`ahora`): el dominio nunca lee el reloj.
 *
 * Invariantes que garantizan las operaciones:
 * - un Jugador está en un solo Puesto;
 * - todo Puesto ocupado pertenece al Esquema de la Alineación;
 * - el arquero solo va al Puesto de arquero y ese Puesto solo admite arqueros
 *   (según la posición natural que viene en la lista del Plantel).
 *
 * Horas de modificación: cada operación pone `ahora` solo en los Puestos que
 * cambiaron de Jugador (o en los que el Jugador cambió de Puesto). `heredar`
 * conserva las horas originales. Un Puesto vacío no guarda hora.
 *
 * `plantel` es la lista de Jugadores del Club (incluidos, si se tienen, los que
 * salieron del Plantel o no están Disponibles); el orden no importa salvo en
 * `banco`, que lo respeta.
 */
import type { Disponibilidad, PosicionNatural } from "@/domain/comun/tipos";
import {
  esEsquemaId,
  esPuestoDe,
  esPuestoDeArquero,
  esquema,
  esquemaPorDefecto,
  puestoEquivalente,
  type EsquemaId,
  type PuestoId,
} from "@/domain/esquemas";

/** Un Puesto ocupado: el Jugador y la hora de la última modificación del Puesto. */
export interface PuestoOcupado {
  readonly jugadorId: string;
  readonly modificadoEn: Date;
}

/**
 * Estado de una Alineación. Compatible con la entrada del Motor de Conteo
 * (`esquema`, `esquemaElegidoAMano`, `puestos`). Un Puesto vacío no tiene
 * entrada en `puestos`.
 */
export interface Alineacion {
  readonly esquema: EsquemaId;
  /** El Hincha eligió el Esquema (cambiarEsquema). Si no, es el Esquema por defecto y no es un voto. */
  readonly esquemaElegidoAMano: boolean;
  /** Hora en que el Hincha eligió el Esquema a mano por última vez. */
  readonly esquemaModificadoEn?: Date;
  readonly puestos: Readonly<Partial<Record<PuestoId, PuestoOcupado>>>;
}

/** Lo que el Editor necesita saber de cada Jugador del Club. */
export interface JugadorDelPlantel {
  readonly id: string;
  readonly posicionNatural: PosicionNatural;
  readonly disponibilidad: Disponibilidad;
  /** `false` si el Jugador salió del Plantel (baja lógica). */
  readonly enPlantel: boolean;
}

export type MotivoRechazo =
  /** El Puesto no pertenece al Esquema de la Alineación. */
  | "puesto_fuera_del_esquema"
  /** El Jugador no figura en la lista de Jugadores recibida. */
  | "jugador_desconocido"
  /** El Jugador salió del Plantel. */
  | "jugador_fuera_del_plantel"
  /** El Jugador no está Disponible (Lesionado, Suspendido o No disponible). */
  | "jugador_no_disponible"
  /** Colocar desde el Plantel un Jugador que ya está en la cancha. */
  | "jugador_ya_colocado"
  /** Un arquero solo puede ir al Puesto de arquero. */
  | "arquero_fuera_del_arco"
  /** El Puesto de arquero solo admite arqueros. */
  | "arco_solo_para_arqueros"
  /** Mover o quitar desde un Puesto vacío. */
  | "puesto_vacio";

export type ResultadoOperacion = { readonly ok: true; readonly estado: Alineacion } | { readonly ok: false; readonly motivo: MotivoRechazo };

type Puestos = Partial<Record<PuestoId, PuestoOcupado>>;

const exito = (estado: Alineacion): ResultadoOperacion => ({ ok: true, estado });
const rechazo = (motivo: MotivoRechazo): ResultadoOperacion => ({ ok: false, motivo });

/** Alineación vacía con el Esquema por defecto (no elegido a mano: no cuenta como voto). */
export function alineacionNueva(): Alineacion {
  return { esquema: esquemaPorDefecto, esquemaElegidoAMano: false, puestos: {} };
}

function buscar(plantel: readonly JugadorDelPlantel[], jugadorId: string): JugadorDelPlantel | undefined {
  return plantel.find((j) => j.id === jugadorId);
}

/** Regla del arquero: el arquero solo va al arco y el arco solo admite arqueros. */
function reglaDelArquero(jugador: JugadorDelPlantel, puesto: PuestoId): MotivoRechazo | null {
  const esArquero = jugador.posicionNatural === "ARQ";
  if (esArquero && !esPuestoDeArquero(puesto)) return "arquero_fuera_del_arco";
  if (!esArquero && esPuestoDeArquero(puesto)) return "arco_solo_para_arqueros";
  return null;
}

function estaEnCancha(estado: Alineacion, jugadorId: string): boolean {
  return entradas(estado).some(([, o]) => o.jugadorId === jugadorId);
}

/**
 * Coloca un Jugador del Plantel en un Puesto. Si el Puesto estaba ocupado, el
 * anterior vuelve al Plantel. Solo se puede colocar un Jugador Disponible, del
 * Plantel y que no esté ya en la cancha (para eso está `mover`). Actualiza la
 * hora solo de ese Puesto.
 */
export function colocar(
  estado: Alineacion,
  jugadorId: string,
  puesto: PuestoId,
  plantel: readonly JugadorDelPlantel[],
  ahora: Date,
): ResultadoOperacion {
  if (!esPuestoDe(estado.esquema, puesto)) return rechazo("puesto_fuera_del_esquema");
  const jugador = buscar(plantel, jugadorId);
  if (!jugador) return rechazo("jugador_desconocido");
  if (!jugador.enPlantel) return rechazo("jugador_fuera_del_plantel");
  if (jugador.disponibilidad !== "disponible") return rechazo("jugador_no_disponible");
  if (estaEnCancha(estado, jugadorId)) return rechazo("jugador_ya_colocado");
  const arquero = reglaDelArquero(jugador, puesto);
  if (arquero) return rechazo(arquero);
  const puestos: Puestos = { ...estado.puestos, [puesto]: { jugadorId, modificadoEn: ahora } };
  return exito({ ...estado, puestos });
}

/**
 * Mueve el Jugador de `origen` a `destino`. Si `destino` está ocupado, los dos
 * Jugadores se intercambian. Actualiza la hora de los Puestos afectados
 * (`destino`, y `origen` si hubo intercambio). Mover a un Jugador que dejó de
 * estar Disponible está permitido: no es una elección nueva. Para verificar la
 * regla del arquero los Jugadores involucrados tienen que estar en la lista.
 */
export function mover(
  estado: Alineacion,
  origen: PuestoId,
  destino: PuestoId,
  plantel: readonly JugadorDelPlantel[],
  ahora: Date,
): ResultadoOperacion {
  if (!esPuestoDe(estado.esquema, origen) || !esPuestoDe(estado.esquema, destino)) {
    return rechazo("puesto_fuera_del_esquema");
  }
  const movido = estado.puestos[origen];
  if (!movido) return rechazo("puesto_vacio");
  if (origen === destino) return exito(estado);
  const desplazado = estado.puestos[destino];

  const jugadorMovido = buscar(plantel, movido.jugadorId);
  const jugadorDesplazado = desplazado ? buscar(plantel, desplazado.jugadorId) : undefined;
  if (!jugadorMovido || (desplazado && !jugadorDesplazado)) return rechazo("jugador_desconocido");
  const arquero =
    reglaDelArquero(jugadorMovido, destino) ?? (jugadorDesplazado ? reglaDelArquero(jugadorDesplazado, origen) : null);
  if (arquero) return rechazo(arquero);

  const puestos: Puestos = { ...estado.puestos, [destino]: { jugadorId: movido.jugadorId, modificadoEn: ahora } };
  if (desplazado) puestos[origen] = { jugadorId: desplazado.jugadorId, modificadoEn: ahora };
  else delete puestos[origen];
  return exito({ ...estado, puestos });
}

/**
 * Cambia el Esquema y lo marca como elegido a mano (`esquemaModificadoEn = ahora`).
 *
 * Cada Jugador va al Puesto equivalente del Esquema nuevo según la Tabla de
 * Equivalencias. Un Jugador que queda en el mismo código de Puesto conserva su
 * hora (su voto no cambió); uno que cambia de Puesto toma `ahora`.
 *
 * **Colisiones** (dos Puestos de origen caen en el mismo destino): se queda
 * uno y el otro vuelve al Plantel. Gana, en este orden:
 * 1. el que ya estaba en ese mismo código de Puesto (no se mueve);
 * 2. el que va antes en el orden de Puestos del Esquema de origen (del arquero
 *    hacia adelante y de izquierda a derecha, ver el Catálogo).
 *
 * Elegir el Esquema actual lo marca como elegido a mano si no lo estaba (el
 * Hincha confirmó el Esquema por defecto); si ya lo estaba, no cambia nada.
 */
export function cambiarEsquema(estado: Alineacion, destino: EsquemaId, ahora: Date): ResultadoOperacion {
  if (destino === estado.esquema) {
    if (estado.esquemaElegidoAMano) return exito(estado);
    return exito({ ...estado, esquemaElegidoAMano: true, esquemaModificadoEn: ahora });
  }
  const origen = estado.esquema;
  const traslados = entradas(estado).map(([p, ocupado]) => {
    const nuevo = puestoEquivalente(origen, p, destino);
    return { ocupado, nuevo, seQueda: nuevo === p };
  });
  // Primero los que no se mueven, después en el orden del Esquema de origen.
  const enOrden = [...traslados.filter((t) => t.seQueda), ...traslados.filter((t) => !t.seQueda)];
  const puestos: Puestos = {};
  for (const { ocupado, nuevo, seQueda } of enOrden) {
    if (puestos[nuevo]) continue; // colisión: vuelve al Plantel
    puestos[nuevo] = seQueda ? ocupado : { jugadorId: ocupado.jugadorId, modificadoEn: ahora };
  }
  return exito({ esquema: destino, esquemaElegidoAMano: true, esquemaModificadoEn: ahora, puestos });
}

/**
 * Saca al Jugador de un Puesto (vuelve al Plantel) y deja el Puesto vacío. No
 * recibe `ahora`: un Puesto vacío no guarda hora (no es un voto).
 */
export function quitar(estado: Alineacion, puesto: PuestoId): ResultadoOperacion {
  if (!esPuestoDe(estado.esquema, puesto)) return rechazo("puesto_fuera_del_esquema");
  if (!estado.puestos[puesto]) return rechazo("puesto_vacio");
  const puestos: Puestos = { ...estado.puestos };
  delete puestos[puesto];
  return exito({ ...estado, puestos });
}

/** ¿El Jugador puede estar hoy en ese Puesto? (del Plantel, Disponible y cumple la regla del arquero). */
function sigueValido(jugador: JugadorDelPlantel | undefined, puesto: PuestoId): boolean {
  return !!jugador && jugador.enPlantel && jugador.disponibilidad === "disponible" && reglaDelArquero(jugador, puesto) === null;
}

/**
 * Alineación heredada del Partido anterior para la Votación nueva: mismo
 * Esquema (y misma marca de elegido a mano), sin los Jugadores que no están
 * Disponibles, que salieron del Plantel, que no figuran en la lista o que ya
 * no cumplen la regla del arquero (les cambió la posición natural).
 *
 * **Conserva las horas originales** (de los Puestos y del Esquema): la
 * Alineación heredada cuenta como voto sin que el Hincha la toque, y los
 * desempates del Motor de Conteo premian lo que se consolidó antes; heredar
 * no es una modificación del Hincha. Nunca se rechaza.
 */
export function heredar(anterior: Alineacion, plantel: readonly JugadorDelPlantel[]): Alineacion {
  const puestos: Puestos = {};
  for (const [puesto, ocupado] of entradas(anterior)) {
    if (sigueValido(buscar(plantel, ocupado.jugadorId), puesto)) puestos[puesto] = ocupado;
  }
  return { ...anterior, puestos };
}

/**
 * ¿La Alineación está vacía? Vacía = sin Jugadores colocados y con el Esquema
 * sin elegir a mano. Una Alineación vacía no cuenta como voto (ADR-0001).
 */
export function estaVacia(estado: Alineacion): boolean {
  return !estado.esquemaElegidoAMano && entradas(estado).length === 0;
}

/**
 * Jugadores para elegir: los Disponibles del Plantel que no están en la
 * cancha, en el mismo orden en que vienen. Devuelve los mismos objetos
 * recibidos (con todos sus datos: nombre, número...).
 */
export function banco<J extends JugadorDelPlantel>(estado: Alineacion, plantel: readonly J[]): J[] {
  const enCancha = new Set(entradas(estado).map(([, o]) => o.jugadorId));
  return plantel.filter((j) => j.enPlantel && j.disponibilidad === "disponible" && !enCancha.has(j.id));
}

/** Minúsculas y sin tildes: "Núñez" y "nunez" se comparan igual. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Búsqueda en el banco (Selección): los Jugadores cuyo nombre contiene todas
 * las palabras buscadas, sin importar mayúsculas ni tildes, en el mismo orden
 * en que vienen. Con la búsqueda vacía devuelve la lista entera.
 */
export function buscarPorNombre<J extends { nombre: string }>(jugadores: readonly J[], busqueda: string): J[] {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [...jugadores];
  return jugadores.filter((j) => {
    const nombre = normalizar(j.nombre);
    return palabras.every((p) => nombre.includes(p));
  });
}

/** Forma JSON de una Alineación (para la base y el cliente). Horas en ISO 8601 UTC. */
export interface AlineacionJson {
  esquema: EsquemaId;
  esquemaElegidoAMano: boolean;
  esquemaModificadoEn?: string;
  puestos: Partial<Record<PuestoId, { jugadorId: string; modificadoEn: string }>>;
}

export type ResultadoDeserializar =
  | { readonly ok: true; readonly estado: Alineacion }
  | { readonly ok: false; readonly motivo: "formato_invalido" };

export function aJson(estado: Alineacion): AlineacionJson {
  const puestos: AlineacionJson["puestos"] = {};
  for (const [puesto, o] of entradas(estado)) {
    puestos[puesto] = { jugadorId: o.jugadorId, modificadoEn: o.modificadoEn.toISOString() };
  }
  return {
    esquema: estado.esquema,
    esquemaElegidoAMano: estado.esquemaElegidoAMano,
    ...(estado.esquemaModificadoEn ? { esquemaModificadoEn: estado.esquemaModificadoEn.toISOString() } : {}),
    puestos,
  };
}

/**
 * Lee una Alineación de una fuente no confiable (la base o el cliente): un
 * objeto ya parseado o un string JSON.
 *
 * Se rechaza (`formato_invalido`) solo si no hay de dónde sacar un Esquema
 * válido. Todo lo demás se sanea:
 * - `esquemaElegidoAMano` que no sea `true` cuenta como `false`;
 * - `esquemaModificadoEn` que no sea una hora ISO 8601 válida se descarta;
 * - se descartan los Puestos que no son del Esquema y las entradas sin
 *   `jugadorId` (string no vacío) o sin `modificadoEn` (hora ISO 8601 válida);
 * - si un Jugador aparece en más de un Puesto, se queda en el primero según el
 *   orden de Puestos del Esquema.
 *
 * No verifica la regla del arquero ni la Disponibilidad (no conoce el
 * Plantel): para eso está `heredar`, y el Motor de Conteo descarta los votos
 * inválidos.
 */
export function desdeJson(valor: unknown): ResultadoDeserializar {
  if (typeof valor === "string") {
    try {
      valor = JSON.parse(valor);
    } catch {
      return { ok: false, motivo: "formato_invalido" };
    }
  }
  if (!esObjeto(valor) || typeof valor.esquema !== "string" || !esEsquemaId(valor.esquema)) {
    return { ok: false, motivo: "formato_invalido" };
  }
  const esquemaId = valor.esquema;
  const crudos = esObjeto(valor.puestos) ? valor.puestos : {};
  const puestos: Puestos = {};
  const vistos = new Set<string>();
  for (const { id } of esquema(esquemaId).puestos) {
    if (!Object.hasOwn(crudos, id)) continue;
    const crudo = crudos[id];
    if (!esObjeto(crudo)) continue;
    const { jugadorId } = crudo;
    const modificadoEn = horaIso(crudo.modificadoEn);
    if (typeof jugadorId !== "string" || jugadorId === "" || !modificadoEn || vistos.has(jugadorId)) continue;
    vistos.add(jugadorId);
    puestos[id] = { jugadorId, modificadoEn };
  }
  const esquemaModificadoEn = horaIso(valor.esquemaModificadoEn);
  return {
    ok: true,
    estado: {
      esquema: esquemaId,
      esquemaElegidoAMano: valor.esquemaElegidoAMano === true,
      ...(esquemaModificadoEn ? { esquemaModificadoEn } : {}),
      puestos,
    },
  };
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

function horaIso(valor: unknown): Date | null {
  if (typeof valor !== "string" || !ISO_8601.test(valor)) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Puestos ocupados del Esquema, en el orden del Catálogo. */
function entradas(estado: Alineacion): [PuestoId, PuestoOcupado][] {
  return esquema(estado.esquema).puestos.flatMap((p) => {
    const ocupado = estado.puestos[p.id];
    return ocupado ? [[p.id, ocupado] as [PuestoId, PuestoOcupado]] : [];
  });
}

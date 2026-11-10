/**
 * Notificaciones push (lógica pura): a quién avisar qué.
 *
 * Recibe una foto del estado (Partidos, resultados, eventos de Disponibilidad,
 * Plantel, Alineaciones de la Votación abierta, Hinchas con suscripción y
 * notificaciones ya enviadas) y un `ahora` explícito, y devuelve los avisos que
 * faltan mandar. Cada aviso se identifica por `(hinchaId, tipo, referencia)`:
 * esa terna es la clave del registro de enviados (`notificacion_enviada`), así
 * que cada notificación sale una sola vez por Hincha y por evento.
 *
 * Eventos:
 * - `votacion_abierta`: abrió la Votación del Club del Hincha (referencia: Partido).
 * - `cierra_pronto`: la Votación abierta cierra en 3 horas o menos (referencia: Partido).
 *   Si al detectar la apertura ya cierra pronto, se manda solo este aviso.
 * - `once_elegido`: salió el 11 Elegido de un Partido del Club (estado
 *   `con_once`; los demás estados no avisan) cuyo cierre fue hace 48 horas o
 *   menos (referencia: Partido).
 * - `jugador_no_disponible`: un Jugador de la Alineación del Hincha para la
 *   Votación abierta dejó de estar Disponible desde que abrió la Votación y
 *   sigue sin estarlo (referencia: el evento de cambio de Disponibilidad; si un
 *   Jugador cambió varias veces, cuenta el último).
 *
 * Destinatarios: los avisos de un Club van a sus Hinchas con el interruptor
 * "mi club" prendido; los de la Selección, a todos los Hinchas (con Club o
 * sin Club) con "Selección" prendido. De la Selección se avisan
 * `votacion_abierta`, `cierra_pronto` y además (ticket 14):
 * - `convocatoria_cargada`: el Partido tiene Convocatoria y su Votación sigue
 *   abierta, con el Gran Ausente provisorio si lo hay (referencia: Partido).
 *   Corregir la Convocatoria no vuelve a avisar.
 * - `gran_ausente_final`: salió el 11 Elegido (`con_once`) y hay Convocatoria:
 *   al cierre si ya estaba, o cuando el Admin la carga tarde. Lleva el Gran
 *   Ausente final si alguno no convocado figura (referencia: Partido). Solo si
 *   lo último (cierre o Convocatoria) fue hace 48 horas o menos.
 * Todos uno por Partido (en una fecha doble hay dos Votaciones), nombrando al
 * Rival. `once_elegido` sigue siendo solo de los Clubes.
 */
import { votacionAbierta, votacionesAbiertas, type PartidoCalendario, type Votacion } from "@/domain/calendario";
import { SELECCION, type ClubId, type Disponibilidad } from "@/domain/comun/tipos";
import { destacado, granAusenteFinal, type Apariciones, type Convocatoria, type Destacado } from "@/domain/destacados";
import type { Alineacion, JugadorDelPlantel } from "@/domain/editor";
import { jugadoresNoDisponibles, type MotivoNoDisponible } from "@/domain/herencia";

export {
  LARGO_MAXIMO_ENDPOINT,
  validarSuscripcion,
  type SuscripcionPush,
  type ValidacionSuscripcion,
} from "./suscripcion";

export const TIPOS_DE_NOTIFICACION = [
  "votacion_abierta",
  "cierra_pronto",
  "once_elegido",
  "jugador_no_disponible",
  "convocatoria_cargada",
  "gran_ausente_final",
] as const;
export type TipoNotificacion = (typeof TIPOS_DE_NOTIFICACION)[number];

/** Partido de un Club con el nombre de su Rival (para el texto). */
export interface PartidoParaAvisos extends PartidoCalendario {
  rival: string;
}

/** Resultado de Votación congelado (tabla `resultado_votacion`). */
export interface ResultadoParaAvisos {
  partidoId: string;
  estado: "con_once" | "sin_alineaciones" | "anulada" | "nunca_abrio";
  /** Hora de cierre de la Votación. */
  cierre: Date;
}

/** Cambio de Disponibilidad de un Jugador (tabla `evento_disponibilidad`). */
export interface EventoDisponibilidad {
  id: string;
  jugadorId: string;
  disponibilidadNueva: Disponibilidad;
  momento: Date;
}

/** Jugador del Plantel con su estado ACTUAL y su nombre (para el texto). */
export interface JugadorParaAvisos extends JugadorDelPlantel {
  nombre: string;
}

export interface DatosDelClub {
  club: ClubId;
  /** Todos los Partidos del Club. */
  partidos: readonly PartidoParaAvisos[];
  /** Resultados de Partidos del Club (basta con los recientes). */
  resultados: readonly ResultadoParaAvisos[];
  /** Cambios de Disponibilidad de Jugadores del Club (basta con los de la Votación abierta). */
  eventos: readonly EventoDisponibilidad[];
  /** Jugadores del Club (incluidas las bajas). */
  plantel: readonly JugadorParaAvisos[];
  /** Alineaciones guardadas para la Votación ABIERTA del Club (vacío si no hay). */
  alineaciones: readonly { hinchaId: string; alineacion: Alineacion }[];
  /**
   * Partidos del Club cuya Votación ya tiene resultado congelado (cualquier
   * estado). Basta con el de la Votación que el Calendario ve abierta: si el
   * Partido se postergó después del cierre, esa Votación no se reabre y no
   * se avisa nada sobre ella.
   */
  partidosConResultado?: readonly string[];
}

/**
 * Los dos interruptores de notificaciones del Hincha (tabla
 * `preferencia_notificacion`): avisos de su Club y avisos de la Selección.
 */
export interface PreferenciasDeNotificacion {
  miClub: boolean;
  seleccion: boolean;
}

/** Sin preferencias guardadas, los dos interruptores están prendidos. */
export const PREFERENCIAS_POR_DEFECTO: PreferenciasDeNotificacion = { miClub: true, seleccion: true };

export type Interruptor = keyof PreferenciasDeNotificacion;

/** Los interruptores que ve el Hincha: sin Club, solo el de la Selección. */
export function interruptoresVisibles(club: ClubId | null): Interruptor[] {
  return club ? ["miClub", "seleccion"] : ["seleccion"];
}

/** Las preferencias leídas de `preferencia_notificacion` (sin fila: las de por defecto). */
export function preferenciasDesdeFila(fila: { mi_club: boolean; seleccion: boolean } | null): PreferenciasDeNotificacion {
  return fila ? { miClub: fila.mi_club, seleccion: fila.seleccion } : { ...PREFERENCIAS_POR_DEFECTO };
}

export interface HinchaConSuscripcion {
  id: string;
  /** Club Favorito de hoy (`null`: Hincha sin Club, solo recibe avisos de la Selección). */
  club: ClubId | null;
  /** Sin preferencias, `PREFERENCIAS_POR_DEFECTO`. */
  preferencias?: PreferenciasDeNotificacion;
}

/** Convocatoria de un Partido de la Selección (una fila por Partido al que se aplica). */
export interface ConvocatoriaParaAvisos {
  partidoId: string;
  /** Ids de los convocados. */
  convocados: Convocatoria;
  /** Última vez que se cargó o corrigió (`convocatoria.actualizado_en`). */
  actualizadaEn: Date;
}

/** Resultado congelado de un Partido de la Selección, con sus apariciones al cierre. */
export interface ResultadoDeLaSeleccionParaAvisos extends ResultadoParaAvisos {
  /** `resultado_votacion.apariciones` (null en `anulada` / `nunca_abrio`). */
  apariciones: Apariciones | null;
}

/**
 * Partidos de la Selección y lo que hace falta para sus avisos (uno por
 * Partido: en una fecha doble puede haber dos Votaciones abiertas).
 */
export interface DatosDeLaSeleccion {
  partidos: readonly PartidoParaAvisos[];
  /** Partidos de la Selección con resultado congelado: no se avisa nada de su Votación. */
  partidosConResultado?: readonly string[];
  /** Convocatorias de los Partidos (basta con las de Votaciones abiertas y resultados recientes). */
  convocatorias?: readonly ConvocatoriaParaAvisos[];
  /**
   * Apariciones de las Votaciones ABIERTAS con Convocatoria (para el Gran
   * Ausente provisorio). Sin ellas, el aviso sale sin Gran Ausente.
   */
  apariciones?: readonly { partidoId: string; apariciones: Apariciones }[];
  /** Resultados congelados de Partidos de la Selección (basta con los recientes). */
  resultados?: readonly ResultadoDeLaSeleccionParaAvisos[];
  /** Jugadores de la Selección (para nombrar al Gran Ausente). */
  plantel?: readonly { id: string; nombre: string }[];
}

export interface NotificacionEnviada {
  hinchaId: string;
  tipo: TipoNotificacion;
  referencia: string;
}

export interface EntradaAvisos {
  ahora: Date;
  /** Hinchas con al menos una suscripción push (los demás no reciben nada). */
  hinchas: readonly HinchaConSuscripcion[];
  clubes: readonly DatosDelClub[];
  /** Sin datos de la Selección, no se avisa nada de la Selección. */
  seleccion?: DatosDeLaSeleccion;
  /** Registro de enviados (puede traer de más: solo se usa para filtrar). */
  yaEnviadas: readonly NotificacionEnviada[];
}

/** Lo que muestra la notificación (lo lee `public/sw.js`). */
export interface MensajePush {
  titulo: string;
  cuerpo: string;
  /** Ruta de la app que abre el click. */
  url: string;
  /** Etiqueta de la notificación: una nueva con la misma etiqueta reemplaza a la anterior. */
  etiqueta: string;
}

export interface Aviso extends NotificacionEnviada {
  mensaje: MensajePush;
}

/** "Cierra pronto": se avisa cuando faltan esto o menos para el cierre (3 horas). */
export const AVISO_DE_CIERRE_MS = 3 * 60 * 60 * 1000;

/**
 * "Salió el 11 Elegido" solo para Votaciones que cerraron hace esto o menos
 * (48 horas): así un Hincha que activa las notificaciones no recibe avisos de
 * resultados viejos, y alcanza aunque el cron corra una vez por día.
 */
export const ANTIGUEDAD_MAXIMA_DEL_RESULTADO_MS = 48 * 60 * 60 * 1000;

const clave = (n: NotificacionEnviada) => `${n.hinchaId}|${n.tipo}|${n.referencia}`;

/**
 * Los avisos que faltan mandar en `entrada.ahora`, sin los ya enviados y sin
 * repetidos. Cada Hincha solo recibe avisos del Club de `entrada.hinchas`.
 */
export function avisosPendientes(entrada: EntradaAvisos): Aviso[] {
  const vistos = new Set(entrada.yaEnviadas.map(clave));
  const avisos: Aviso[] = [];
  const agregar = (aviso: Aviso) => {
    if (vistos.has(clave(aviso))) return;
    vistos.add(clave(aviso));
    avisos.push(aviso);
  };

  for (const datos of entrada.clubes) {
    const hinchas = entrada.hinchas.filter((h) => h.club === datos.club && preferenciasDe(h).miClub);
    for (const aviso of avisosDelClub(datos, hinchas, entrada.ahora)) agregar(aviso);
  }
  if (entrada.seleccion) {
    const hinchas = entrada.hinchas.filter((h) => preferenciasDe(h).seleccion);
    for (const aviso of avisosDeLaSeleccion(entrada.seleccion, hinchas, entrada.ahora)) agregar(aviso);
  }
  return avisos;
}

/** Las preferencias de un Hincha: sin ellas, las de por defecto (los dos interruptores prendidos). */
export const preferenciasDe = (h: Pick<HinchaConSuscripcion, "preferencias">): PreferenciasDeNotificacion =>
  h.preferencias ?? PREFERENCIAS_POR_DEFECTO;

/**
 * Las Votaciones abiertas de la Selección según el Calendario (puede haber dos
 * en una fecha doble), salvo las que ya tienen resultado congelado. El proceso
 * la usa también para saber qué datos cargar.
 */
export function votacionesAbiertasDeLaSeleccion(datos: DatosDeLaSeleccion, ahora: Date): Votacion[] {
  return votacionesAbiertas(datos.partidos, ahora, SELECCION).filter(
    (v) => !datos.partidosConResultado?.includes(v.partidoId),
  );
}

function avisosDeLaSeleccion(datos: DatosDeLaSeleccion, hinchas: readonly HinchaConSuscripcion[], ahora: Date): Aviso[] {
  const avisos: Aviso[] = [];
  for (const abierta of votacionesAbiertasDeLaSeleccion(datos, ahora)) {
    const partido = datos.partidos.find((p) => p.id === abierta.partidoId)!;
    const cierraPronto = abierta.cierra.getTime() - ahora.getTime() <= AVISO_DE_CIERRE_MS;
    const mensaje = cierraPronto ? mensajeCierraProntoSeleccion(partido) : mensajeVotacionAbiertaSeleccion(partido);
    for (const h of hinchas) avisos.push({ hinchaId: h.id, ...mensaje });

    const convocatoria = datos.convocatorias?.find((c) => c.partidoId === partido.id);
    if (convocatoria) {
      const delPartido = datos.apariciones?.find((a) => a.partidoId === partido.id)?.apariciones;
      const provisorio = delPartido ? destacado(delPartido, convocatoria.convocados) : null;
      const aviso = mensajeConvocatoriaCargada(partido, nombresDelDestacado(provisorio, datos.plantel));
      for (const h of hinchas) avisos.push({ hinchaId: h.id, ...aviso });
    }
  }

  // Gran Ausente final: al cierre si ya había Convocatoria, o cuando el Admin
  // la carga si la Votación ya cerró. Lo que pase último tiene que ser reciente.
  for (const resultado of datos.resultados ?? []) {
    if (resultado.estado !== "con_once") continue;
    const partido = datos.partidos.find((p) => p.id === resultado.partidoId);
    const convocatoria = datos.convocatorias?.find((c) => c.partidoId === resultado.partidoId);
    if (!partido || !convocatoria || resultado.cierre > ahora) continue;
    const desde = Math.max(resultado.cierre.getTime(), convocatoria.actualizadaEn.getTime());
    const antiguedad = ahora.getTime() - desde;
    if (antiguedad < 0 || antiguedad > ANTIGUEDAD_MAXIMA_DEL_RESULTADO_MS) continue;
    const final = granAusenteFinal(resultado.apariciones, convocatoria.convocados);
    const aviso = mensajeGranAusenteFinal(partido, nombresDelDestacado(final, datos.plantel));
    for (const h of hinchas) avisos.push({ hinchaId: h.id, ...aviso });
  }
  return avisos;
}

/** Los nombres del destacado ("A", "A y B", "A, B y C"); null si no hay o no se conocen. */
function nombresDelDestacado(d: Destacado | null, plantel: DatosDeLaSeleccion["plantel"]): string | null {
  if (!d) return null;
  const nombres = d.jugadores.map((j) => plantel?.find((p) => p.id === j.jugadorId)?.nombre);
  if (nombres.some((n) => !n)) return null;
  const lista = nombres as string[];
  return lista.length === 1 ? lista[0]! : `${lista.slice(0, -1).join(", ")} y ${lista.at(-1)}`;
}

function avisosDelClub(datos: DatosDelClub, hinchas: readonly HinchaConSuscripcion[], ahora: Date): Aviso[] {
  const avisos: Aviso[] = [];
  const abierta = votacionAbiertaDelClub(datos, ahora);
  if (abierta) {
    const partido = datos.partidos.find((p) => p.id === abierta.partidoId)!;
    const cierraPronto = abierta.cierra.getTime() - ahora.getTime() <= AVISO_DE_CIERRE_MS;
    const mensaje = cierraPronto ? mensajeCierraPronto(partido) : mensajeVotacionAbierta(partido);
    for (const h of hinchas) avisos.push({ hinchaId: h.id, ...mensaje });
    avisos.push(...avisosDeNoDisponibles(datos, hinchas, abierta.abre, ahora));
  }

  for (const resultado of datos.resultados) {
    const antiguedad = ahora.getTime() - resultado.cierre.getTime();
    if (resultado.estado !== "con_once" || antiguedad < 0 || antiguedad > ANTIGUEDAD_MAXIMA_DEL_RESULTADO_MS) continue;
    const partido = datos.partidos.find((p) => p.id === resultado.partidoId);
    if (!partido) continue;
    for (const h of hinchas) avisos.push({ hinchaId: h.id, ...mensajeOnceElegido(partido) });
  }
  return avisos;
}

/**
 * La Votación abierta del Club según el Calendario, salvo que ya tenga
 * resultado congelado (Partido postergado después del cierre): esa no se
 * reabre. El proceso la usa también para saber qué datos cargar.
 */
export function votacionAbiertaDelClub(
  datos: Pick<DatosDelClub, "partidos" | "partidosConResultado">,
  ahora: Date,
): Votacion | null {
  const abierta = votacionAbierta(datos.partidos, ahora);
  return abierta && !datos.partidosConResultado?.includes(abierta.partidoId) ? abierta : null;
}

function avisosDeNoDisponibles(
  datos: DatosDelClub,
  hinchas: readonly HinchaConSuscripcion[],
  abre: Date,
  ahora: Date,
): Aviso[] {
  // Último cambio de cada Jugador desde la apertura, si lo dejó no Disponible.
  const ultimo = new Map<string, EventoDisponibilidad>();
  for (const e of datos.eventos) {
    if (e.momento < abre || e.momento > ahora) continue;
    const previo = ultimo.get(e.jugadorId);
    if (!previo || e.momento > previo.momento) ultimo.set(e.jugadorId, e);
  }
  for (const [jugadorId, e] of ultimo) if (e.disponibilidadNueva === "disponible") ultimo.delete(jugadorId);
  if (ultimo.size === 0) return [];

  const delClub = new Set(hinchas.map((h) => h.id));
  const nombres = new Map(datos.plantel.map((j) => [j.id, j.nombre]));
  const avisos: Aviso[] = [];
  for (const { hinchaId, alineacion } of datos.alineaciones) {
    if (!delClub.has(hinchaId)) continue;
    // Solo los que HOY siguen sin estar Disponibles.
    for (const { jugadorId, motivo } of jugadoresNoDisponibles(alineacion, datos.plantel)) {
      const evento = ultimo.get(jugadorId);
      if (!evento) continue;
      const nombre = nombres.get(jugadorId) ?? "Un Jugador de tu Alineación";
      avisos.push({
        hinchaId,
        tipo: "jugador_no_disponible",
        referencia: evento.id,
        mensaje: {
          titulo: `${nombre} ${TEXTO_MOTIVO[motivo]}`,
          cuerpo: "Está en tu Alineación: cambialo antes de que cierre la Votación.",
          url: "/mi-alineacion",
          etiqueta: `no_disponible:${jugadorId}`,
        },
      });
    }
  }
  return avisos;
}

const TEXTO_MOTIVO: Record<MotivoNoDisponible, string> = {
  lesionado: "está lesionado",
  suspendido: "está suspendido",
  no_disponible: "no está disponible",
  fuera_del_plantel: "ya no está en el Plantel",
};

function mensajeOnceElegido(partido: PartidoParaAvisos): AvisoSinHincha {
  return {
    tipo: "once_elegido",
    referencia: partido.id,
    mensaje: {
      titulo: "Salió el 11 Elegido",
      cuerpo: `Mirá el 11 que eligió la hinchada para el partido contra ${partido.rival}.`,
      url: `/resultados/${partido.id}`,
      etiqueta: `once:${partido.id}`,
    },
  };
}

type AvisoSinHincha = Omit<Aviso, "hinchaId">;

function mensajeVotacionAbierta(partido: PartidoParaAvisos): AvisoSinHincha {
  return {
    tipo: "votacion_abierta",
    referencia: partido.id,
    mensaje: {
      titulo: "Abrió la Votación",
      cuerpo: `Ya podés armar tu 11 para el partido contra ${partido.rival}.`,
      url: "/mi-alineacion",
      etiqueta: `votacion:${partido.id}`,
    },
  };
}

function mensajeCierraPronto(partido: PartidoParaAvisos): AvisoSinHincha {
  return {
    tipo: "cierra_pronto",
    referencia: partido.id,
    mensaje: {
      titulo: "Cierra pronto la Votación",
      cuerpo: `Faltan menos de 3 horas para elegir tu 11 contra ${partido.rival}.`,
      url: "/mi-alineacion",
      etiqueta: `votacion:${partido.id}`,
    },
  };
}

/** Pantalla de la Selección con el Partido elegido (en una fecha doble hay dos). */
const urlDeLaSeleccion = (partido: PartidoParaAvisos) => `/seleccion?partido=${partido.id}`;

function mensajeVotacionAbiertaSeleccion(partido: PartidoParaAvisos): AvisoSinHincha {
  return {
    tipo: "votacion_abierta",
    referencia: partido.id,
    mensaje: {
      titulo: "Abrió la Votación de la Selección",
      cuerpo: `Ya podés armar tu 11 de la Selección contra ${partido.rival}.`,
      url: urlDeLaSeleccion(partido),
      etiqueta: `votacion:${partido.id}`,
    },
  };
}

function mensajeCierraProntoSeleccion(partido: PartidoParaAvisos): AvisoSinHincha {
  return {
    tipo: "cierra_pronto",
    referencia: partido.id,
    mensaje: {
      titulo: "Cierra pronto la Votación de la Selección",
      cuerpo: `Faltan menos de 3 horas para elegir tu 11 de la Selección contra ${partido.rival}.`,
      url: urlDeLaSeleccion(partido),
      etiqueta: `votacion:${partido.id}`,
    },
  };
}

function mensajeConvocatoriaCargada(partido: PartidoParaAvisos, granAusente: string | null): AvisoSinHincha {
  const contra = `Ya está la lista del DT para el partido contra ${partido.rival}.`;
  return {
    tipo: "convocatoria_cargada",
    referencia: partido.id,
    mensaje: {
      titulo: "Salió la Convocatoria de la Selección",
      cuerpo: granAusente ? `${contra} Gran Ausente por ahora: ${granAusente}.` : contra,
      url: `/seleccion/parcial?partido=${partido.id}`,
      etiqueta: `convocatoria:${partido.id}`,
    },
  };
}

function mensajeGranAusenteFinal(partido: PartidoParaAvisos, granAusente: string | null): AvisoSinHincha {
  const once = `Mirá el 11 que eligió la hinchada de la Selección para el partido contra ${partido.rival}.`;
  return {
    tipo: "gran_ausente_final",
    referencia: partido.id,
    mensaje: {
      titulo: "Salió el 11 Elegido de la Selección",
      cuerpo: granAusente ? `${once} Gran Ausente: ${granAusente}.` : once,
      url: `/seleccion/resultados/${partido.id}`,
      etiqueta: `once:${partido.id}`,
    },
  };
}

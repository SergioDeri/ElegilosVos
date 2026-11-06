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
 */
import { votacionAbierta, type PartidoCalendario, type Votacion } from "@/domain/calendario";
import type { ClubId, Disponibilidad } from "@/domain/comun/tipos";
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

export interface HinchaConSuscripcion {
  id: string;
  /** Club Favorito de hoy. */
  club: ClubId;
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
    const hinchas = entrada.hinchas.filter((h) => h.club === datos.club);
    for (const aviso of avisosDelClub(datos, hinchas, entrada.ahora)) agregar(aviso);
  }
  return avisos;
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
          url: "/",
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
      url: "/",
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
      url: "/",
      etiqueta: `votacion:${partido.id}`,
    },
  };
}

// Lecturas de las pantallas de resultados (servidor), de un Club o de la
// Selección (Selección, ticket 10: `/seleccion/resultados`). Todo con el
// cliente del usuario (RLS: los resultados de su Club y los de la Selección, y
// su propia Alineación), salvo el cierre a pedido, que usa la service role y
// solo para un Partido que el Hincha ya pudo leer.
import "server-only";
import { alineacionDesdeFila, COLUMNAS_ALINEACION } from "@/domain/armado";
import { CIERRE_ANTES_DEL_INICIO_MS, cierreDeVotacion } from "@/domain/calendario";
import { coincidencia, estadoResultadoDeLaBase, onceDesdeJson, type EstadoResultado } from "@/domain/cierre";
import { numeroDeClubDeLaBase, SELECCION, type ClubOSeleccion } from "@/domain/comun/tipos";
import type { Asignacion } from "@/domain/conteo";
import { esEsquemaId, type EsquemaId } from "@/domain/esquemas";
import { cerrarVotacion } from "@/lib/cierre/proceso";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import type { crearClienteServidor } from "@/lib/supabase/server";
import { esUuid } from "@/domain/comun/ids";
import { NOMBRE_RIVAL_DESCONOCIDO } from "@/domain/comun/textos";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export interface PartidoResultado {
  id: string;
  inicio: Date;
  cancelado: boolean;
  rival: string;
}

export interface ResultadoVista {
  estado: EstadoResultado;
  esquema: EsquemaId | null;
  once: Asignacion[];
  alineacionesQueCuentan: number;
  calculadoEn: Date;
}

export interface JugadorResultado {
  nombre: string;
  /** null en la Selección (sin número). */
  numero: number | null;
}

function aPartido(p: { id: string; inicio: string; estado: string; rival: { nombre: string } | null }): PartidoResultado {
  return { id: p.id, inicio: new Date(p.inicio), cancelado: p.estado === "cancelado", rival: p.rival?.nombre ?? NOMBRE_RIVAL_DESCONOCIDO };
}

/** Un Partido del Club del Hincha o de la Selección (o null si no existe o es de otro). */
export async function cargarPartido(supabase: Cliente, club: ClubOSeleccion, id: string): Promise<PartidoResultado | null> {
  if (!esUuid(id)) return null;
  const { data, error } = await supabase
    .from("partido")
    .select("id, inicio, estado, rival(nombre)")
    .eq("club_id", club)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? aPartido(data) : null;
}

/**
 * El último Partido del Club cuya Votación ya cerró, o null. Es el de cierre
 * más reciente entre el último Partido con el cierre (según su inicio) ya
 * pasado y el último resultado congelado: un Partido postergado o cancelado
 * después del cierre conserva su 11 Elegido aunque su inicio nuevo quede
 * más adelante.
 */
export async function cargarUltimoPartidoCerrado(supabase: Cliente, club: ClubOSeleccion, ahora: Date): Promise<PartidoResultado | null> {
  const [porInicio, porResultado] = await Promise.all([
    supabase
      .from("partido")
      .select("id, inicio, estado, rival(nombre)")
      .eq("club_id", club)
      // cierre = inicio - 1 h <= ahora
      .lte("inicio", new Date(ahora.getTime() + CIERRE_ANTES_DEL_INICIO_MS).toISOString())
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // RLS: los del Club del Hincha y los de la Selección; se filtra por dueño.
    supabase
      .from("resultado_votacion")
      .select("cierre, partido!inner(id, inicio, estado, club_id, rival(nombre))")
      .eq("partido.club_id", club)
      .order("cierre", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (porInicio.error) throw porInicio.error;
  if (porResultado.error) throw porResultado.error;
  const candidato = porInicio.data ? aPartido(porInicio.data) : null;
  const conResultado = porResultado.data ? aPartido(porResultado.data.partido) : null;
  if (!conResultado) return candidato;
  if (!candidato) return conResultado;
  // Si el candidato ya tiene resultado, el último resultado es igual o más reciente.
  const cierreResultado = new Date(porResultado.data!.cierre).getTime();
  return cierreResultado >= cierreDeVotacion(candidato.inicio).getTime() ? conResultado : candidato;
}

/**
 * El resultado congelado del Partido. Si la Votación ya cerró y todavía no
 * tiene resultado (el cron no corrió), dispara el cierre de ese Partido
 * (idempotente). Devuelve null si todavía no cerró o si el cierre falló.
 */
export async function cargarResultado(supabase: Cliente, partido: PartidoResultado, ahora: Date): Promise<ResultadoVista | null> {
  const leido = await leerResultado(supabase, partido.id);
  if (leido || ahora.getTime() < cierreDeVotacion(partido.inicio).getTime()) return leido;
  try {
    await cerrarVotacion(crearClienteAdmin(), partido.id, ahora);
  } catch (e) {
    console.error("No se pudo cerrar la Votación a pedido", partido.id, e);
    return null;
  }
  // Next memoiza los GET iguales durante el render: sin la señal, la segunda
  // lectura devolvería la primera (sin resultado) aunque el cierre ya lo creó.
  return leerResultado(supabase, partido.id, new AbortController().signal);
}

async function leerResultado(supabase: Cliente, partidoId: string, signal?: AbortSignal): Promise<ResultadoVista | null> {
  let consulta = supabase
    .from("resultado_votacion")
    .select("estado, esquema, once, alineaciones_que_cuentan, calculado_en")
    .eq("partido_id", partidoId);
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    estado: estadoResultadoDeLaBase(data.estado),
    esquema: data.esquema && esEsquemaId(data.esquema) ? data.esquema : null,
    once: onceDesdeJson(data.once),
    alineacionesQueCuentan: data.alineaciones_que_cuentan,
    calculadoEn: new Date(data.calculado_en),
  };
}

export interface ItemHistorial {
  partido: PartidoResultado;
  estado: EstadoResultado;
  /** Coincidencia entre el 11 Elegido y el 11 Real (ticket 14); null sin alguno de los dos. */
  aciertoOnceReal: number | null;
}

/** Historial: los resultados del Club (o de la Selección) con su Partido, del más reciente al más viejo. */
export async function cargarHistorial(supabase: Cliente, club: ClubOSeleccion): Promise<ItemHistorial[]> {
  const { data, error } = await supabase
    .from("resultado_votacion")
    .select("estado, once, partido!inner(id, inicio, estado, club_id, rival(nombre), once_real(jugadores))")
    .eq("partido.club_id", club);
  if (error) throw error;
  return data
    .filter((r) => r.partido)
    .map((r) => {
      const onceReal = r.partido!.once_real?.jugadores ?? null;
      const estado = estadoResultadoDeLaBase(r.estado);
      return {
        partido: aPartido(r.partido!),
        estado,
        aciertoOnceReal:
          onceReal && estado === "con_once" ? coincidencia(onceDesdeJson(r.once).map((a) => a.jugadorId), onceReal) : null,
      };
    })
    .sort((a, b) => b.partido.inicio.getTime() - a.partido.inicio.getTime());
}

/** Ids del 11 Real del Partido (ticket 14), o null si no está cargado. */
export async function cargarOnceReal(supabase: Cliente, partidoId: string): Promise<string[] | null> {
  const { data, error } = await supabase.from("once_real").select("jugadores").eq("partido_id", partidoId).maybeSingle();
  if (error) throw error;
  return data?.jugadores ?? null;
}

/** Jugadores del Club (o de la Selección, sin número) por id (incluye bajas: el historial los nombra). */
export async function cargarJugadores(supabase: Cliente, club: ClubOSeleccion): Promise<Map<string, JugadorResultado>> {
  const { data, error } = await supabase.from("jugador").select("id, nombre, numero").eq("club_id", club);
  if (error) throw error;
  return new Map(
    data.map((j) => [j.id, { nombre: j.nombre, numero: club === SELECCION ? null : numeroDeClubDeLaBase(j.numero) }]),
  );
}

/** Ids de los Jugadores de la Alineación del Hincha para el Partido, o null si no tiene. */
export async function cargarMisJugadores(supabase: Cliente, partidoId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("alineacion")
    .select(COLUMNAS_ALINEACION)
    .eq("partido_id", partidoId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return Object.values(alineacionDesdeFila(data).puestos).map((o) => o!.jugadorId);
}

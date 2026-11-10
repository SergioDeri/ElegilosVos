// Parcial en vivo (ticket 11), del lado del servidor.
//
//   const parcial = await obtenerParcial(partidoId);  // Hincha: solo de su Club y con la Votación abierta
//   const resultado = await calcularParcialCacheado(partidoId); // SIN control de acceso: solo backoffice (tras requerirAdmin)
//   const seleccion = await obtenerParcialDeLaSeleccion(partidoId); // cualquier Hincha; con el Más Pedido (ticket 08 del feature Selección)
//
// El cálculo lee TODAS las Alineaciones del Partido con la service role (RLS no
// deja leer las ajenas), corre el Motor de Conteo y devuelve solo el resultado
// agregado. Queda en caché por Partido como mucho SEGUNDOS_DE_CACHE_DEL_PARCIAL.
import "server-only";
import { unstable_cache } from "next/cache";
import { SELECCION } from "@/domain/comun/tipos";
import type { ResultadoConteo } from "@/domain/conteo";
import { requerirHincha } from "@/lib/auth/sesion";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { contarPartido } from "@/lib/votacion/conteo";
import { parcialParaHincha, type ParcialParaHincha } from "./acceso";
import { calcularParcialDeLaSeleccion, type ParcialDeLaSeleccion } from "./seleccion";

export type { ParcialParaHincha } from "./acceso";
export type { ParcialDeLaSeleccion } from "./seleccion";

/** TTL de la caché del Parcial (el ticket pide como máximo un minuto). */
export const SEGUNDOS_DE_CACHE_DEL_PARCIAL = 30;

/** Etiqueta de caché del Parcial de un Partido (para `revalidateTag`, por ejemplo al cerrar). */
export function etiquetaDelParcial(partidoId: string): string {
  return `parcial:${partidoId}`;
}

async function calcularParcial(partidoId: string): Promise<ResultadoConteo | null> {
  const conteo = await contarPartido(crearClienteAdmin(), partidoId);
  return conteo?.resultado ?? null;
}

/**
 * Parcial del Partido, con caché corta por Partido. NO controla el acceso:
 * los Hinchas pasan por `obtenerParcial`; el backoffice, después de
 * `requerirAdmin()`. `null` si el Partido no existe.
 */
export function calcularParcialCacheado(partidoId: string): Promise<ResultadoConteo | null> {
  return unstable_cache(calcularParcial, ["parcial", partidoId], {
    revalidate: SEGUNDOS_DE_CACHE_DEL_PARCIAL,
    tags: [etiquetaDelParcial(partidoId)],
  })(partidoId);
}

/**
 * Parcial para el Hincha de la sesión: exige sesión y Club Favorito
 * (`requerirHincha`), y que el Partido sea de su Club y tenga la Votación
 * abierta. Si no, `prohibido` / `no_abierta` (nunca el Parcial de otro Club).
 */
export async function obtenerParcial(partidoId: string): Promise<ParcialParaHincha> {
  const hincha = await requerirHincha();
  const supabase = await crearClienteServidor();
  return parcialParaHincha(supabase, hincha.clubFavorito, partidoId, calcularParcialCacheado);
}

function calcularParcialDeLaSeleccionConServicio(partidoId: string): Promise<ParcialDeLaSeleccion | null> {
  return calcularParcialDeLaSeleccion(crearClienteAdmin(), partidoId);
}

/**
 * Parcial de un Partido de la Selección, con caché corta por Partido (la
 * misma etiqueta que el de los Clubes). NO controla el acceso. `null` si el
 * Partido no existe o no es de la Selección.
 */
export function calcularParcialDeLaSeleccionCacheado(partidoId: string): Promise<ParcialDeLaSeleccion | null> {
  return unstable_cache(calcularParcialDeLaSeleccionConServicio, ["parcial-seleccion", partidoId], {
    revalidate: SEGUNDOS_DE_CACHE_DEL_PARCIAL,
    tags: [etiquetaDelParcial(partidoId)],
  })(partidoId);
}

/**
 * Parcial de la Selección para el Hincha de la sesión: cualquier Hincha (de
 * los dos Clubes; un solo resultado, sin separar por hinchada), si el Partido
 * es de la Selección y su Votación está abierta.
 */
export async function obtenerParcialDeLaSeleccion(partidoId: string): Promise<ParcialParaHincha<ParcialDeLaSeleccion>> {
  await requerirHincha();
  const supabase = await crearClienteServidor();
  return parcialParaHincha(supabase, SELECCION, partidoId, calcularParcialDeLaSeleccionCacheado);
}

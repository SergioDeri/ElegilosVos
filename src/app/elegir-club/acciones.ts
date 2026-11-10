"use server";

import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/sesion";
import { RUTA_INICIO, RUTA_SELECCION } from "@/lib/auth/rutas";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ResultadoEleccion = { error: string } | undefined;

/**
 * Fija el Club Favorito del Hincha de la sesión. La regla "una sola vez" la
 * hace cumplir la base (función elegir_club_favorito + trigger), no esto.
 */
export async function elegirClubFavorito(club: string): Promise<ResultadoEleccion> {
  await requerirSesion();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("elegir_club_favorito", { club });

  if (error?.code === "EV001") redirect(RUTA_INICIO); // ya lo tenía: no se cambia
  if (error) return { error: "No se pudo guardar tu Club. Probá de nuevo." };
  redirect(RUTA_INICIO);
}

/**
 * "Quiero votar solo por la Selección" (Selección, ticket 06): el Hincha queda
 * sin Club Favorito pero con la elección hecha, y entra directo a la Selección.
 * Puede elegir Club más tarde. Si ya tenía Club (EV001), al inicio de su Club.
 */
export async function elegirSoloSeleccion(): Promise<ResultadoEleccion> {
  await requerirSesion();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("elegir_solo_seleccion");

  if (error?.code === "EV001") redirect(RUTA_INICIO);
  if (error) return { error: "No se pudo guardar tu elección. Probá de nuevo." };
  redirect(RUTA_SELECCION);
}

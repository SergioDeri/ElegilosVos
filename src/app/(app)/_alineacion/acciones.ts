"use server";

import { filaDesdeAlineacion, validarAlineacion } from "@/domain/armado";
import { desdeJson, type MotivoRechazo } from "@/domain/editor";
import { requerirHinchada } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { leerPlantel } from "@/lib/club/lecturas";
import { cargarAlineacion } from "./datos";
import { esUuid } from "@/domain/comun/ids";
import { clubOSeleccionDeLaBase, SELECCION } from "@/domain/comun/tipos";

export type ResultadoGuardado =
  | { ok: true }
  /** La Votación no está abierta (o el Partido no es de su Club ni de la Selección). */
  | { ok: false; error: "votacion_cerrada" }
  /** La Alineación no respeta las reglas contra el Plantel actual. */
  | { ok: false; error: "invalida"; motivo: MotivoRechazo | "formato_invalido" }
  /** Falla de red o de la base: se puede reintentar. */
  | { ok: false; error: "fallo" };

/**
 * Guarda (upsert) la Alineación del Hincha de la sesión para un Partido.
 * No confía en el cliente: lee la Alineación con `desdeJson`, la valida con las
 * reglas del Editor contra el Plantel actual y escribe con el cliente del
 * usuario, así que RLS exige que sea suya, de su Club (o de la Selección) y con la Votación
 * abierta. Las horas de modificación las sella la base.
 */
export async function guardarAlineacion(partidoId: unknown, alineacion: unknown): Promise<ResultadoGuardado> {
  // Cualquier Hincha que eligió su hinchada: el que no tiene Club solo puede la Selección (abajo y en RLS).
  const hincha = await requerirHinchada();
  if (!esUuid(partidoId)) return { ok: false, error: "votacion_cerrada" };

  const leida = desdeJson(alineacion);
  if (!leida.ok) return { ok: false, error: "invalida", motivo: "formato_invalido" };

  const supabase = await crearClienteServidor();
  try {
    const [{ data: abierta, error }, { data: partido, error: errorPartido }] = await Promise.all([
      supabase.rpc("votacion_abierta", { partido: partidoId }),
      supabase.from("partido").select("club_id").eq("id", partidoId).maybeSingle(),
    ]);
    if (error) throw error;
    if (errorPartido) throw errorPartido;
    if (!abierta || !partido) return { ok: false, error: "votacion_cerrada" };
    // Un Partido de su Club o de la Selección (RLS no le deja ver otros).
    const club = clubOSeleccionDeLaBase(partido.club_id);
    if (club !== SELECCION && club !== hincha.clubFavorito) return { ok: false, error: "votacion_cerrada" };

    const [plantel, guardada] = await Promise.all([leerPlantel(supabase, club), cargarAlineacion(supabase, partidoId)]);
    const validacion = validarAlineacion(leida.estado, guardada, plantel);
    if (!validacion.ok) return { ok: false, error: "invalida", motivo: validacion.motivo };

    const { error: errorGuardado } = await supabase
      .from("alineacion")
      .upsert({ partido_id: partidoId, ...filaDesdeAlineacion(leida.estado) }, { onConflict: "hincha_id,partido_id" });
    // 42501: RLS la rechazó (por ejemplo, la Votación cerró entre la verificación y la escritura).
    if (errorGuardado?.code === "42501") return { ok: false, error: "votacion_cerrada" };
    if (errorGuardado) throw errorGuardado;
    return { ok: true };
  } catch (e) {
    console.error("guardarAlineacion", e);
    return { ok: false, error: "fallo" };
  }
}

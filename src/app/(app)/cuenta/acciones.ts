"use server";

import { redirect } from "next/navigation";
import { confirmaBorrado } from "@/domain/cuenta";
import { requerirSesion } from "@/lib/auth/sesion";
import { RUTA_LOGIN } from "@/lib/auth/rutas";
import { borrarCuentaDeSesion } from "@/lib/cuenta/borrado";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoBorrado = { error: string } | null;

/**
 * Borra la cuenta del Hincha de la sesión. No recibe ningún id: el que se
 * borra es siempre el usuario de la sesión. Exige la confirmación escrita.
 */
export async function borrarMiCuenta(_previo: EstadoBorrado, formulario: FormData): Promise<EstadoBorrado> {
  const hincha = await requerirSesion();
  const escrito = formulario.get("confirmacion");
  if (typeof escrito !== "string" || !confirmaBorrado(escrito, hincha.email)) {
    return { error: "El texto no coincide. Escribilo exactamente para confirmar." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await borrarCuentaDeSesion(supabase, crearClienteAdmin());
  if (!resultado.ok) return { error: resultado.mensaje };

  // El usuario ya no existe: cerrar la sesión solo limpia las cookies (si Auth
  // responde con error porque la sesión ya no existe, se ignora).
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  redirect(`${RUTA_LOGIN}?cuenta=borrada`);
}

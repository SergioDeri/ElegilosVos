// Hinchas de prueba para los E2E. Se crean con la service role (email ya
// confirmado, sin pasar por el registro ni hacer login) y se borran al final
// de cada test: ver la fixture `crearHincha` de ./fixtures.ts.
import type { ClubId, Rol } from "@/domain/comun/tipos";
import { obtenerEntornoSupabase } from "../rls/entorno";
import { clienteDeServicio, type Cliente } from "../rls/usuarios";

export const CONTRASENA_E2E = "contrasena-e2e-123";

export type HinchaDePrueba = {
  id: string;
  email: string;
  contrasena: string;
  club: ClubId | null;
};

export type OpcionesHincha = {
  /** Club Favorito; `null` = todavía no eligió (va a /elegir-club). */
  club: ClubId | null;
  rol?: Rol;
};

let servicio: Cliente | undefined;

/** Cliente con la service role de Supabase local: saltea RLS. Solo para preparar o limpiar datos. */
export function clienteServicio(): Cliente {
  servicio ??= clienteDeServicio(obtenerEntornoSupabase());
  return servicio;
}

export async function crearHinchaDePrueba(opciones: OpcionesHincha): Promise<HinchaDePrueba> {
  const email = `e2e.${crypto.randomUUID()}@e2e.test`;
  const { data, error } = await clienteServicio().auth.admin.createUser({
    email,
    password: CONTRASENA_E2E,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;

  // El trigger al_crear_usuario_crear_perfil ya creó el perfil (sin Club, rol hincha).
  if (opciones.club !== null || (opciones.rol && opciones.rol !== "hincha")) {
    const { error: errorPerfil } = await clienteServicio()
      .from("perfil")
      .update({ club_favorito_id: opciones.club, rol: opciones.rol ?? "hincha" })
      .eq("id", id);
    if (errorPerfil) throw errorPerfil;
  }

  return { id, email, contrasena: CONTRASENA_E2E, club: opciones.club };
}

export async function borrarHinchaDePrueba(id: string) {
  const { error } = await clienteServicio().auth.admin.deleteUser(id);
  if (error && error.status !== 404) throw error;
}

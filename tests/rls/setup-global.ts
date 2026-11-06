// Setup global del proyecto "rls" de Vitest: corre una vez por `npm run test:rls`.
// Crea los usuarios estándar (Hincha de Peñarol, Hincha de Nacional y Admin),
// inicia sesión una sola vez con cada uno (para no chocar con el rate limit de
// Auth) y pasa los tokens a los tests con `provide`.
import type { TestProject } from "vitest/node";
import { obtenerEntornoSupabase, type EntornoSupabase } from "./entorno";
import {
  borrarUsuarioDePrueba,
  crearUsuarioDePrueba,
  USUARIOS_ESTANDAR,
  type NombreUsuarioEstandar,
  type UsuarioDePrueba,
} from "./usuarios";

declare module "vitest" {
  export interface ProvidedContext {
    entornoSupabase: EntornoSupabase;
    usuariosEstandar: Record<NombreUsuarioEstandar, UsuarioDePrueba>;
  }
}

export default async function setup(project: TestProject) {
  const entorno = obtenerEntornoSupabase();

  const usuarios = {} as Record<NombreUsuarioEstandar, UsuarioDePrueba>;
  for (const nombre of Object.keys(USUARIOS_ESTANDAR) as NombreUsuarioEstandar[]) {
    usuarios[nombre] = await crearUsuarioDePrueba(entorno, USUARIOS_ESTANDAR[nombre]);
  }

  project.provide("entornoSupabase", entorno);
  project.provide("usuariosEstandar", usuarios);

  return async () => {
    for (const usuario of Object.values(usuarios)) {
      await borrarUsuarioDePrueba(entorno, usuario.id);
    }
  };
}

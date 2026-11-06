// Cliente con la SERVICE ROLE: saltea RLS. Solo para procesos de servidor que
// lo necesitan de verdad (cierre de Votación, envío de push, borrado de cuenta).
// `server-only` hace fallar el build si alguien lo importa desde el cliente.
// Nunca exponer la clave ni devolver datos individuales a un Hincha con esto.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseUrl, variableRequerida } from "./env";

export function crearClienteAdmin() {
  return createClient<Database>(
    supabaseUrl(),
    variableRequerida("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

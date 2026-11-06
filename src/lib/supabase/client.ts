// Cliente de Supabase para Client Components (navegador). Usa solo la anon
// key: toda la autorización la hace RLS en Postgres.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

export function crearClienteNavegador() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}

// Cliente de Supabase para Server Components, Server Actions y Route Handlers.
// Actúa como el usuario de la sesión (cookies), con la anon key y RLS.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

export async function crearClienteServidor() {
  const almacen = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(cookiesParaGuardar) {
        try {
          for (const { name, value, options } of cookiesParaGuardar) {
            almacen.set(name, value, options);
          }
        } catch {
          // Desde un Server Component no se pueden escribir cookies. Se puede
          // ignorar si el proxy (src/proxy.ts, ticket 04) refresca la sesión.
        }
      },
    },
  });
}

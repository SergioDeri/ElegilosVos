// Refresco de la sesión de Supabase en el proxy de Next (src/proxy.ts).
// Lee las cookies del pedido, refresca el token si venció y deja las cookies
// nuevas tanto en el pedido (para los Server Components de este mismo render)
// como en la respuesta (para el navegador).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

export type SesionDelProxy = {
  /** Respuesta "seguir" con las cookies de sesión ya puestas. */
  respuesta: NextResponse;
  /** true si hay una sesión con JWT válido. */
  conSesion: boolean;
  /** Copia las cookies (y headers anti-caché) de la sesión a otra respuesta, p. ej. un redirect. */
  aplicarA: (otra: NextResponse) => NextResponse;
};

export async function actualizarSesion(request: NextRequest): Promise<SesionDelProxy> {
  let respuesta = NextResponse.next({ request });
  let headersSinCache: Record<string, string> = {};

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies, headers) {
        for (const { name, value } of cookies) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of cookies) respuesta.cookies.set(name, value, options);
        headersSinCache = { ...headersSinCache, ...headers };
        for (const [clave, valor] of Object.entries(headersSinCache)) respuesta.headers.set(clave, valor);
      },
    },
  });

  // getClaims() valida la firma del JWT (y lo refresca si venció). No poner
  // código entre crear el cliente y esta llamada.
  const { data } = await supabase.auth.getClaims();

  return {
    respuesta,
    conSesion: Boolean(data?.claims?.sub),
    aplicarA(otra) {
      for (const cookie of respuesta.cookies.getAll()) otra.cookies.set(cookie);
      for (const [clave, valor] of Object.entries(headersSinCache)) otra.headers.set(clave, valor);
      return otra;
    },
  };
}

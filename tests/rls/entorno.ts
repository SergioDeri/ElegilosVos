// Resuelve la URL y las claves del Supabase local. Si las variables
// SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY
// están definidas se usan esas; si no, se leen de `supabase status`.
import { execFileSync } from "node:child_process";
import path from "node:path";

export type EntornoSupabase = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export function obtenerEntornoSupabase(): EntornoSupabase {
  const { SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_TEST_URL && SUPABASE_TEST_ANON_KEY && SUPABASE_TEST_SERVICE_ROLE_KEY) {
    return {
      url: SUPABASE_TEST_URL,
      anonKey: SUPABASE_TEST_ANON_KEY,
      serviceRoleKey: SUPABASE_TEST_SERVICE_ROLE_KEY,
    };
  }

  const binario = path.resolve("node_modules/.bin/supabase");
  let salida: string;
  try {
    salida = execFileSync(binario, ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "No se pudo leer `supabase status`. ¿Está corriendo Supabase local? " +
        "Levantalo con `npx supabase start` (requiere Docker).",
    );
  }

  const variables = new Map<string, string>();
  for (const linea of salida.split("\n")) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(linea.trim());
    if (m) variables.set(m[1], m[2]);
  }
  const url = variables.get("API_URL");
  const anonKey = variables.get("ANON_KEY");
  const serviceRoleKey = variables.get("SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("`supabase status` no devolvió API_URL, ANON_KEY y SERVICE_ROLE_KEY");
  }
  return { url, anonKey, serviceRoleKey };
}

// Tests E2E: Playwright contra la app en local (`next dev`) y Supabase local.
// Se corren con `npm run test:e2e` (no entran en `npm test`). Ver la sección
// "Tests E2E" de docs/DESARROLLO.md.
import { defineConfig, devices } from "@playwright/test";
import { obtenerEntornoSupabase } from "./tests/rls/entorno";

// Puerto propio, distinto del 3000 de `npm run dev`, para poder correr los
// E2E con la app de desarrollo levantada (o varios worktrees a la vez).
const puerto = Number(process.env.E2E_PORT ?? 3100);
const urlApp = `http://localhost:${puerto}`;

// Siempre contra Supabase local: las claves salen de `supabase status` (o de
// SUPABASE_TEST_*), nunca de .env.local, que podría apuntar a producción.
// Se guardan en process.env para que los workers no vuelvan a calcularlas.
const supabase = obtenerEntornoSupabase();
process.env.SUPABASE_TEST_URL = supabase.url;
process.env.SUPABASE_TEST_ANON_KEY = supabase.anonKey;
process.env.SUPABASE_TEST_SERVICE_ROLE_KEY = supabase.serviceRoleKey;

export default defineConfig({
  testDir: "tests/e2e",
  // Comparten la base (y el rate limit de logins de Auth): de a un test.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  // `next dev` compila cada ruta la primera vez que se pide: margen amplio.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: urlApp,
    locale: "es-UY",
    timezoneId: "America/Montevideo",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${puerto}`,
    url: urlApp,
    // Si el puerto ya está ocupado (otro worktree, otra app) falla en vez de
    // correr los tests contra un servidor ajeno.
    reuseExistingServer: false,
    timeout: 120_000,
    // Las variables del proceso le ganan a .env.local en Next.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
      NEXT_PUBLIC_SITE_URL: urlApp,
    },
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        // Lógica pura: sin red, sin Next, sin Supabase. Tests junto al código.
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        // Políticas de acceso contra Supabase local (`npx supabase start`).
        resolve: { alias },
        test: {
          name: "rls",
          environment: "node",
          include: ["tests/rls/**/*.test.ts"],
          globalSetup: ["tests/rls/setup-global.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // Comparten la misma base: se corren de a un archivo para evitar
          // interferencias entre tests que crean o modifican datos.
          fileParallelism: false,
        },
      },
    ],
  },
});

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Los módulos de dominio son lógica pura: no pueden depender de Next,
  // React, Supabase ni del resto de la app.
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*"], message: "src/domain es lógica pura: sin Next ni React." },
            { group: ["@supabase/*"], message: "src/domain es lógica pura: sin Supabase." },
            { group: ["@/lib/*", "@/app/*", "@/components/*"], message: "src/domain no puede depender de la app." },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    // Worktrees de agentes.
    ".claude/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generado por `npm run db:types`.
    "src/lib/supabase/database.types.ts",
  ]),
]);

export default eslintConfig;

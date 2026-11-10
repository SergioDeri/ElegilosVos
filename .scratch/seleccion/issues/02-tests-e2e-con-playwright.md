# 02: Tests E2E con Playwright

**What to build:** El proyecto suma tests de punta a punta en el navegador. Playwright corre contra la app en local (`npm run dev` o build) con Supabase local, con un comando propio `test:e2e` que no entra en `npm test`. Los datos de ejemplo de los E2E van en un seed nuevo y los usuarios los crea y borra cada test (respetando los rate limits de Auth). El primer flujo es un smoke test de algo que ya existe: un Hincha con Club inicia sesión con email y ve su pantalla principal. La guía de desarrollo documenta cómo correrlos y que los tickets del feature Selección los incluyen en su checklist de "antes de terminar".

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `npm run test:e2e` levanta lo necesario y corre Playwright contra Supabase local
- [x] Helpers para crear un usuario de prueba (con o sin Club Favorito) e iniciar sesión desde el test
- [x] Smoke test: un Hincha con Club inicia sesión y ve su pantalla principal
- [x] `npm test` no corre los E2E
- [x] `docs/DESARROLLO.md` documenta requisitos y comandos de los E2E
- [x] Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls`

-- =============================================================================
-- Ticket 17: revisión de seguridad antes de publicar.
--
-- Supabase da por defecto TODOS los privilegios sobre las tablas de `public`
-- a `anon` y `authenticated`, y EXECUTE de toda función nueva a PUBLIC, `anon`
-- y `authenticated`. RLS ya niega las filas, pero quitamos lo que nadie usa
-- (mínimo privilegio, defensa en profundidad):
--
--   * TRUNCATE, TRIGGER, REFERENCES y MAINTAIN (Postgres 17: VACUUM, LOCK...) en todas las tablas de `public` para
--     `anon` y `authenticated` (TRUNCATE ni siquiera pasa por RLS).
--   * Escritura sobre `club` (fijos) y escritura de `anon` sobre `jugador`.
--   * EXECUTE de PUBLIC y `anon` en todas las funciones de `public`: ningún
--     visitante sin sesión necesita llamar funciones (la única lectura pública,
--     `club`, es una tabla con una política `using (true)`).
--   * `tocar_actualizado_en()` es de trigger: nadie la llama por la API.
--   * Privilegios por defecto: las tablas y funciones que creen migraciones
--     futuras (rol `postgres`) ya no nacen con TRUNCATE/TRIGGER/REFERENCES
--     para la API ni con EXECUTE para PUBLIC/`anon`. Una función que deba
--     poder llamar un usuario con sesión necesita su `grant execute ... to
--     authenticated` (ya lo hacen todas las migraciones existentes).
--
-- Se mantiene a propósito el SELECT de `anon` sobre las tablas con RLS sin
-- políticas para `anon`: un select denegado devuelve [] en vez de error, que
-- es el contrato que prueban los tests de RLS (README, "Tests de RLS").
--
-- tests/rls/17-seguridad.test.ts consulta el catálogo y falla si aparece una
-- tabla sin RLS, una SECURITY DEFINER sin search_path fijo, una función
-- ejecutable por `anon` o un privilegio de la API fuera de la lista esperada.
-- =============================================================================

-- Tablas -----------------------------------------------------------------------
revoke truncate, trigger, references, maintain on all tables in schema public from anon, authenticated;

-- Los Clubes son fijos: nadie los escribe por la API (solo la política de lectura).
revoke insert, update, delete on public.club from anon, authenticated;

-- `anon` no tiene políticas de escritura sobre `jugador`: solo el Admin con 2FA escribe.
revoke insert, update, delete on public.jugador from anon;

-- Funciones --------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

-- Función de trigger: los triggers no exigen EXECUTE al usuario que dispara.
revoke execute on function public.tocar_actualizado_en() from authenticated;

-- Privilegios por defecto para lo que creen las migraciones futuras -------------
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres
  revoke execute on functions from public;

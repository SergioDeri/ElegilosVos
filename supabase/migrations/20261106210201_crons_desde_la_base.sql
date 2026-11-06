-- =============================================================================
-- Los procesos programados los dispara la base: pg_cron + pg_net.
--
-- Cada minuto, pg_cron llama por HTTP a las rutas de cron de la app:
--   /api/cron/cierre, /api/cron/herencia y /api/cron/notificaciones
-- con `Authorization: Bearer <CRON_SECRET>` (las rutas lo verifican con
-- `cronAutorizado`). Reemplaza los crons de `vercel.json` (Vercel Hobby solo
-- permite uno por día).
--
-- La URL de la app y el secreto viven en Supabase Vault (secretos `app_url`
-- y `cron_secret`); esta migración no contiene ninguno de los dos. Los jobs
-- leen Vault en cada corrida, así que cambiar un secreto no requiere volver
-- a agendar; el secreto nunca queda escrito en `cron.job`.
--
-- `programar_crons()` agenda (o re-agenda) los tres jobs de forma
-- idempotente. Si faltan los secretos no agenda nada y deja un NOTICE (por
-- eso esta migración no falla en una base nueva). Pasos para producción y
-- para verlo en local: README, sección "Procesos programados".
-- `desprogramar_crons()` los saca.
--
-- Solo para postgres y service role (nunca anon ni authenticated).
-- =============================================================================

-- En Supabase, pg_cron va en pg_catalog (crea el esquema `cron`) y pg_net en
-- `extensions` (crea el esquema `net`).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Nota de seguridad: Supabase (supabase_admin) le da a anon y authenticated
-- EXECUTE sobre net.http_get/http_post al crear pg_net, y postgres no puede
-- revocar esos permisos. No es una vía de ataque: el esquema `net` no está
-- expuesto por la API (solo `public` y `graphql_public`) y un usuario de la
-- app no puede ejecutar SQL arbitrario; ninguna función de `public` llama a
-- `net` salvo los jobs de pg_cron (que corren como postgres).

create or replace function public.programar_crons()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  secreto text;
  ruta text;
  nombre text;
  agendados text[] := '{}';
begin
  select s.decrypted_secret into app_url from vault.decrypted_secrets s where s.name = 'app_url';
  select s.decrypted_secret into secreto from vault.decrypted_secrets s where s.name = 'cron_secret';

  if coalesce(btrim(app_url), '') = '' or coalesce(btrim(secreto), '') = '' then
    raise notice 'programar_crons: faltan los secretos app_url y/o cron_secret en Vault; no se agendó ningún job (ver README, "Procesos programados").';
    return agendados;
  end if;

  foreach ruta in array array['cierre', 'herencia', 'notificaciones'] loop
    nombre := 'elegilos-vos-' || ruta;
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = nombre;
    -- El comando lee Vault en cada corrida: ni la URL ni el secreto quedan en cron.job.
    perform cron.schedule(
      nombre,
      '* * * * *',
      format(
        $cmd$
        select net.http_get(
          url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'app_url'), '/') || %L,
          headers := jsonb_build_object(
            'Authorization',
            'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
          ),
          timeout_milliseconds := 60000
        );
        $cmd$,
        '/api/cron/' || ruta
      )
    );
    agendados := agendados || nombre;
  end loop;

  return agendados;
end;
$$;

create or replace function public.desprogramar_crons()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  sacados text[];
begin
  select coalesce(array_agg(j.jobname order by j.jobname), '{}') into sacados
  from cron.job j
  where j.jobname like 'elegilos-vos-%';
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname like 'elegilos-vos-%';
  return sacados;
end;
$$;

revoke execute on function public.programar_crons() from public, anon, authenticated;
revoke execute on function public.desprogramar_crons() from public, anon, authenticated;
grant execute on function public.programar_crons() to service_role;
grant execute on function public.desprogramar_crons() to service_role;

-- En una base nueva (sin secretos) solo deja el NOTICE.
select public.programar_crons();

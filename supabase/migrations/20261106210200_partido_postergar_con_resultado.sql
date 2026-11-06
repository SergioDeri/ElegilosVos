-- =============================================================================
-- Postergar o cancelar un Partido con resultado congelado, sin reabrir.
--
-- Antes (ticket 12) un Partido con `resultado_votacion` no se podía postergar
-- ni cancelar por la API. Ahora el Admin sí puede cambiarle `inicio` o
-- `estado` (por ejemplo, se suspendió en la última hora): el resultado es
-- inmutable y la Votación NO se reabre, porque `votacion_abierta` exige que no
-- haya resultado (y las políticas de escritura de `alineacion` la usan), y
-- `votaciones_por_cerrar` saltea los Partidos con resultado.
--
-- Sigue prohibido BORRAR un Partido con resultado (trigger
-- `partido_proteger_resultado` del ticket 12, sin cambios).
-- =============================================================================

create or replace function public.partido_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rival;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  select * into r from public.rival where id = new.rival_id;

  if r.club_id = new.club_id then
    raise exception 'Un Club no puede jugar contra sí mismo' using errcode = '23514';
  end if;

  if (tg_op = 'INSERT' or new.rival_id is distinct from old.rival_id) and not r.activo then
    raise exception 'El Rival está dado de baja' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.partido_validar() from public, anon, authenticated;

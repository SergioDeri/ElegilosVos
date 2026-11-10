-- =============================================================================
-- Selección, ticket 04: Partidos de la Selección en el backoffice.
--
-- El Admin con 2FA ya puede escribir Jugadores y Partidos de la Selección con
-- las políticas de los tickets 07 y 08 (todas con `es_admin()`, sin mirar el
-- club). Lo único nuevo es una regla de `partido_validar`: los Rivales de la
-- Selección son otras selecciones, así que no puede jugar contra un Rival que
-- representa a un Club (las filas "Peñarol" y "Nacional" del Clásico).
--
-- Misma función que en `partido_postergar_con_resultado`; solo se agrega esa
-- regla (error 23514, como las demás).
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

  if r.club_id is not null
     and exists (select 1 from public.club c where c.id = new.club_id and c.es_seleccion) then
    raise exception 'La Selección no juega contra un Club' using errcode = '23514';
  end if;

  if (tg_op = 'INSERT' or new.rival_id is distinct from old.rival_id) and not r.activo then
    raise exception 'El Rival está dado de baja' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.partido_validar() from public, anon, authenticated;

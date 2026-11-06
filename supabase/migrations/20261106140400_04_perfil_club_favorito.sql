-- =============================================================================
-- Ticket 04: perfil del Hincha y Club Favorito.
--
-- Qué abre:
--   * El Hincha lee SOLO su propio perfil (política de SELECT).
--   * El Hincha fija su Club Favorito UNA vez (de nulo a un Club) con la
--     función `elegir_club_favorito(club)`. No hay UPDATE directo por la API.
--
-- Defensa en profundidad (nadie puede cambiar su Club Favorito ni su rol,
-- ni siquiera con llamadas directas a la API):
--   1. Sin políticas de INSERT/UPDATE/DELETE en `perfil` y sin esos permisos
--      para anon/authenticated (revoke).
--   2. Trigger `perfil_proteger_cambios`: para pedidos de la API (roles anon y
--      authenticated) impide cambiar `rol`, `id` y `creado_en`, y cambiar un
--      Club Favorito que ya estaba elegido. Solo lo deja pasar a un Admin con
--      2FA (`es_admin()`), a la service role y a conexiones directas (seeds,
--      migraciones). Así sigue protegiendo aunque un ticket futuro abra un
--      UPDATE (por ejemplo, el Admin cambiando el Club de un Hincha, ticket 07).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Lectura: cada Hincha ve solo su perfil.
-- -----------------------------------------------------------------------------
create policy "perfil: el Hincha lee el suyo"
  on public.perfil for select
  to authenticated
  using (id = (select auth.uid()));

-- Nadie escribe `perfil` directamente por la API. Lo crea el trigger de
-- auth.users y el Club Favorito se elige con `elegir_club_favorito`.
-- (Si el ticket 07 necesita que el Admin lo edite por la API, que haga
-- `grant update (club_favorito_id, rol)` + una política con `es_admin()`.)
revoke insert, update, delete, truncate on public.perfil from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Trigger que protege rol, id y Club Favorito ya elegido.
-- -----------------------------------------------------------------------------
create function public.proteger_cambios_de_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Solo se restringe a los pedidos que llegan por la API como usuario
  -- (anon / authenticated). La service role y las conexiones directas
  -- (migraciones, seeds, tests que preparan datos) no pasan por acá.
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  -- El Admin con 2FA puede corregir el Club Favorito o el rol.
  if public.es_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.rol is distinct from old.rol
     or new.creado_en is distinct from old.creado_en then
    raise exception 'No se puede modificar el rol ni la identidad del perfil'
      using errcode = '42501';
  end if;

  if new.club_favorito_id is distinct from old.club_favorito_id
     and old.club_favorito_id is not null then
    raise exception 'El Club Favorito ya fue elegido y no se puede cambiar'
      using errcode = 'EV001';
  end if;

  return new;
end;
$$;

revoke execute on function public.proteger_cambios_de_perfil() from public, anon, authenticated;

create trigger perfil_proteger_cambios
  before update on public.perfil
  for each row execute function public.proteger_cambios_de_perfil();

-- -----------------------------------------------------------------------------
-- Elegir el Club Favorito: solo si todavía no tiene uno.
-- Errores (SQLSTATE, para que la UI los distinga):
--   42501  sin sesión
--   22023  club inválido
--   EV001  ya tenía Club Favorito (no se puede cambiar)
-- -----------------------------------------------------------------------------
create function public.elegir_club_favorito(club text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := auth.uid();
begin
  if usuario is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;

  if elegir_club_favorito.club is null
     or not exists (select 1 from public.club c where c.id = elegir_club_favorito.club) then
    raise exception 'Club inválido' using errcode = '22023';
  end if;

  update public.perfil p
     set club_favorito_id = elegir_club_favorito.club
   where p.id = usuario
     and p.club_favorito_id is null;

  if not found then
    raise exception 'El Club Favorito ya fue elegido y no se puede cambiar'
      using errcode = 'EV001';
  end if;

  return elegir_club_favorito.club;
end;
$$;

revoke execute on function public.elegir_club_favorito(text) from public, anon;
grant execute on function public.elegir_club_favorito(text) to authenticated;

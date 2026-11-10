-- =============================================================================
-- Selección, ticket 06: registro "Quiero votar solo por la Selección".
--
-- Un Hincha sin Club Favorito puede estar en dos situaciones: todavía no
-- eligió (va a la pantalla de elegir Club) o eligió "solo Selección" (entra
-- directo a la Selección). `perfil.eligio_solo_seleccion` las distingue.
--
--   * Se marca con `elegir_solo_seleccion()`, solo si todavía no tiene Club
--     (EV001 si ya tenía, como `elegir_club_favorito`). Repetirla no cambia nada.
--   * No impide elegir Club más tarde: `elegir_club_favorito` sigue fijándolo
--     una sola vez (si era nulo). La marca queda en true (eligió "solo
--     Selección" alguna vez); quien manda es el Club Favorito.
--   * Protegida como el resto del perfil: `perfil` sigue sin permisos de
--     escritura para la API y el trigger `perfil_proteger_cambios` impide
--     desmarcarla (salvo Admin con 2FA, service role y conexiones directas).
-- =============================================================================

alter table public.perfil add column eligio_solo_seleccion boolean not null default false;

comment on column public.perfil.eligio_solo_seleccion is
  'Eligió "Quiero votar solo por la Selección" (Selección, ticket 06). Con club_favorito_id nulo: entra directo a la Selección.';

-- -----------------------------------------------------------------------------
-- Elegir "solo Selección". Errores: 42501 sin sesión, EV001 ya tiene Club.
-- -----------------------------------------------------------------------------
create function public.elegir_solo_seleccion()
returns void
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

  update public.perfil p
     set eligio_solo_seleccion = true
   where p.id = usuario
     and p.club_favorito_id is null;

  if not found then
    raise exception 'El Club Favorito ya fue elegido y no se puede cambiar'
      using errcode = 'EV001';
  end if;
end;
$$;

revoke execute on function public.elegir_solo_seleccion() from public, anon;
grant execute on function public.elegir_solo_seleccion() to authenticated;

-- -----------------------------------------------------------------------------
-- El trigger de 04, más la marca: una vez elegida no se desmarca por la API.
-- -----------------------------------------------------------------------------
create or replace function public.proteger_cambios_de_perfil()
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

  if old.eligio_solo_seleccion and not new.eligio_solo_seleccion then
    raise exception 'La elección "solo Selección" no se puede deshacer'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.proteger_cambios_de_perfil() from public, anon, authenticated;

-- =============================================================================
-- Selección, ticket 01: la Selección en la base.
--
-- La Selección no es un Club (CONTEXT.md), pero se guarda como una fila más
-- de `club` (id `seleccion`) para que Partido, Plantel, Alineación, resultado,
-- 11 Real y notificaciones la reutilicen sin tablas paralelas. La columna
-- `es_seleccion` la distingue de los Clubes.
--
--   * Nadie puede tenerla como Club Favorito: `elegir_club_favorito` y
--     `cambiar_club_favorito` la rechazan como club inválido (22023), y un
--     check en `perfil` lo garantiza para cualquier otra escritura.
--   * El número del Jugador es obligatorio solo en el Plantel de un Club; en
--     el de la Selección no se lleva (nulo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- La Selección en `club`.
-- -----------------------------------------------------------------------------
alter table public.club drop constraint club_id_check;
alter table public.club add constraint club_id_check check (id in ('penarol', 'nacional', 'seleccion'));

-- Los checks de esta migración usan el literal 'seleccion' (un check no puede
-- consultar `club.es_seleccion`); `club_es_seleccion_check` ata la marca al id
-- para que las dos formas digan lo mismo. Las funciones usan la marca.
alter table public.club add column es_seleccion boolean not null default false;
alter table public.club add constraint club_es_seleccion_check check (es_seleccion = (id = 'seleccion'));

insert into public.club (id, nombre, es_seleccion) values ('seleccion', 'Selección', true);

-- -----------------------------------------------------------------------------
-- Nunca es Club Favorito.
-- -----------------------------------------------------------------------------
alter table public.perfil add constraint perfil_club_favorito_no_seleccion_check
  check (club_favorito_id is distinct from 'seleccion');

-- Mismas funciones que en 04 y fix_a; solo cambia la validación del club, que
-- ahora exige un Club (no la Selección).
create or replace function public.elegir_club_favorito(club text)
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
     or not exists (
       select 1 from public.club c where c.id = elegir_club_favorito.club and not c.es_seleccion
     ) then
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

create or replace function public.cambiar_club_favorito(hincha uuid, club text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  club_anterior text;
begin
  if not public.es_admin() then
    raise exception 'Solo el Admin con 2FA' using errcode = '42501';
  end if;

  if cambiar_club_favorito.club is null
     or not exists (
       select 1 from public.club c where c.id = cambiar_club_favorito.club and not c.es_seleccion
     ) then
    raise exception 'Club inválido' using errcode = '22023';
  end if;

  select p.club_favorito_id into club_anterior
    from public.perfil p
   where p.id = cambiar_club_favorito.hincha
     for update;

  if not found then
    raise exception 'No existe el Hincha' using errcode = 'P0002';
  end if;

  -- El trigger perfil_proteger_cambios deja pasar al Admin con 2FA.
  update public.perfil p
     set club_favorito_id = cambiar_club_favorito.club
   where p.id = cambiar_club_favorito.hincha;

  if club_anterior is not null and club_anterior <> cambiar_club_favorito.club then
    delete from public.alineacion a
     using public.partido pa
     where a.hincha_id = cambiar_club_favorito.hincha
       and pa.id = a.partido_id
       and pa.club_id = club_anterior
       and public.votacion_abierta(pa.id);
  end if;

  return cambiar_club_favorito.club;
end;
$$;

-- -----------------------------------------------------------------------------
-- Número del Jugador: obligatorio en un Club, nulo en la Selección.
-- -----------------------------------------------------------------------------
alter table public.jugador alter column numero drop not null;
alter table public.jugador add constraint jugador_numero_segun_plantel_check
  check ((numero is null) = (club_id = 'seleccion'));

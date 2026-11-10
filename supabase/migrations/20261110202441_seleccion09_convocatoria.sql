-- =============================================================================
-- Selección, ticket 09: Convocatoria.
--
-- La Convocatoria es la lista oficial de Jugadores que el DT llama a la
-- Selección para uno o más de sus Partidos (por ejemplo, los dos de una fecha
-- doble). La carga el Admin. Con Convocatoria, el Parcial de esos Partidos
-- muestra el Gran Ausente provisorio en lugar del Más Pedido. Cargarla NO
-- cambia lo que se puede votar: los no convocados se siguen eligiendo.
--
--   convocatoria            una fila por Convocatoria.
--   convocatoria_jugador    sus Jugadores: elegibles del Plantel de la Selección.
--   convocatoria_partido    los Partidos de la Selección a los que se aplica.
--                           Cada Partido, a lo sumo en una (unique partido_id).
--
-- Lectura: cualquier usuario autenticado con perfil. Escritura: solo
-- `es_admin()` (Admin con 2FA). La app escribe con `guardar_convocatoria`
-- (SECURITY INVOKER: corren las políticas), que reemplaza Jugadores y
-- Partidos en una sola transacción.
--
-- Por ahora el Admin la corrige cuando quiera (mientras la Votación sigue
-- abierta, y también después del cierre si se le pasó cargarla). La regla
-- "fija después de publicado el Gran Ausente final" es del ticket 10: va como
-- un trigger más en estas tres tablas.
-- =============================================================================

create table public.convocatoria (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger convocatoria_actualizado_en
  before update on public.convocatoria
  for each row execute function public.tocar_actualizado_en();

create table public.convocatoria_jugador (
  convocatoria_id uuid not null references public.convocatoria (id) on delete cascade,
  jugador_id uuid not null references public.jugador (id) on delete cascade,
  primary key (convocatoria_id, jugador_id)
);

create index convocatoria_jugador_jugador_idx on public.convocatoria_jugador (jugador_id);

create table public.convocatoria_partido (
  convocatoria_id uuid not null references public.convocatoria (id) on delete cascade,
  -- Cada Partido, a lo sumo en una Convocatoria.
  partido_id uuid not null unique references public.partido (id) on delete cascade,
  primary key (convocatoria_id, partido_id)
);

alter table public.convocatoria enable row level security;
alter table public.convocatoria_jugador enable row level security;
alter table public.convocatoria_partido enable row level security;

-- -----------------------------------------------------------------------------
-- Reglas: solo elegibles del Plantel de la Selección y solo Partidos de la
-- Selección. Para todos los roles (también la service role): son de
-- integridad. Errores 23514 (check_violation).
-- -----------------------------------------------------------------------------
create function public.convocatoria_jugador_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.jugador j join public.club c on c.id = j.club_id
    where j.id = new.jugador_id and c.es_seleccion
  ) then
    raise exception 'Solo se convocan elegibles del Plantel de la Selección' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.convocatoria_jugador_validar() from public, anon, authenticated;

create trigger convocatoria_jugador_validar
  before insert or update on public.convocatoria_jugador
  for each row execute function public.convocatoria_jugador_validar();

create function public.convocatoria_partido_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.partido p join public.club c on c.id = p.club_id
    where p.id = new.partido_id and c.es_seleccion
  ) then
    raise exception 'La Convocatoria se aplica solo a Partidos de la Selección' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.convocatoria_partido_validar() from public, anon, authenticated;

create trigger convocatoria_partido_validar
  before insert or update on public.convocatoria_partido
  for each row execute function public.convocatoria_partido_validar();

-- -----------------------------------------------------------------------------
-- Permisos y políticas. Nada para anon.
-- -----------------------------------------------------------------------------
revoke all on public.convocatoria, public.convocatoria_jugador, public.convocatoria_partido from anon;
revoke insert, update, delete, truncate on public.convocatoria, public.convocatoria_jugador, public.convocatoria_partido
  from authenticated;
grant select on public.convocatoria, public.convocatoria_jugador, public.convocatoria_partido to authenticated;
-- `id`, `creado_en` y `actualizado_en` los pone la base.
grant insert, delete on public.convocatoria to authenticated;
grant update (actualizado_en) on public.convocatoria to authenticated;
grant insert, delete on public.convocatoria_jugador, public.convocatoria_partido to authenticated;

create policy "convocatoria: la lee cualquier usuario con perfil"
  on public.convocatoria for select
  to authenticated
  using ((select public.tengo_perfil()));

create policy "convocatoria: el Admin da de alta"
  on public.convocatoria for insert
  to authenticated
  with check ((select public.es_admin()));

create policy "convocatoria: el Admin edita"
  on public.convocatoria for update
  to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

create policy "convocatoria: el Admin borra"
  on public.convocatoria for delete
  to authenticated
  using ((select public.es_admin()));

create policy "convocatoria_jugador: la lee cualquier usuario con perfil"
  on public.convocatoria_jugador for select
  to authenticated
  using ((select public.tengo_perfil()));

create policy "convocatoria_jugador: el Admin agrega"
  on public.convocatoria_jugador for insert
  to authenticated
  with check ((select public.es_admin()));

create policy "convocatoria_jugador: el Admin saca"
  on public.convocatoria_jugador for delete
  to authenticated
  using ((select public.es_admin()));

create policy "convocatoria_partido: la lee cualquier usuario con perfil"
  on public.convocatoria_partido for select
  to authenticated
  using ((select public.tengo_perfil()));

create policy "convocatoria_partido: el Admin agrega"
  on public.convocatoria_partido for insert
  to authenticated
  with check ((select public.es_admin()));

create policy "convocatoria_partido: el Admin saca"
  on public.convocatoria_partido for delete
  to authenticated
  using ((select public.es_admin()));

-- -----------------------------------------------------------------------------
-- guardar_convocatoria: alta (convocatoria null) o corrección de una
-- Convocatoria, con sus Jugadores y sus Partidos, en una sola transacción.
-- Devuelve el id. SECURITY INVOKER: un no Admin choca con las políticas
-- (42501); un Jugador o Partido que no es de la Selección, con los triggers
-- (23514); un Partido que ya está en otra Convocatoria, con el unique (23505).
-- Una Convocatoria que no existe (o que no se ve) da P0002.
-- -----------------------------------------------------------------------------
create function public.guardar_convocatoria(convocatoria uuid, jugadores uuid[], partidos uuid[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  id_convocatoria uuid := convocatoria;
begin
  if id_convocatoria is null then
    insert into public.convocatoria default values returning id into id_convocatoria;
  else
    update public.convocatoria c set actualizado_en = now() where c.id = id_convocatoria;
    if not found then
      raise exception 'No existe la Convocatoria' using errcode = 'P0002';
    end if;
  end if;

  delete from public.convocatoria_jugador cj
  where cj.convocatoria_id = id_convocatoria and cj.jugador_id <> all (coalesce(jugadores, '{}'));
  insert into public.convocatoria_jugador (convocatoria_id, jugador_id)
  select id_convocatoria, j from unnest(coalesce(jugadores, '{}')) as j
  on conflict do nothing;

  delete from public.convocatoria_partido cp
  where cp.convocatoria_id = id_convocatoria and cp.partido_id <> all (coalesce(partidos, '{}'));
  insert into public.convocatoria_partido (convocatoria_id, partido_id)
  select id_convocatoria, p from unnest(coalesce(partidos, '{}')) as p
  on conflict (convocatoria_id, partido_id) do nothing;

  return id_convocatoria;
end;
$$;

revoke execute on function public.guardar_convocatoria(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.guardar_convocatoria(uuid, uuid[], uuid[]) to authenticated;

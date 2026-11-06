-- =============================================================================
-- Ticket 14: 11 Real y Coincidencia con el 11 Elegido.
--
-- Qué agrega:
--   * Tabla `once_real`: los 11 titulares que puso el DT en un Partido, sin
--     Esquema (un registro por Partido; cascada al borrar el Partido).
--     `jugadores` es un uuid[] con exactamente 11 Jugadores distintos del
--     Club del Partido (pueden estar fuera del Plantel hoy: una baja reciente
--     pudo haber jugado ese Partido). Lo valida el trigger `once_real_validar`
--     para TODOS los roles (también la service role).
--   * Solo se carga para un Partido programado (no cancelado) cuyo inicio ya
--     pasó (now() >= inicio). Decisión: desde el inicio y no desde el fin
--     (inicio + 2 h), porque el DT da la formación antes de empezar y el Admin
--     puede querer cargarla durante el Partido.
--   * Lectura: los Hinchas del Club del Partido y el Admin con 2FA.
--     Escritura (alta, corrección y borrado): solo el Admin con 2FA
--     (`es_admin()`).
-- =============================================================================

create table public.once_real (
  partido_id uuid primary key references public.partido (id) on delete cascade,
  jugadores uuid[] not null
    check (cardinality(jugadores) = 11 and array_ndims(jugadores) = 1 and array_position(jugadores, null) is null),
  cargado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger once_real_actualizado_en
  before update on public.once_real
  for each row execute function public.tocar_actualizado_en();

-- -----------------------------------------------------------------------------
-- Reglas del 11 Real (mismas que `validarOnceReal` de @/domain/once-real).
-- -----------------------------------------------------------------------------
create function public.once_real_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.partido;
  distintos integer;
  del_club integer;
begin
  if tg_op = 'UPDATE' and new.partido_id is distinct from old.partido_id then
    raise exception 'No se puede mover un 11 Real a otro Partido' using errcode = '23514';
  end if;

  select * into p from public.partido where id = new.partido_id;
  if not found then
    raise exception 'Partido inexistente' using errcode = '23503';
  end if;
  if p.estado = 'cancelado' then
    raise exception 'Un Partido cancelado no tiene 11 Real' using errcode = '23514';
  end if;
  if now() < p.inicio then
    raise exception 'El 11 Real se carga desde el inicio del Partido' using errcode = '23514';
  end if;

  select count(distinct j) into distintos from unnest(new.jugadores) as j;
  if cardinality(new.jugadores) <> 11 or distintos <> 11 then
    raise exception 'El 11 Real tiene que tener exactamente 11 Jugadores distintos' using errcode = '23514';
  end if;

  select count(*) into del_club
  from public.jugador j
  where j.id = any (new.jugadores) and j.club_id = p.club_id;
  if del_club <> 11 then
    raise exception 'Todos los Jugadores del 11 Real tienen que ser del Club del Partido' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.cargado_en := now();
  else
    new.cargado_en := old.cargado_en;
  end if;
  return new;
end;
$$;

revoke execute on function public.once_real_validar() from public, anon, authenticated;

create trigger once_real_validar
  before insert or update on public.once_real
  for each row execute function public.once_real_validar();

-- -----------------------------------------------------------------------------
-- Permisos y políticas.
-- -----------------------------------------------------------------------------
alter table public.once_real enable row level security;

revoke all on public.once_real from anon, authenticated;
grant select, insert, delete on public.once_real to authenticated;
grant update (jugadores) on public.once_real to authenticated;

create policy "once_real: el Hincha lee los de su Club"
  on public.once_real for select
  to authenticated
  using (
    exists (
      select 1 from public.partido p
      where p.id = partido_id and p.club_id = (select public.mi_club_favorito())
    )
  );

create policy "once_real: el Admin lee todos"
  on public.once_real for select
  to authenticated
  using ((select public.es_admin()));

create policy "once_real: el Admin carga"
  on public.once_real for insert
  to authenticated
  with check ((select public.es_admin()));

create policy "once_real: el Admin corrige"
  on public.once_real for update
  to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

create policy "once_real: el Admin borra"
  on public.once_real for delete
  to authenticated
  using ((select public.es_admin()));

-- =============================================================================
-- Ticket 08: Backoffice — Rivales (con escudo) y Partidos.
--
-- Qué abre (todo exige `public.es_admin()`: rol admin Y sesión AAL2):
--   * rival: el Admin lee todos, da de alta, edita (incluye la baja lógica con
--     `activo = false`) y borra los que no tienen Partidos (la FK de
--     `partido.rival_id` lo impide si los tiene).
--     Columna nueva `club_id`: el Club que representa el Rival (las filas
--     "Peñarol" y "Nacional" del Clásico); null para el resto.
--   * partido: el Admin lee todos, da de alta, edita (Rival, inicio, estado)
--     y borra los que no tienen Alineaciones. El Club y `creado_en` no se
--     pueden cambiar por la API (de `creado_en` depende la apertura de la
--     Votación).
--   * Trigger `partido_validar` (pedidos de la API): el Rival tiene que estar
--     activo (al cargarlo o cambiarlo) y no puede ser el propio Club.
--   * Trigger `partido_impedir_borrado_con_alineaciones` (pedidos de la API):
--     un Partido con Alineaciones no se borra (se cancela). La FK de
--     `alineacion` es ON DELETE CASCADE: sin este trigger se perderían votos.
--   * `partido_tiene_alineaciones(partido)`: para el backoffice (el Admin no
--     lee Alineaciones ajenas).
--   * Storage: bucket público `escudos`. Lectura por URL pública; escritura
--     solo el Admin.
-- La service role y las conexiones directas (seeds, cron, tests) no pasan por
-- las validaciones de los triggers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- rival
-- -----------------------------------------------------------------------------
alter table public.rival
  add column club_id text unique references public.club (id);

comment on column public.rival.club_id is
  'Club que representa este Rival (Clásico). Un Partido no puede tener como Rival a su propio Club.';

-- Por si ya hay datos cargados con el nombre exacto del Club.
update public.rival r
   set club_id = c.id
  from public.club c
 where r.nombre = c.nombre
   and r.club_id is null;

revoke insert, update, delete, truncate on public.rival from anon;
revoke truncate on public.rival from authenticated;

create policy "rival: el Admin lee todos"
  on public.rival for select
  to authenticated
  using ((select public.es_admin()));

create policy "rival: el Admin da de alta"
  on public.rival for insert
  to authenticated
  with check ((select public.es_admin()));

create policy "rival: el Admin edita"
  on public.rival for update
  to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- Solo prospera si ningún Partido lo usa (FK partido.rival_id): si no, baja lógica.
create policy "rival: el Admin borra"
  on public.rival for delete
  to authenticated
  using ((select public.es_admin()));

-- -----------------------------------------------------------------------------
-- partido
-- -----------------------------------------------------------------------------
-- Columnas escribibles por la API. `creado_en` queda afuera: es la apertura
-- de la Votación de un Partido sin anterior.
revoke insert, update, delete, truncate on public.partido from anon, authenticated;
grant insert (club_id, rival_id, inicio, estado) on public.partido to authenticated;
grant update (rival_id, inicio, estado) on public.partido to authenticated;
grant delete on public.partido to authenticated;

create policy "partido: el Admin lee todos"
  on public.partido for select
  to authenticated
  using ((select public.es_admin()));

create policy "partido: el Admin da de alta"
  on public.partido for insert
  to authenticated
  with check ((select public.es_admin()));

create policy "partido: el Admin edita"
  on public.partido for update
  to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

create policy "partido: el Admin borra"
  on public.partido for delete
  to authenticated
  using ((select public.es_admin()));

-- Reglas de un Partido cargado o editado por la API (backoffice).
-- Errores 23514 (check_violation).
create function public.partido_validar()
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

  -- TODO(ticket 12): una Votación con 11 Elegido es definitiva. Cuando exista
  -- la tabla del 11 Elegido, impedir acá cambiar `inicio` o `estado`:
  --   if tg_op = 'UPDATE'
  --      and (new.inicio is distinct from old.inicio or new.estado is distinct from old.estado)
  --      and exists (select 1 from public.<once_elegido> o where o.partido_id = old.id) then
  --     raise exception 'La Votación de este Partido ya tiene 11 Elegido' using errcode = '23514';
  --   end if;
  -- (La app ya lo valida con `validarAccion` de @/domain/partidos.)

  return new;
end;
$$;

revoke execute on function public.partido_validar() from public, anon, authenticated;

create trigger partido_validar
  before insert or update on public.partido
  for each row execute function public.partido_validar();

-- Un Partido con Alineaciones no se borra por la API: se cancela.
-- SECURITY DEFINER: el Admin no lee las Alineaciones de los Hinchas.
create function public.partido_impedir_borrado_con_alineaciones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and exists (select 1 from public.alineacion a where a.partido_id = old.id) then
    raise exception 'El Partido tiene Alineaciones: cancelalo en lugar de borrarlo' using errcode = 'EV080';
  end if;
  return old;
end;
$$;

revoke execute on function public.partido_impedir_borrado_con_alineaciones() from public, anon, authenticated;

create trigger partido_impedir_borrado_con_alineaciones
  before delete on public.partido
  for each row execute function public.partido_impedir_borrado_con_alineaciones();

-- Para el backoffice: si algún Hincha guardó una Alineación para el Partido.
-- Errores: 42501 no es Admin con 2FA.
create function public.partido_tiene_alineaciones(partido uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el Admin con 2FA' using errcode = '42501';
  end if;
  return exists (select 1 from public.alineacion a where a.partido_id = partido_tiene_alineaciones.partido);
end;
$$;

revoke execute on function public.partido_tiene_alineaciones(uuid) from public, anon;
grant execute on function public.partido_tiene_alineaciones(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: escudos de los Rivales.
-- Bucket público (lectura por URL pública sin políticas). Mismas reglas que
-- las fotos: 2 MB, solo JPEG, PNG o WebP (sin SVG: puede llevar scripts); la
-- app valida además el contenido real (`validarFoto`). Rutas: <rival>/<uuid>.<ext>.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('escudos', 'escudos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "escudos (storage): el Admin lee"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'escudos' and (select public.es_admin()));

create policy "escudos (storage): el Admin sube"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'escudos' and (select public.es_admin()));

create policy "escudos (storage): el Admin reemplaza"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'escudos' and (select public.es_admin()))
  with check (bucket_id = 'escudos' and (select public.es_admin()));

create policy "escudos (storage): el Admin borra"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'escudos' and (select public.es_admin()));

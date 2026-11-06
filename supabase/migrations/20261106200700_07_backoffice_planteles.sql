-- =============================================================================
-- Ticket 07: Backoffice — acceso Admin (2FA) y Planteles.
--
-- Qué abre (todo exige `public.es_admin()`: rol admin Y sesión AAL2):
--   * jugador: el Admin lee, da de alta y edita (incluye baja lógica con
--     `en_plantel = false` y la Disponibilidad con su motivo). DELETE físico:
--     nadie por la API (revocado).
--     La lectura de los Jugadores para los Hinchas NO va acá: la crea el
--     ticket 09 en su migración.
--   * evento_disponibilidad (nueva): registro de cada cambio de Disponibilidad,
--     escrito SOLO por el trigger de `jugador`. Sin acceso por la API (ni
--     Hinchas ni Admin): la consumen desde el servidor los tickets 10 y 15.
--   * perfil: el Admin lee todos y cambia el Club Favorito de un Hincha con
--     cambiar_club_favorito(hincha, club). El rol NUNCA se cambia desde la
--     app (ver README).
--   * buscar_hinchas(texto): búsqueda de Hinchas por email para el Admin.
--   * Storage: bucket `jugadores` (fotos). Lectura pública por URL; escritura
--     solo el Admin. Tipo y tamaño de archivo los limita el propio bucket.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- jugador
-- -----------------------------------------------------------------------------
create policy "jugador: el Admin lee todos"
  on public.jugador for select
  to authenticated
  using ((select public.es_admin()));

create policy "jugador: el Admin da de alta"
  on public.jugador for insert
  to authenticated
  with check ((select public.es_admin()));

create policy "jugador: el Admin edita"
  on public.jugador for update
  to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- La baja es lógica (en_plantel = false) para conservar el historial.
revoke delete, truncate on public.jugador from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Evento de cambio de Disponibilidad
-- -----------------------------------------------------------------------------
create table public.evento_disponibilidad (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references public.jugador (id) on delete cascade,
  -- Copia del Club del Jugador al momento del cambio (para filtrar Hinchas).
  club_id text not null references public.club (id),
  disponibilidad_anterior public.disponibilidad not null,
  disponibilidad_nueva public.disponibilidad not null,
  -- Motivo nuevo (nulo si vuelve a estar Disponible o no se cargó).
  motivo text,
  momento timestamptz not null default now(),
  check (disponibilidad_anterior <> disponibilidad_nueva)
);

create index evento_disponibilidad_club_momento_idx
  on public.evento_disponibilidad (club_id, momento);
create index evento_disponibilidad_jugador_idx
  on public.evento_disponibilidad (jugador_id, momento);

-- RLS sin políticas: nadie la lee ni la escribe por la API. Se escribe solo
-- con el trigger y se lee con la service role desde el servidor.
alter table public.evento_disponibilidad enable row level security;
revoke all on public.evento_disponibilidad from anon, authenticated;

-- SECURITY DEFINER: el Admin no tiene permisos sobre la tabla de eventos.
create function public.registrar_cambio_de_disponibilidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.evento_disponibilidad
    (jugador_id, club_id, disponibilidad_anterior, disponibilidad_nueva, motivo)
  values
    (new.id, new.club_id, old.disponibilidad, new.disponibilidad, new.motivo_disponibilidad);
  return new;
end;
$$;

revoke execute on function public.registrar_cambio_de_disponibilidad() from public, anon, authenticated;

create trigger jugador_registrar_cambio_de_disponibilidad
  after update of disponibilidad on public.jugador
  for each row
  when (old.disponibilidad is distinct from new.disponibilidad)
  execute function public.registrar_cambio_de_disponibilidad();

-- -----------------------------------------------------------------------------
-- perfil: el Admin busca Hinchas y les cambia el Club Favorito.
-- El trigger `perfil_proteger_cambios` (ticket 04) ya deja pasar a es_admin().
-- -----------------------------------------------------------------------------
create policy "perfil: el Admin lee todos"
  on public.perfil for select
  to authenticated
  using ((select public.es_admin()));

-- El cambio de Club Favorito va por una función y no con un UPDATE directo:
-- así `perfil` sigue sin permisos de escritura para la API (ticket 04: un
-- UPDATE de un Hincha da error, no "cero filas") y el rol NUNCA se puede
-- cambiar desde la app (el primer Admin se crea a mano con SQL, ver README).
-- Errores: 42501 no es Admin con 2FA, 22023 club inválido, P0002 no existe.
create function public.cambiar_club_favorito(hincha uuid, club text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el Admin con 2FA' using errcode = '42501';
  end if;

  if cambiar_club_favorito.club is null
     or not exists (select 1 from public.club c where c.id = cambiar_club_favorito.club) then
    raise exception 'Club inválido' using errcode = '22023';
  end if;

  -- El trigger perfil_proteger_cambios deja pasar al Admin con 2FA.
  update public.perfil p
     set club_favorito_id = cambiar_club_favorito.club
   where p.id = cambiar_club_favorito.hincha;

  if not found then
    raise exception 'No existe el Hincha' using errcode = 'P0002';
  end if;

  return cambiar_club_favorito.club;
end;
$$;

revoke execute on function public.cambiar_club_favorito(uuid, text) from public, anon;
grant execute on function public.cambiar_club_favorito(uuid, text) to authenticated;

-- Busca Hinchas por email (contiene, sin distinguir mayúsculas). El email
-- vive en auth.users, que no se expone por la API: SECURITY DEFINER y
-- chequeo explícito de es_admin(). Máximo 50 resultados.
create function public.buscar_hinchas(texto text)
returns table (id uuid, email text, club_favorito_id text, rol public.rol, creado_en timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  patron text;
begin
  if not public.es_admin() then
    raise exception 'Solo el Admin con 2FA' using errcode = '42501';
  end if;

  patron := '%' || replace(replace(replace(coalesce(trim(texto), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
    select p.id, u.email::text, p.club_favorito_id, p.rol, p.creado_en
      from public.perfil p
      join auth.users u on u.id = p.id
     where u.email ilike patron
     order by u.email
     limit 50;
end;
$$;

revoke execute on function public.buscar_hinchas(text) from public, anon;
grant execute on function public.buscar_hinchas(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: fotos de Jugadores.
-- Bucket público (lectura por URL pública sin políticas). Límite de 2 MB y
-- solo JPEG, PNG o WebP; la app valida además el contenido real del archivo.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jugadores', 'jugadores', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- SELECT hace falta para que el Admin pueda reemplazar y borrar (la API de
-- Storage lee la fila antes). Los Hinchas usan la URL pública.
create policy "jugadores (storage): el Admin lee"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'jugadores' and (select public.es_admin()));

create policy "jugadores (storage): el Admin sube"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'jugadores' and (select public.es_admin()));

create policy "jugadores (storage): el Admin reemplaza"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'jugadores' and (select public.es_admin()))
  with check (bucket_id = 'jugadores' and (select public.es_admin()));

create policy "jugadores (storage): el Admin borra"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'jugadores' and (select public.es_admin()));

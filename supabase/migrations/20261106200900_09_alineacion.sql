-- =============================================================================
-- Ticket 09: Armar la Alineación (pantalla principal del Hincha).
--
-- Qué agrega:
--   * `mi_club_favorito()`: el Club Favorito del usuario de la sesión.
--   * Lecturas para el Hincha: `partido` y `jugador` de SU Club; `rival`
--     activos o referenciados por Partidos de su Club.
--   * `votacion_de_partido(partido, ahora)` y `votacion_abierta(partido, ahora)`:
--     la regla del Calendario de Votación (src/domain/calendario) en SQL.
--   * Tabla `alineacion` (una por Hincha y Partido) con sus políticas: el
--     Hincha lee solo la suya y la escribe solo para un Partido de su Club
--     Favorito con la Votación abierta. No puede borrarla.
--   * Validación de forma del jsonb `puestos` (check) y trigger que verifica
--     que los Jugadores sean del Club del Partido y que sella las horas de
--     modificación con la hora del servidor para los pedidos de la API.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Club Favorito del usuario de la sesión (null sin sesión o sin Club).
-- SECURITY DEFINER para no depender de las políticas de `perfil` (y evitar
-- recursión). Solo expone el Club del propio usuario.
-- -----------------------------------------------------------------------------
create function public.mi_club_favorito()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.club_favorito_id from public.perfil p where p.id = auth.uid();
$$;

revoke execute on function public.mi_club_favorito() from public, anon;
grant execute on function public.mi_club_favorito() to authenticated;

-- -----------------------------------------------------------------------------
-- Lecturas del Hincha.
-- -----------------------------------------------------------------------------
create policy "partido: el Hincha lee los de su Club"
  on public.partido for select
  to authenticated
  using (club_id = (select public.mi_club_favorito()));

-- Incluye a los que salieron del Plantel y a los no Disponibles: la pantalla
-- muestra el motivo, y una Alineación guardada puede nombrarlos.
create policy "jugador: el Hincha lee los de su Club"
  on public.jugador for select
  to authenticated
  using (club_id = (select public.mi_club_favorito()));

create policy "rival: el Hincha lee los activos y los de Partidos de su Club"
  on public.rival for select
  to authenticated
  using (
    activo
    or exists (
      select 1 from public.partido p
      where p.rival_id = rival.id
        and p.club_id = (select public.mi_club_favorito())
    )
  );

-- -----------------------------------------------------------------------------
-- Calendario de Votación en SQL. Replica EXACTAMENTE `calcularVotaciones` de
-- src/domain/calendario (ver su JSDoc). Un test de RLS compara las dos.
--
--   orden     (inicio, creado_en, id)
--   anterior  último Partido NO cancelado del mismo Club antes en ese orden
--   abre      max(creado_en, anterior.inicio + 2 h)   (greatest ignora null)
--   cierra    inicio - 1 h
--   estado    anulada si cancelado; cerrada si ahora >= cierra;
--             abierta si ahora >= abre; si no, pendiente.
--
-- SECURITY INVOKER: con un Hincha, solo ve los Partidos de su Club (que es lo
-- único que necesita la regla). `ahora` es parámetro para poder probarla.
-- -----------------------------------------------------------------------------
create function public.votacion_de_partido(partido uuid, ahora timestamptz default now())
returns table (partido_id uuid, estado text, abre timestamptz, cierra timestamptz)
language sql
stable
set search_path = ''
as $$
  select
    p.id,
    case
      when p.estado = 'cancelado' then 'anulada'
      when ahora >= p.inicio - interval '1 hour' then 'cerrada'
      when ahora >= greatest(p.creado_en, ant.inicio + interval '2 hours') then 'abierta'
      else 'pendiente'
    end,
    greatest(p.creado_en, ant.inicio + interval '2 hours'),
    p.inicio - interval '1 hour'
  from public.partido p
  left join lateral (
    select a.inicio
    from public.partido a
    where a.club_id = p.club_id
      and a.estado = 'programado'
      and (a.inicio, a.creado_en, a.id) < (p.inicio, p.creado_en, p.id)
    order by a.inicio desc, a.creado_en desc, a.id desc
    limit 1
  ) ant on true
  where p.id = votacion_de_partido.partido;
$$;

create function public.votacion_abierta(partido uuid, ahora timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select v.estado = 'abierta' from public.votacion_de_partido(votacion_abierta.partido, votacion_abierta.ahora) v),
    false
  );
$$;

revoke execute on function public.votacion_de_partido(uuid, timestamptz) from public, anon;
revoke execute on function public.votacion_abierta(uuid, timestamptz) from public, anon;
grant execute on function public.votacion_de_partido(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.votacion_abierta(uuid, timestamptz) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Catálogo de Esquemas en SQL (solo los códigos de Puesto de cada uno), para
-- validar la forma de la Alineación. Tiene que coincidir con
-- src/domain/esquemas/catalogo.ts (lo verifica un test de RLS).
-- -----------------------------------------------------------------------------
create function public.puestos_de_esquema(esquema text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case esquema
    when '4-3-3'   then array['ARQ','LI','ZAG_I','ZAG_D','LD','CINCO','INT_I','INT_D','EXT_I','DEL','EXT_D']
    when '4-4-2'   then array['ARQ','LI','ZAG_I','ZAG_D','LD','VOL_I','MC_I','MC_D','VOL_D','DEL_I','DEL_D']
    when '4-2-3-1' then array['ARQ','LI','ZAG_I','ZAG_D','LD','MC_I','MC_D','EXT_I','ENG','EXT_D','DEL']
    when '3-5-2'   then array['ARQ','ZAG_I','ZAG_C','ZAG_D','CAR_I','INT_I','CINCO','INT_D','CAR_D','DEL_I','DEL_D']
    when '5-3-2'   then array['ARQ','CAR_I','ZAG_I','ZAG_C','ZAG_D','CAR_D','INT_I','CINCO','INT_D','DEL_I','DEL_D']
    when '4-1-4-1' then array['ARQ','LI','ZAG_I','ZAG_D','LD','CINCO','VOL_I','INT_I','INT_D','VOL_D','DEL']
  end;
$$;

-- Forma razonable de `puestos` (el formato de `aJson(...).puestos` del Editor):
-- un objeto cuyas claves son Puestos del Esquema y cuyos valores son
-- {"jugadorId": uuid, "modificadoEn": hora ISO 8601}, sin Jugadores repetidos.
-- El detalle fino (y el saneamiento) lo hace `desdeJson` del Editor.
create function public.alineacion_puestos_validos(esquema text, puestos jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    public.puestos_de_esquema(esquema) is not null
    and jsonb_typeof(puestos) = 'object'
    and not exists (
      select 1
      from jsonb_each(puestos) e
      where not (e.key = any (public.puestos_de_esquema(esquema)))
         or jsonb_typeof(e.value) is distinct from 'object'
         or jsonb_typeof(e.value -> 'jugadorId') is distinct from 'string'
         or jsonb_typeof(e.value -> 'modificadoEn') is distinct from 'string'
         or (e.value ->> 'jugadorId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or (e.value ->> 'modificadoEn') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$'
    )
    and (
      select count(*) = count(distinct lower(e.value ->> 'jugadorId'))
      from jsonb_each(puestos) e
    );
$$;

-- -----------------------------------------------------------------------------
-- Alineación: una por Hincha y Partido.
--
-- Los Puestos van en un jsonb con el formato de `aJson` del Editor (y no en
-- una tabla hija por Puesto) porque la Alineación se lee y se escribe siempre
-- entera: el guardado automático hace un único upsert atómico del estado del
-- Editor, el Motor de Conteo la consume entera, y RLS queda en una sola tabla.
-- La forma se valida con un check y los Jugadores con un trigger.
-- -----------------------------------------------------------------------------
create table public.alineacion (
  id uuid primary key default gen_random_uuid(),
  -- Por defecto, el usuario de la sesión (la API no deja elegirlo).
  hincha_id uuid not null default auth.uid() references public.perfil (id) on delete cascade,
  partido_id uuid not null references public.partido (id) on delete cascade,
  esquema text not null check (public.puestos_de_esquema(esquema) is not null),
  esquema_elegido_a_mano boolean not null default false,
  esquema_modificado_en timestamptz,
  puestos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (hincha_id, partido_id),
  constraint alineacion_puestos_validos check (public.alineacion_puestos_validos(esquema, puestos))
);

create index alineacion_partido_idx on public.alineacion (partido_id);

create trigger alineacion_actualizado_en
  before update on public.alineacion
  for each row execute function public.tocar_actualizado_en();

-- -----------------------------------------------------------------------------
-- Trigger de guardado:
--   1. Todos los Jugadores de `puestos` tienen que ser del Club del Partido
--      (para todos, incluida la service role).
--   2. Pedidos de la API (anon/authenticated): las horas las pone el servidor,
--      no el cliente. Un Puesto que conserva al mismo Jugador conserva su hora
--      guardada; uno que cambió toma now(). Lo mismo con el Esquema. Así nadie
--      puede antedatar sus votos para ganar desempates (ADR-0001). `hincha_id`,
--      `creado_en` no se pueden cambiar.
--   La service role y las conexiones directas (herencia del ticket 10, seeds)
--   pueden escribir horas explícitas.
-- -----------------------------------------------------------------------------
create function public.alineacion_antes_de_guardar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  club text;
  clave text;
  valor jsonb;
  previo jsonb;
  sellados jsonb := '{}'::jsonb;
  hora_servidor text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if not public.alineacion_puestos_validos(new.esquema, new.puestos) then
    raise exception 'Alineación con formato inválido' using errcode = '23514';
  end if;

  select p.club_id into club from public.partido p where p.id = new.partido_id;
  if exists (
    select 1 from jsonb_each(new.puestos) e
    where not exists (
      select 1 from public.jugador j
      where j.id = (e.value ->> 'jugadorId')::uuid and j.club_id = club
    )
  ) then
    raise exception 'La Alineación tiene Jugadores que no son del Club del Partido' using errcode = '23514';
  end if;

  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.hincha_id := old.hincha_id;
    new.creado_en := old.creado_en;
  else
    new.creado_en := now();
  end if;

  for clave, valor in select e.key, e.value from jsonb_each(new.puestos) e loop
    -- Mismo código de Puesto y mismo Jugador: conserva la hora (también al
    -- cambiar de Esquema, como cambiarEsquema del Editor).
    previo := case when tg_op = 'UPDATE' then old.puestos -> clave end;
    if previo is not null and previo ->> 'jugadorId' = valor ->> 'jugadorId' then
      sellados := sellados || jsonb_build_object(clave, previo);
    else
      sellados := sellados || jsonb_build_object(
        clave, jsonb_build_object('jugadorId', valor ->> 'jugadorId', 'modificadoEn', hora_servidor)
      );
    end if;
  end loop;
  new.puestos := sellados;

  if tg_op = 'UPDATE'
     and new.esquema = old.esquema
     and new.esquema_elegido_a_mano = old.esquema_elegido_a_mano then
    new.esquema_modificado_en := old.esquema_modificado_en;
  elsif new.esquema_elegido_a_mano then
    new.esquema_modificado_en := now();
  else
    new.esquema_modificado_en := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.alineacion_antes_de_guardar() from public, anon, authenticated;

create trigger alineacion_antes_de_guardar
  before insert or update on public.alineacion
  for each row execute function public.alineacion_antes_de_guardar();

-- -----------------------------------------------------------------------------
-- Permisos y políticas.
-- -----------------------------------------------------------------------------
alter table public.alineacion enable row level security;

-- Solo las columnas de la Alineación son escribibles por la API; `hincha_id`
-- sale de la sesión (default auth.uid()). Sin DELETE: vaciar la cancha es
-- guardar una Alineación vacía, y al borrar la cuenta se borra en cascada.
revoke all on public.alineacion from anon, authenticated;
grant select on public.alineacion to authenticated;
grant insert (partido_id, esquema, esquema_elegido_a_mano, esquema_modificado_en, puestos)
  on public.alineacion to authenticated;
grant update (partido_id, esquema, esquema_elegido_a_mano, esquema_modificado_en, puestos)
  on public.alineacion to authenticated;

-- Lectura: solo la propia (también con la Votación cerrada, para verla en
-- solo lectura y compararla con el 11 Elegido).
create policy "alineacion: el Hincha lee la suya"
  on public.alineacion for select
  to authenticated
  using (hincha_id = (select auth.uid()));

-- Escritura: la propia, para un Partido de su Club Favorito y con la
-- Votación abierta (misma regla que el Calendario).
create policy "alineacion: el Hincha crea la suya con la Votación abierta"
  on public.alineacion for insert
  to authenticated
  with check (
    hincha_id = (select auth.uid())
    and exists (
      select 1 from public.partido p
      where p.id = partido_id and p.club_id = (select public.mi_club_favorito())
    )
    and public.votacion_abierta(partido_id)
  );

create policy "alineacion: el Hincha edita la suya con la Votación abierta"
  on public.alineacion for update
  to authenticated
  using (
    hincha_id = (select auth.uid())
    and exists (
      select 1 from public.partido p
      where p.id = partido_id and p.club_id = (select public.mi_club_favorito())
    )
    and public.votacion_abierta(partido_id)
  )
  with check (
    hincha_id = (select auth.uid())
    and exists (
      select 1 from public.partido p
      where p.id = partido_id and p.club_id = (select public.mi_club_favorito())
    )
    and public.votacion_abierta(partido_id)
  );

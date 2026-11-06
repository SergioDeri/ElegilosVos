-- =============================================================================
-- Ticket 12: Cierre de Votación y 11 Elegido.
--
-- Qué agrega:
--   * Tabla `resultado_votacion`: el resultado congelado de cada Votación
--     (un registro por Partido). INMUTABLE: nadie la modifica ni la borra,
--     ni el Admin ni la service role (trigger). Solo desaparece en cascada si
--     se borra el Partido, y la API no puede borrar un Partido con resultado.
--     Lectura: los Hinchas del Club del Partido y el Admin con 2FA.
--     Escritura: solo la service role (proceso de cierre), con INSERT ... ON
--     CONFLICT DO NOTHING (idempotente).
--   * `tiene_resultado(partido)`.
--   * `votacion_abierta` ahora exige además que NO exista resultado: una vez
--     congelado, el Partido queda definitivo aunque el Admin lo postergue
--     (las políticas de escritura de `alineacion` usan esta función).
--   * `votaciones_por_cerrar(ahora)`: Partidos con la hora de cierre pasada y
--     sin resultado (solo service role).
-- =============================================================================

create table public.resultado_votacion (
  partido_id uuid primary key references public.partido (id) on delete cascade,
  -- con_once:         hubo Alineaciones que cuentan; hay 11 Elegido.
  -- sin_alineaciones: cerró sin ninguna Alineación que cuente.
  -- anulada:          el Partido estaba cancelado a la hora de cierre.
  -- nunca_abrio:      la ventana de Votación estuvo vacía (abre >= cierra).
  estado text not null check (estado in ('con_once', 'sin_alineaciones', 'anulada', 'nunca_abrio')),
  -- Esquema ganador (solo con_once).
  esquema text check (esquema is null or public.puestos_de_esquema(esquema) is not null),
  -- [{puesto, jugadorId, origen, votos}] en el orden del Esquema (solo con_once).
  once jsonb check (once is null or jsonb_typeof(once) = 'array'),
  -- Salida completa del Motor de Conteo (sin datos de votantes). Nulo si no se contó.
  detalle jsonb,
  alineaciones_que_cuentan integer not null default 0 check (alineaciones_que_cuentan >= 0),
  -- Hora de cierre de la Votación con la que se calculó (inicio - 1 h en ese momento).
  cierre timestamptz not null,
  calculado_en timestamptz not null default now(),
  check ((estado = 'con_once') = (esquema is not null and once is not null)),
  check (estado = 'con_once' or alineaciones_que_cuentan = 0)
);

-- -----------------------------------------------------------------------------
-- Inmutabilidad: ningún UPDATE; DELETE solo en cascada (borrado del Partido).
-- Aplica a TODOS los roles (también service role y conexiones directas).
-- -----------------------------------------------------------------------------
create function public.resultado_votacion_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- pg_trigger_depth() > 1: el DELETE viene de la acción en cascada de la FK
  -- (borrado del Partido), no de un pedido directo sobre esta tabla.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'El resultado de una Votación es inmutable' using errcode = '42501';
end;
$$;

revoke execute on function public.resultado_votacion_inmutable() from public, anon, authenticated;

create trigger resultado_votacion_inmutable
  before update or delete on public.resultado_votacion
  for each row execute function public.resultado_votacion_inmutable();

create trigger resultado_votacion_inmutable_truncate
  before truncate on public.resultado_votacion
  for each statement execute function public.resultado_votacion_inmutable();

-- -----------------------------------------------------------------------------
-- Defensa al insertar: no se congela un resultado de una Votación que, según
-- la hora del servidor de la base, todavía no cerró, ni uno que no coincide
-- con el estado del Partido.
-- -----------------------------------------------------------------------------
create function public.resultado_votacion_antes_de_insertar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select * into v from public.votacion_de_partido(new.partido_id, now());
  if not found then
    raise exception 'Partido inexistente' using errcode = '23503';
  end if;
  if now() < v.cierra then
    raise exception 'La Votación todavía no cerró' using errcode = '23514';
  end if;
  if (new.estado = 'anulada') <> (v.estado = 'anulada') then
    raise exception 'El estado del resultado no coincide con el del Partido' using errcode = '23514';
  end if;
  new.calculado_en := now();
  return new;
end;
$$;

revoke execute on function public.resultado_votacion_antes_de_insertar() from public, anon, authenticated;

create trigger resultado_votacion_antes_de_insertar
  before insert on public.resultado_votacion
  for each row execute function public.resultado_votacion_antes_de_insertar();

-- -----------------------------------------------------------------------------
-- Un Partido con resultado no se puede borrar por la API (ni el Admin): se
-- llevaría el 11 Elegido en cascada. La service role (tests, mantenimiento)
-- sí puede.
-- -----------------------------------------------------------------------------
create function public.partido_proteger_resultado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and exists (select 1 from public.resultado_votacion r where r.partido_id = old.id) then
    raise exception 'El Partido tiene un resultado de Votación congelado: no se puede borrar' using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke execute on function public.partido_proteger_resultado() from public, anon, authenticated;

create trigger partido_proteger_resultado
  before delete on public.partido
  for each row execute function public.partido_proteger_resultado();

-- -----------------------------------------------------------------------------
-- Permisos y políticas: solo lectura por la API.
-- -----------------------------------------------------------------------------
alter table public.resultado_votacion enable row level security;

revoke all on public.resultado_votacion from anon, authenticated;
grant select on public.resultado_votacion to authenticated;
revoke update, delete, truncate on public.resultado_votacion from service_role;
grant select, insert on public.resultado_votacion to service_role;

create policy "resultado_votacion: el Hincha lee los de su Club"
  on public.resultado_votacion for select
  to authenticated
  using (
    exists (
      select 1 from public.partido p
      where p.id = partido_id and p.club_id = (select public.mi_club_favorito())
    )
  );

create policy "resultado_votacion: el Admin lee todos"
  on public.resultado_votacion for select
  to authenticated
  using ((select public.es_admin()));

-- -----------------------------------------------------------------------------
-- ¿El Partido ya tiene resultado congelado? SECURITY DEFINER para no depender
-- de las políticas de lectura: solo revela si existe.
-- -----------------------------------------------------------------------------
create function public.tiene_resultado(partido uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.resultado_votacion r where r.partido_id = tiene_resultado.partido);
$$;

revoke execute on function public.tiene_resultado(uuid) from public, anon;
grant execute on function public.tiene_resultado(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- La Votación de un Partido con resultado no vuelve a abrir (por ejemplo, si
-- el Admin lo posterga después del cierre). Reemplaza la del ticket 09; las
-- políticas de `alineacion` la usan, así que quedan bloqueadas también.
-- `votacion_de_partido` sigue siendo la regla pura del Calendario.
-- -----------------------------------------------------------------------------
create or replace function public.votacion_abierta(partido uuid, ahora timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select v.estado = 'abierta' from public.votacion_de_partido(votacion_abierta.partido, votacion_abierta.ahora) v),
    false
  )
  and not public.tiene_resultado(votacion_abierta.partido);
$$;

-- -----------------------------------------------------------------------------
-- Partidos con la hora de cierre pasada en `ahora` y sin resultado, con su
-- Votación. Los usa el proceso de cierre (service role).
-- -----------------------------------------------------------------------------
create function public.votaciones_por_cerrar(ahora timestamptz default now())
returns table (partido_id uuid, club_id text, estado text, abre timestamptz, cierra timestamptz)
language sql
stable
set search_path = ''
as $$
  select p.id, p.club_id, v.estado, v.abre, v.cierra
  from public.partido p
  cross join lateral public.votacion_de_partido(p.id, votaciones_por_cerrar.ahora) v
  where p.inicio - interval '1 hour' <= votaciones_por_cerrar.ahora
    and not exists (select 1 from public.resultado_votacion r where r.partido_id = p.id)
  order by v.cierra, p.id;
$$;

revoke execute on function public.votaciones_por_cerrar(timestamptz) from public, anon, authenticated;
grant execute on function public.votaciones_por_cerrar(timestamptz) to service_role;

-- -----------------------------------------------------------------------------
-- Backoffice (ticket 08): una Votación con resultado congelado es definitiva.
-- Reemplaza `partido_validar` del ticket 08 activando su bloque pendiente: por
-- la API no se puede cambiar `inicio` ni `estado` de un Partido con resultado
-- (cualquier estado de resultado, también 'anulada'). La service role sí.
-- -----------------------------------------------------------------------------
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

  if tg_op = 'UPDATE'
     and (new.inicio is distinct from old.inicio or new.estado is distinct from old.estado)
     and exists (select 1 from public.resultado_votacion o where o.partido_id = old.id) then
    raise exception 'La Votación de este Partido ya tiene 11 Elegido' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.partido_validar() from public, anon, authenticated;

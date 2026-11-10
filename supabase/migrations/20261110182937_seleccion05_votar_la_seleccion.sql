-- =============================================================================
-- Selección, ticket 05: votar la Selección.
--
-- Qué cambia:
--   * `votacion_de_partido` agrega la regla de apertura de la Selección
--     (src/domain/calendario, "Regla de la Selección"): abre 14 días antes del
--     inicio, o al cargarse el Partido si fue después, sin mirar el Partido
--     anterior. Por eso puede haber dos Votaciones de la Selección abiertas a
--     la vez (ADR-0005). Cierre, anulación y postergación siguen igual, y la
--     regla de los Clubes no cambia. `votacion_abierta` (la del ticket 12, que
--     además exige que no haya resultado) la usa, así que hereda la regla
--     nueva sin cambios.
--   * Lecturas: cualquier usuario autenticado con perfil lee los Partidos y
--     los Jugadores de la Selección, y los Rivales de sus Partidos.
--   * Alineación: cualquier usuario con perfil crea y edita la suya para un
--     Partido de la Selección con la Votación abierta, aparte de la de su
--     Club Favorito. Para los Clubes la regla no cambia. La lectura sigue
--     siendo solo la propia.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Si el usuario de la sesión tiene perfil (es un Hincha, con o sin Club).
-- SECURITY DEFINER, como `mi_club_favorito`, para no depender de las
-- políticas de `perfil`. Solo dice algo del propio usuario.
-- -----------------------------------------------------------------------------
create function public.tengo_perfil()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfil p where p.id = auth.uid());
$$;

revoke execute on function public.tengo_perfil() from public, anon;
grant execute on function public.tengo_perfil() to authenticated;

-- -----------------------------------------------------------------------------
-- Calendario de Votación en SQL. Replica EXACTAMENTE `calcularVotaciones` de
-- src/domain/calendario (ver su JSDoc). Un test de RLS compara las dos.
--
--   orden     (inicio, creado_en, id)
--   anterior  último Partido NO cancelado del mismo Club antes en ese orden
--   abre      Club:      max(creado_en, anterior.inicio + 2 h)  (greatest ignora null)
--             Selección: max(creado_en, inicio - 14 días)       (no mira el anterior)
--   cierra    inicio - 1 h
--   estado    anulada si cancelado; cerrada si ahora >= cierra;
--             abierta si ahora >= abre; si no, pendiente.
--
-- Los 14 días van como 336 horas: un intervalo en días depende de la zona
-- horaria de la sesión, y el dominio cuenta milisegundos.
--
-- SECURITY INVOKER: con un Hincha, solo ve los Partidos de su Club y los de
-- la Selección (lo único que necesita la regla). `ahora` es parámetro para
-- poder probarla. `create or replace` conserva los permisos de ejecución.
-- -----------------------------------------------------------------------------
create or replace function public.votacion_de_partido(partido uuid, ahora timestamptz default now())
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
      when ahora >= v.abre then 'abierta'
      else 'pendiente'
    end,
    v.abre,
    p.inicio - interval '1 hour'
  from public.partido p
  join public.club c on c.id = p.club_id
  left join lateral (
    select a.inicio
    from public.partido a
    where not c.es_seleccion
      and a.club_id = p.club_id
      and a.estado = 'programado'
      and (a.inicio, a.creado_en, a.id) < (p.inicio, p.creado_en, p.id)
    order by a.inicio desc, a.creado_en desc, a.id desc
    limit 1
  ) ant on true
  cross join lateral (
    select case
      when c.es_seleccion then greatest(p.creado_en, p.inicio - interval '336 hours')
      else greatest(p.creado_en, ant.inicio + interval '2 hours')
    end as abre
  ) v
  where p.id = votacion_de_partido.partido;
$$;

-- -----------------------------------------------------------------------------
-- Lecturas de la Selección para cualquier Hincha (con o sin Club).
-- -----------------------------------------------------------------------------
create policy "partido: el Hincha lee los de la Selección"
  on public.partido for select
  to authenticated
  using (
    exists (select 1 from public.club c where c.id = partido.club_id and c.es_seleccion)
    and (select public.tengo_perfil())
  );

-- Como en los Clubes, incluye a los que salieron del Plantel y a los no
-- Disponibles: la pantalla muestra el motivo y una Alineación puede nombrarlos.
create policy "jugador: el Hincha lee los de la Selección"
  on public.jugador for select
  to authenticated
  using (
    exists (select 1 from public.club c where c.id = jugador.club_id and c.es_seleccion)
    and (select public.tengo_perfil())
  );

-- Los activos ya se leen (ticket 09); esto suma los dados de baja que siguen
-- en Partidos de la Selección.
create policy "rival: el Hincha lee los de Partidos de la Selección"
  on public.rival for select
  to authenticated
  using (
    (select public.tengo_perfil())
    and exists (
      select 1
      from public.partido p
      join public.club c on c.id = p.club_id
      where p.rival_id = rival.id and c.es_seleccion
    )
  );

-- -----------------------------------------------------------------------------
-- Alineación: la propia, para un Partido de su Club Favorito o de la
-- Selección, con la Votación abierta. Reemplaza las políticas del ticket 09.
-- -----------------------------------------------------------------------------
create function public.puedo_votar_partido(partido uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.partido p
    join public.club c on c.id = p.club_id
    where p.id = puedo_votar_partido.partido
      and (
        p.club_id = (select public.mi_club_favorito())
        or (c.es_seleccion and (select public.tengo_perfil()))
      )
  );
$$;

revoke execute on function public.puedo_votar_partido(uuid) from public, anon;
grant execute on function public.puedo_votar_partido(uuid) to authenticated;

drop policy "alineacion: el Hincha crea la suya con la Votación abierta" on public.alineacion;
drop policy "alineacion: el Hincha edita la suya con la Votación abierta" on public.alineacion;

create policy "alineacion: el Hincha crea la suya con la Votación abierta"
  on public.alineacion for insert
  to authenticated
  with check (
    hincha_id = (select auth.uid())
    and public.puedo_votar_partido(partido_id)
    and public.votacion_abierta(partido_id)
  );

create policy "alineacion: el Hincha edita la suya con la Votación abierta"
  on public.alineacion for update
  to authenticated
  using (
    hincha_id = (select auth.uid())
    and public.puedo_votar_partido(partido_id)
    and public.votacion_abierta(partido_id)
  )
  with check (
    hincha_id = (select auth.uid())
    and public.puedo_votar_partido(partido_id)
    and public.votacion_abierta(partido_id)
  );

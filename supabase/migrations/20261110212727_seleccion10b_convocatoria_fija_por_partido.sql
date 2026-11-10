-- =============================================================================
-- Selección, corrección del ticket 10 (revisión del feature): la Convocatoria
-- queda fija POR PARTIDO.
--
-- Antes, en cuanto un Partido de la Convocatoria tenía 11 Elegido, se fijaba
-- la Convocatoria entera. En una fecha doble con una sola Convocatoria eso le
-- impedía al Admin corregirla para el segundo Partido, cuya Votación sigue
-- abierta (US 61). Ahora:
--
--   * Los convocados (`convocatoria_jugador`) y la Convocatoria misma siguen
--     fijos si alguno de sus Partidos tiene 11 Elegido: cambiarlos cambiaría
--     el Gran Ausente final de ese Partido.
--   * La pertenencia de un Partido (`convocatoria_partido`) solo queda fija
--     para el Partido que tiene 11 Elegido: no se lo puede sacar. Un Partido
--     abierto se puede sacar de una Convocatoria fija, y agregar Partidos
--     siempre se puede (la carga tardía incluida).
--   * `guardar_convocatoria`, al aplicar una Convocatoria a un Partido que
--     está en otra Convocatoria FIJA, lo separa de esa (lo saca de allá). Así
--     el Admin corrige la lista para el Partido abierto creando una
--     Convocatoria nueva, sin tocar la del Partido cerrado. Si la otra no está
--     fija, sigue el error de siempre (23505: ya está en otra Convocatoria).
--
-- Además se califica `partido_id` en las políticas de lectura de la Selección
-- de `resultado_votacion` y `once_real` (dentro de la subconsulta quedaba sin
-- tabla; funcionaba solo porque `partido` y `club` no tienen esa columna).
-- =============================================================================

create or replace function public.convocatoria_proteger_fija()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_convocatoria uuid;
  fija boolean;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_table_name = 'convocatoria_partido' then
      -- Solo cuenta el Partido que se saca (o se cambia): un Partido abierto se
      -- puede sacar aunque otro de la misma Convocatoria ya haya cerrado, y
      -- agregar un Partido siempre se puede (también uno cerrado: es la carga
      -- tardía, y desde ahí queda fijo).
      fija := tg_op <> 'INSERT' and exists (
        select 1 from public.resultado_votacion r
        where r.estado = 'con_once' and r.partido_id = old.partido_id
      );
    else
      if tg_table_name = 'convocatoria' then
        id_convocatoria := old.id;
      elsif tg_op = 'DELETE' then
        id_convocatoria := old.convocatoria_id;
      else
        id_convocatoria := new.convocatoria_id;
      end if;
      fija := exists (
        select 1
        from public.convocatoria_partido cp
        join public.resultado_votacion r on r.partido_id = cp.partido_id
        where cp.convocatoria_id = id_convocatoria and r.estado = 'con_once'
      );
    end if;

    if fija then
      raise exception 'La Convocatoria ya tiene Gran Ausente final publicado: no se puede cambiar'
        using errcode = 'EV100';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.convocatoria_proteger_fija() from public, anon, authenticated;

-- Misma función que en seleccion09; solo se agrega la separación de los
-- Partidos que estaban en una Convocatoria fija.
create or replace function public.guardar_convocatoria(convocatoria uuid, jugadores uuid[], partidos uuid[])
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

  -- Separar de una Convocatoria fija los Partidos elegidos (el trigger impide
  -- separar uno que ya tiene 11 Elegido).
  delete from public.convocatoria_partido cp
  where cp.partido_id = any (coalesce(partidos, '{}'))
    and cp.convocatoria_id <> id_convocatoria
    and exists (
      select 1
      from public.convocatoria_partido otro
      join public.resultado_votacion r on r.partido_id = otro.partido_id
      where otro.convocatoria_id = cp.convocatoria_id and r.estado = 'con_once'
    );

  delete from public.convocatoria_partido cp
  where cp.convocatoria_id = id_convocatoria and cp.partido_id <> all (coalesce(partidos, '{}'));
  insert into public.convocatoria_partido (convocatoria_id, partido_id)
  select id_convocatoria, p from unnest(coalesce(partidos, '{}')) as p
  on conflict (convocatoria_id, partido_id) do nothing;

  return id_convocatoria;
end;
$$;

-- -----------------------------------------------------------------------------
-- Políticas de lectura de la Selección con `partido_id` calificado.
-- -----------------------------------------------------------------------------
drop policy "resultado_votacion: cualquier usuario con perfil lee los de la Selección" on public.resultado_votacion;
create policy "resultado_votacion: cualquier usuario con perfil lee los de la Selección"
  on public.resultado_votacion for select
  to authenticated
  using (
    (select public.tengo_perfil())
    and exists (
      select 1 from public.partido p join public.club c on c.id = p.club_id
      where p.id = resultado_votacion.partido_id and c.es_seleccion
    )
  );

drop policy "once_real: cualquier usuario con perfil lee los de la Selección" on public.once_real;
create policy "once_real: cualquier usuario con perfil lee los de la Selección"
  on public.once_real for select
  to authenticated
  using (
    (select public.tengo_perfil())
    and exists (
      select 1 from public.partido p join public.club c on c.id = p.club_id
      where p.id = once_real.partido_id and c.es_seleccion
    )
  );

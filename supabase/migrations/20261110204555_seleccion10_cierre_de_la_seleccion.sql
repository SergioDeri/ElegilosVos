-- =============================================================================
-- Selección, ticket 10: cierre de la Selección (11 Elegido y Gran Ausente final).
--
-- Qué agrega:
--   * `resultado_votacion.apariciones` (jsonb, nula en los Clubes): en cuántas
--     Alineaciones figura cada Jugador al cierre, `{ alineaciones, porJugador:
--     [{ jugadorId, apariciones }] }` (`contarApariciones` de
--     @/domain/destacados). Se congela con el resultado y es tan inmutable como
--     él (el trigger del ticket 12 rechaza todo UPDATE). El Gran Ausente final
--     NO se guarda: se deriva de estas apariciones y la Convocatoria, así que
--     si la Convocatoria se carga después del cierre aparece sin tocar el
--     resultado.
--   * Lectura de los resultados de la Selección: cualquier usuario con perfil
--     (los de un Club siguen siendo solo para los Hinchas de ese Club).
--   * La Convocatoria queda FIJA una vez que hay Gran Ausente final: si alguno
--     de sus Partidos ya tiene resultado `con_once`, por la API (anon /
--     authenticated, también el Admin con 2FA) no se corrige, no se le
--     agregan ni sacan Jugadores o Partidos y no se borra (`EV100`). La service
--     role no se restringe (tests, mantenimiento y el borrado en cascada de un
--     Partido), como en `partido_proteger_resultado`. Cargar una Convocatoria
--     nueva para un Partido ya cerrado sí se puede (queda fija al guardarla).
-- =============================================================================

alter table public.resultado_votacion
  add column apariciones jsonb check (apariciones is null or jsonb_typeof(apariciones) = 'object');

comment on column public.resultado_votacion.apariciones is
  'Selección: apariciones de cada Jugador al cierre ({alineaciones, porJugador}); nula en los Clubes. Inmutable.';

create policy "resultado_votacion: cualquier usuario con perfil lee los de la Selección"
  on public.resultado_votacion for select
  to authenticated
  using (
    (select public.tengo_perfil())
    and exists (
      select 1 from public.partido p join public.club c on c.id = p.club_id
      where p.id = partido_id and c.es_seleccion
    )
  );

-- -----------------------------------------------------------------------------
-- Convocatoria fija después de publicado el Gran Ausente final.
-- -----------------------------------------------------------------------------
create function public.convocatoria_proteger_fija()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_convocatoria uuid;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_table_name = 'convocatoria' then
      id_convocatoria := old.id;
    elsif tg_op = 'DELETE' then
      id_convocatoria := old.convocatoria_id;
    else
      id_convocatoria := new.convocatoria_id;
    end if;

    if exists (
      select 1
      from public.convocatoria_partido cp
      join public.resultado_votacion r on r.partido_id = cp.partido_id
      where cp.convocatoria_id = id_convocatoria and r.estado = 'con_once'
    ) then
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

create trigger convocatoria_proteger_fija
  before update or delete on public.convocatoria
  for each row execute function public.convocatoria_proteger_fija();

create trigger convocatoria_jugador_proteger_fija
  before insert or update or delete on public.convocatoria_jugador
  for each row execute function public.convocatoria_proteger_fija();

create trigger convocatoria_partido_proteger_fija
  before insert or update or delete on public.convocatoria_partido
  for each row execute function public.convocatoria_proteger_fija();

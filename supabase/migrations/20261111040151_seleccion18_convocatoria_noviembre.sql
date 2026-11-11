-- =============================================================================
-- Selección, ticket 18: la Convocatoria oficial de la fecha FIFA de noviembre
-- 2026 (assets/convocatoria.md, 28 Jugadores) para los Partidos de la
-- Selección del 13 al 18 de noviembre (hora de Uruguay): Argentina el 13 y,
-- si está cargado, el del 17.
--
-- Va en una migración para que llegue a producción sin el backoffice. Los
-- nombres se comparan sin tildes ni mayúsculas ("Fiermarin" = "Fiermarín").
-- Si falta alguno de los 28 en el Plantel de la Selección, la migración
-- falla entera: no se carga una Convocatoria incompleta.
--
-- Solo toma Partidos que todavía no están en una Convocatoria (si el Admin ya
-- cargó una, no se toca). Si no queda ningún Partido, no hace nada.
-- Como cualquier Convocatoria cargada, sale el aviso "convocatoria_cargada"
-- (lo manda el proceso de notificaciones).
-- =============================================================================

do $$
declare
  nombres text[] := array[
    'Santiago Mele',
    'Cristopher Fiermarin',
    'Ignacio de Arruabarrena',
    'Sebastián Jaume',
    'Guillermo Varela',
    'Santiago Mouriño',
    'Ronald Araujo',
    'José María Giménez',
    'Juan Rodríguez',
    'Sebastián Cáceres',
    'Mathías Olivera',
    'Joaquín Piquerez',
    'Juan Manuel Sanabria',
    'Lucas Torreira',
    'Rodrigo Bentancur',
    'Facundo Bernal',
    'Federico Valverde',
    'Agustín Canobbio',
    'Facundo Pellistri',
    'Maximiliano Araújo',
    'Rodrigo Zalazar',
    'Giorgian de Arrascaeta',
    'Nicolás de la Cruz',
    'Martín Satriano',
    'Rodrigo Aguirre',
    'Federico Viñas',
    'Darwin Núñez',
    'Bruno Damiani'
  ];
  jugadores uuid[];
  partidos uuid[];
  faltan text[];
  id_convocatoria uuid;
begin
  -- Mismo nombre sin tildes ni mayúsculas.
  select array_agg(n) into faltan
  from unnest(nombres) as n
  where not exists (
    select 1 from public.jugador j
    where j.club_id = 'seleccion' and j.en_plantel
      and lower(translate(j.nombre, 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN')) = lower(translate(n, 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN'))
  );
  if faltan is not null then
    raise exception 'Convocados que no están en el Plantel de la Selección: %', faltan;
  end if;

  select array_agg(distinct j.id) into jugadores
  from public.jugador j
  join unnest(nombres) as n on lower(translate(j.nombre, 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN')) = lower(translate(n, 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN'))
  where j.club_id = 'seleccion' and j.en_plantel;

  if cardinality(jugadores) <> cardinality(nombres) then
    raise exception 'Se esperaban % convocados y hay %', cardinality(nombres), cardinality(jugadores);
  end if;

  -- 13 al 18 de noviembre en Montevideo (UTC-3).
  select array_agg(p.id) into partidos
  from public.partido p
  where p.club_id = 'seleccion'
    and p.estado = 'programado'
    and p.inicio >= timestamptz '2026-11-13 03:00:00+00'
    and p.inicio <  timestamptz '2026-11-19 03:00:00+00'
    and not exists (select 1 from public.convocatoria_partido cp where cp.partido_id = p.id);

  if partidos is null then
    raise notice 'No hay Partidos de la Selección sin Convocatoria del 13 al 18 de noviembre: no se carga nada.';
    return;
  end if;

  insert into public.convocatoria default values returning id into id_convocatoria;
  insert into public.convocatoria_jugador (convocatoria_id, jugador_id) select id_convocatoria, unnest(jugadores);
  insert into public.convocatoria_partido (convocatoria_id, partido_id) select id_convocatoria, unnest(partidos);
end;
$$;

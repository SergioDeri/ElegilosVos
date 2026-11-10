-- =============================================================================
-- Selección, ticket 04: datos de ejemplo del Plantel y los Partidos de la
-- Selección (solo local). A diferencia de los Planteles de los Clubes del
-- seed base, los elegibles son futbolistas uruguayos reales, sin número: en la
-- Selección el número no se lleva.
-- =============================================================================

-- Elegibles de la Selección (convocados o no).
insert into public.jugador (club_id, nombre, numero, posicion_natural) values
  ('seleccion', 'Sergio Rochet',             null, 'ARQ'),
  ('seleccion', 'Santiago Mele',             null, 'ARQ'),
  ('seleccion', 'Franco Israel',             null, 'ARQ'),
  ('seleccion', 'Ronald Araújo',             null, 'DEF'),
  ('seleccion', 'José María Giménez',        null, 'DEF'),
  ('seleccion', 'Mathías Olivera',           null, 'DEF'),
  ('seleccion', 'Guillermo Varela',          null, 'DEF'),
  ('seleccion', 'Santiago Bueno',            null, 'DEF'),
  ('seleccion', 'Sebastián Cáceres',         null, 'DEF'),
  ('seleccion', 'Joaquín Piquerez',          null, 'DEF'),
  ('seleccion', 'Matías Viña',               null, 'DEF'),
  ('seleccion', 'Nicolás Marichal',          null, 'DEF'),
  ('seleccion', 'Federico Valverde',         null, 'MED'),
  ('seleccion', 'Manuel Ugarte',             null, 'MED'),
  ('seleccion', 'Rodrigo Bentancur',         null, 'MED'),
  ('seleccion', 'Giorgian De Arrascaeta',    null, 'MED'),
  ('seleccion', 'Nicolás de la Cruz',        null, 'MED'),
  ('seleccion', 'Nahitan Nández',            null, 'MED'),
  ('seleccion', 'Maximiliano Araújo',        null, 'MED'),
  ('seleccion', 'Emiliano Martínez',         null, 'MED'),
  ('seleccion', 'Rodrigo Zalazar',           null, 'MED'),
  ('seleccion', 'Juan Manuel Sanabria',      null, 'MED'),
  ('seleccion', 'Facundo Pellistri',         null, 'DEL'),
  ('seleccion', 'Darwin Núñez',              null, 'DEL'),
  ('seleccion', 'Federico Viñas',            null, 'DEL'),
  ('seleccion', 'Rodrigo Aguirre',           null, 'DEL'),
  ('seleccion', 'Agustín Canobbio',          null, 'DEL'),
  ('seleccion', 'Brian Rodríguez',           null, 'DEL'),
  ('seleccion', 'Facundo Torres',            null, 'DEL'),
  ('seleccion', 'Cristian Olivera',          null, 'DEL');

-- Un par de elegibles no Disponibles, para ver la Disponibilidad con motivo.
update public.jugador set disponibilidad = 'lesionado', motivo_disponibilidad = 'Lesión muscular'
  where club_id = 'seleccion' and nombre = 'Ronald Araújo';
update public.jugador set disponibilidad = 'suspendido', motivo_disponibilidad = 'Acumulación de amarillas'
  where club_id = 'seleccion' and nombre = 'Manuel Ugarte';

-- Rivales de la Selección: otras selecciones (sin Club; el escudo lo sube el Admin).
insert into public.rival (nombre, activo) values
  ('Brasil', true),
  ('Argentina', true),
  ('Chile', true),
  ('Paraguay', true),
  ('Colombia', true),
  ('Ecuador', true)
on conflict (nombre) do nothing;

-- Una fecha doble futura (dos Partidos con 5 días de diferencia) y uno más
-- adelante, relativos a la fecha del reset. 23:00 UTC = 20:00 en Montevideo.
with base as (
  select date_trunc('day', now()) + interval '23 hours' as hoy_20_uy
)
insert into public.partido (club_id, rival_id, inicio, estado)
select 'seleccion', r.id, base.hoy_20_uy + p.desfase, 'programado'
from base, (values
  ('Brasil',    interval '20 days'),
  ('Argentina', interval '25 days'),
  ('Chile',     interval '60 days')
) as p(rival, desfase)
join public.rival r on r.nombre = p.rival;

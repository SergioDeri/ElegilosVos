-- =============================================================================
-- Datos de ejemplo para desarrollo local (se cargan con `npx supabase db reset`).
-- Los nombres de los Jugadores son FICTICIOS. No hay usuarios acá: los tests
-- de RLS crean los suyos con el helper de tests/rls/.
-- Los Clubes no van acá: son datos fijos y se cargan en la migración base.
-- =============================================================================

-- Rivales (incluye a los dos Clubes, para cargar el Clásico).
insert into public.rival (nombre, activo) values
  ('Peñarol', true),
  ('Nacional', true),
  ('Defensor Sporting', true),
  ('Danubio', true),
  ('Liverpool', true),
  ('Montevideo Wanderers', true),
  ('Cerro', true),
  ('River Plate', true),
  ('Racing', true),
  ('Rampla Juniors', false); -- dado de baja: no debería ofrecerse para Partidos nuevos

-- Planteles: 25 Jugadores por Club (3 ARQ, 8 DEF, 8 MED, 6 DEL).
insert into public.jugador (club_id, nombre, numero, posicion_natural) values
  ('penarol', 'Santiago Díaz', 1, 'ARQ'),
  ('penarol', 'Lucas Pérez', 12, 'ARQ'),
  ('penarol', 'Agustín Laborda', 25, 'ARQ'),
  ('penarol', 'Nicolás Ferreira', 2, 'DEF'),
  ('penarol', 'Leandro Pérez', 3, 'DEF'),
  ('penarol', 'Kevin Varela', 4, 'DEF'),
  ('penarol', 'Diego Fernández', 5, 'DEF'),
  ('penarol', 'Agustín Larrosa', 6, 'DEF'),
  ('penarol', 'Franco Silva', 13, 'DEF'),
  ('penarol', 'Rodrigo Sosa', 14, 'DEF'),
  ('penarol', 'Cristian Larrosa', 15, 'DEF'),
  ('penarol', 'Facundo Romero', 8, 'MED'),
  ('penarol', 'Nicolás Méndez', 10, 'MED'),
  ('penarol', 'Valentín Lemos', 16, 'MED'),
  ('penarol', 'Leandro Pintos', 17, 'MED'),
  ('penarol', 'Facundo Méndez', 18, 'MED'),
  ('penarol', 'Facundo Quintana', 20, 'MED'),
  ('penarol', 'Andrés López', 22, 'MED'),
  ('penarol', 'Federico Morales', 23, 'MED'),
  ('penarol', 'Matías Laborda', 7, 'DEL'),
  ('penarol', 'Nicolás Romero', 9, 'DEL'),
  ('penarol', 'Federico Quintana', 11, 'DEL'),
  ('penarol', 'Pablo Núñez', 19, 'DEL'),
  ('penarol', 'Nicolás Lemos', 21, 'DEL'),
  ('penarol', 'Leandro Olivera', 24, 'DEL'),
  ('nacional', 'Joaquín Martínez', 1, 'ARQ'),
  ('nacional', 'Cristian Silva', 12, 'ARQ'),
  ('nacional', 'Leandro Pérez', 25, 'ARQ'),
  ('nacional', 'Thiago Acosta', 2, 'DEF'),
  ('nacional', 'Bruno Laborda', 3, 'DEF'),
  ('nacional', 'Franco Correa', 4, 'DEF'),
  ('nacional', 'Emiliano Lemos', 5, 'DEF'),
  ('nacional', 'Kevin Da Silva', 6, 'DEF'),
  ('nacional', 'Joaquín Pereira', 13, 'DEF'),
  ('nacional', 'Rodrigo Núñez', 14, 'DEF'),
  ('nacional', 'Mauricio Viera', 15, 'DEF'),
  ('nacional', 'Agustín Romero', 8, 'MED'),
  ('nacional', 'Federico Arismendi', 10, 'MED'),
  ('nacional', 'Bruno De León', 16, 'MED'),
  ('nacional', 'Germán Bentancor', 17, 'MED'),
  ('nacional', 'Federico Duarte', 18, 'MED'),
  ('nacional', 'Agustín Suárez', 20, 'MED'),
  ('nacional', 'Maximiliano Morales', 22, 'MED'),
  ('nacional', 'Sebastián De León', 23, 'MED'),
  ('nacional', 'Matías Machado', 7, 'DEL'),
  ('nacional', 'Franco Fernández', 9, 'DEL'),
  ('nacional', 'Ignacio Silva', 11, 'DEL'),
  ('nacional', 'Felipe Quintana', 19, 'DEL'),
  ('nacional', 'Leandro Correa', 21, 'DEL'),
  ('nacional', 'Santiago Techera', 24, 'DEL');

-- Algunas Disponibilidades distintas de 'disponible' y una baja del Plantel.
update public.jugador set disponibilidad = 'lesionado', motivo_disponibilidad = 'Desgarro en el isquiotibial'
  where club_id = 'penarol' and numero = 9;
update public.jugador set disponibilidad = 'suspendido', motivo_disponibilidad = 'Acumulación de amarillas'
  where club_id = 'penarol' and numero = 4;
update public.jugador set en_plantel = false
  where club_id = 'penarol' and numero = 24;
update public.jugador set disponibilidad = 'lesionado', motivo_disponibilidad = 'Esguince de tobillo'
  where club_id = 'nacional' and numero = 10;
update public.jugador set disponibilidad = 'no_disponible', motivo_disponibilidad = 'Convocado a la selección'
  where club_id = 'nacional' and numero = 1;
update public.jugador set en_plantel = false
  where club_id = 'nacional' and numero = 21;

-- Partidos de prueba, relativos a la fecha del reset para que siempre haya
-- un Partido pasado, uno próximo (con Votación abierta) y otros futuros.
-- Las horas se guardan en UTC; 23:00 UTC = 20:00 en Montevideo.
with base as (
  select date_trunc('day', now()) + interval '23 hours' as hoy_20_uy
)
insert into public.partido (club_id, rival_id, inicio, estado, creado_en)
select p.club_id, r.id, base.hoy_20_uy + p.desfase, p.estado::public.estado_partido, now() - interval '30 days'
from base, (values
  ('penarol',  'Danubio',              interval '-7 days', 'programado'),
  ('penarol',  'Defensor Sporting',    interval '3 days',  'programado'),
  ('penarol',  'Nacional',             interval '10 days', 'programado'), -- Clásico (lado Peñarol)
  ('penarol',  'Cerro',                interval '17 days', 'cancelado'),
  ('nacional', 'Liverpool',            interval '-6 days', 'programado'),
  ('nacional', 'Montevideo Wanderers', interval '4 days',  'programado'),
  ('nacional', 'Peñarol',              interval '10 days', 'programado'), -- Clásico (lado Nacional)
  ('nacional', 'River Plate',          interval '18 days', 'programado')
) as p(club_id, rival, desfase, estado)
join public.rival r on r.nombre = p.rival;

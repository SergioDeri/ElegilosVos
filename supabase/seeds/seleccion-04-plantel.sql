-- =============================================================================
-- Selección, ticket 04: datos de ejemplo del Plantel y los Partidos de la
-- Selección (solo local). A diferencia de los Planteles de los Clubes del
-- seed base, los elegibles son futbolistas uruguayos reales, sin número: en la
-- Selección el número no se lleva.
-- =============================================================================

-- Los elegibles de la Selección los carga la migración *_seleccion15_elegibles_completos.sql.

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

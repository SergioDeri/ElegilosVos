-- =============================================================================
-- Selección, ticket 05 (E2E): una fecha doble de la Selección con las dos
-- Votaciones abiertas al hacer el reset (inician en 3 y 8 días; abren 14 días
-- antes, o sea al cargarse). Los usa tests/e2e/05-votar-la-seleccion.spec.ts.
-- Los Jugadores son los elegibles de la migración *_seleccion15_elegibles_completos.sql.
-- =============================================================================

-- El Partido de fecha fija contra Argentina (migración
-- *_seleccion16_partido_argentina.sql, para producción) se saca en local: los
-- escenarios E2E arrancan por la fecha doble de acá, relativa al reset.
delete from public.partido p
using public.rival r
where p.rival_id = r.id and r.nombre = 'Argentina' and p.club_id = 'seleccion'
  and p.inicio = timestamptz '2026-11-13 21:00:00+00';
-- Y la Convocatoria de noviembre (migración *_seleccion18_*) que le quedó sin Partidos.
delete from public.convocatoria c
where not exists (select 1 from public.convocatoria_partido cp where cp.convocatoria_id = c.id);

insert into public.rival (nombre, activo) values
  ('Perú (E2E 05)', true),
  ('Venezuela (E2E 05)', true)
on conflict (nombre) do nothing;

insert into public.partido (club_id, rival_id, inicio, estado)
select 'seleccion', r.id, date_trunc('hour', now()) + p.desfase, 'programado'
from (values
  ('Perú (E2E 05)',      interval '3 days'),
  ('Venezuela (E2E 05)', interval '8 days')
) as p(rival, desfase)
join public.rival r on r.nombre = p.rival;

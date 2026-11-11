-- =============================================================================
-- Selección, ticket 05 (E2E): una fecha doble de la Selección con las dos
-- Votaciones abiertas al hacer el reset (inician en 3 y 8 días; abren 14 días
-- antes, o sea al cargarse). Los usa tests/e2e/05-votar-la-seleccion.spec.ts.
-- Los Jugadores son los elegibles de la migración *_seleccion15_elegibles_completos.sql.
-- =============================================================================

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

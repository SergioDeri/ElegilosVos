-- =============================================================================
-- Selección, ticket 16: el próximo Partido de la Selección, Uruguay vs
-- Argentina el viernes 13 de noviembre de 2026 a las 18:00 de Montevideo
-- (21:00 UTC; Uruguay no tiene horario de verano).
--
-- Va en una migración para que llegue a producción. No duplica: el Rival se
-- carga solo si no existe (el nombre es único) y el Partido solo si la
-- Selección no tiene ya uno contra Argentina ese día.
--
-- El escudo no se puede subir desde una migración (vive en el bucket
-- `escudos`): el PNG pixel art está en assets/escudos/argentina.png y lo sube
-- el Admin en /admin/rivales. Hasta entonces se ve el hueco "falta escudo".
-- =============================================================================

insert into public.rival (nombre, activo) values ('Argentina', true)
on conflict (nombre) do nothing;

-- Si estaba dado de baja (baja lógica), vuelve a estar activo.
update public.rival set activo = true where nombre = 'Argentina' and not activo;

insert into public.partido (club_id, rival_id, inicio, estado)
select 'seleccion', r.id, timestamptz '2026-11-13 21:00:00+00', 'programado'
from public.rival r
where r.nombre = 'Argentina'
  and not exists (
    select 1 from public.partido p
    where p.club_id = 'seleccion'
      and p.rival_id = r.id
      and p.inicio >= timestamptz '2026-11-13 03:00:00+00'
      and p.inicio <  timestamptz '2026-11-14 03:00:00+00'
  );

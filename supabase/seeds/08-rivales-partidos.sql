-- =============================================================================
-- Ticket 08: los Rivales "Peñarol" y "Nacional" del catálogo representan a
-- cada Club (para el Clásico). En producción lo marca el Admin al cargarlos.
-- =============================================================================
update public.rival r
   set club_id = c.id
  from public.club c
 where r.nombre = c.nombre
   and r.club_id is null;

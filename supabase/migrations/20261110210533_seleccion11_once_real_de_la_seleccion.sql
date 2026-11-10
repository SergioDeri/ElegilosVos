-- =============================================================================
-- Selección, ticket 11: 11 Real de la Selección.
--
-- La carga ya funcionaba para la Selección desde el ticket 14 del MVP: el
-- trigger `once_real_validar` exige 11 Jugadores distintos del dueño del
-- Partido (`jugador.club_id = partido.club_id`), o sea elegibles del Plantel
-- de la Selección, y las políticas de escritura son de `es_admin()`. Lo que
-- faltaba es la lectura: el 11 Real de un Partido de la Selección lo lee
-- cualquier usuario con perfil (con Club o sin Club), como su resultado.
-- =============================================================================

create policy "once_real: cualquier usuario con perfil lee los de la Selección"
  on public.once_real for select
  to authenticated
  using (
    (select public.tengo_perfil())
    and exists (
      select 1 from public.partido p join public.club c on c.id = p.club_id
      where p.id = partido_id and c.es_seleccion
    )
  );

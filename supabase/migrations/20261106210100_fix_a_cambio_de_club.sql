-- =============================================================================
-- Corrección A: votos del Club anterior al cambiar el Club Favorito.
--
-- Si el Admin le cambia el Club Favorito a un Hincha con la Votación abierta,
-- su Alineación del Club anterior no debe seguir contando. Hay dos defensas:
--
--   (a) El conteo (Parcial y cierre, src/lib/votacion/conteo.ts) solo cuenta
--       Alineaciones de Hinchas cuyo Club Favorito de HOY es el Club del
--       Partido. Es la defensa principal: cubre cualquier forma de cambiar el
--       Club (función, SQL a mano, service role).
--   (b) Esta función, además, BORRA las Alineaciones del Hincha en Partidos del
--       Club anterior cuya Votación está abierta. Así no quedan filas
--       "huérfanas" que el Hincha ya no puede ver ni editar (las políticas de
--       `alineacion` exigen su Club) y, si el Admin lo vuelve a pasar al Club
--       anterior, arranca de nuevo (por Herencia) en lugar de revivir un voto
--       viejo.
--
-- Decisiones:
--   * Solo Votaciones ABIERTAS (`votacion_abierta(partido)` con now()): las
--     Alineaciones de Votaciones cerradas son historia (y alimentan la
--     Herencia si vuelve al Club); los resultados congelados no cambian.
--   * Si el Club no cambia, no se borra nada.
--   * Mismo contrato y errores que la versión del ticket 07 (42501, 22023,
--     P0002); `create or replace` conserva los permisos de ejecución.
-- =============================================================================

create or replace function public.cambiar_club_favorito(hincha uuid, club text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  club_anterior text;
begin
  if not public.es_admin() then
    raise exception 'Solo el Admin con 2FA' using errcode = '42501';
  end if;

  if cambiar_club_favorito.club is null
     or not exists (select 1 from public.club c where c.id = cambiar_club_favorito.club) then
    raise exception 'Club inválido' using errcode = '22023';
  end if;

  select p.club_favorito_id into club_anterior
    from public.perfil p
   where p.id = cambiar_club_favorito.hincha
     for update;

  if not found then
    raise exception 'No existe el Hincha' using errcode = 'P0002';
  end if;

  -- El trigger perfil_proteger_cambios deja pasar al Admin con 2FA.
  update public.perfil p
     set club_favorito_id = cambiar_club_favorito.club
   where p.id = cambiar_club_favorito.hincha;

  if club_anterior is not null and club_anterior <> cambiar_club_favorito.club then
    delete from public.alineacion a
     using public.partido pa
     where a.hincha_id = cambiar_club_favorito.hincha
       and pa.id = a.partido_id
       and pa.club_id = club_anterior
       and public.votacion_abierta(pa.id);
  end if;

  return cambiar_club_favorito.club;
end;
$$;

revoke execute on function public.cambiar_club_favorito(uuid, text) from public, anon;
grant execute on function public.cambiar_club_favorito(uuid, text) to authenticated;

-- =============================================================================
-- Selección, ticket 14: avisos de Convocatoria cargada y Gran Ausente final.
--
-- Dos tipos nuevos en el registro de enviados (`notificacion_enviada`), los
-- dos con referencia = partido.id (uno por Partido de la Selección):
--   * `convocatoria_cargada`: salió la Convocatoria, con el Gran Ausente
--     provisorio, mientras la Votación del Partido sigue abierta.
--   * `gran_ausente_final`: salió el 11 Elegido de la Selección con el Gran
--     Ausente final (al cierre si ya había Convocatoria, o cuando el Admin la
--     carga tarde).
-- Qué avisar lo decide `avisosPendientes` de @/domain/notificaciones; la tabla
-- solo evita que el mismo aviso salga dos veces. RLS no cambia (solo la
-- service role).
-- =============================================================================

alter table public.notificacion_enviada drop constraint notificacion_enviada_tipo_check;

alter table public.notificacion_enviada
  add constraint notificacion_enviada_tipo_check check (
    tipo in (
      'votacion_abierta',
      'cierra_pronto',
      'once_elegido',
      'jugador_no_disponible',
      'convocatoria_cargada',
      'gran_ausente_final'
    )
  );

-- =============================================================================
-- Selección, ticket 13: preferencias de notificación.
--
--   * preferencia_notificacion: los dos interruptores del Hincha, "mi club"
--     (avisos de su Club Favorito) y "Selección". Una fila por Hincha; sin
--     fila, los dos están prendidos (`preferenciasDesdeFila` de
--     @/domain/notificaciones). Cada Hincha lee, crea y cambia solo la suya;
--     el proceso de notificaciones la lee con la service role.
--
-- Cuelga de perfil con ON DELETE CASCADE (borrado de cuenta).
-- =============================================================================

create table public.preferencia_notificacion (
  hincha_id uuid primary key default auth.uid() references public.perfil (id) on delete cascade,
  mi_club boolean not null default true,
  seleccion boolean not null default true,
  actualizado_en timestamptz not null default now()
);

create trigger preferencia_notificacion_actualizado_en
  before update on public.preferencia_notificacion
  for each row execute function public.tocar_actualizado_en();

alter table public.preferencia_notificacion enable row level security;
revoke all on public.preferencia_notificacion from anon, authenticated;
grant select on public.preferencia_notificacion to authenticated;
grant insert (hincha_id, mi_club, seleccion) on public.preferencia_notificacion to authenticated;
grant update (mi_club, seleccion) on public.preferencia_notificacion to authenticated;

create policy "preferencia_notificacion: el Hincha lee la suya"
  on public.preferencia_notificacion for select
  to authenticated
  using (hincha_id = (select auth.uid()));

create policy "preferencia_notificacion: el Hincha crea la suya"
  on public.preferencia_notificacion for insert
  to authenticated
  with check (hincha_id = (select auth.uid()));

create policy "preferencia_notificacion: el Hincha cambia la suya"
  on public.preferencia_notificacion for update
  to authenticated
  using (hincha_id = (select auth.uid()))
  with check (hincha_id = (select auth.uid()));

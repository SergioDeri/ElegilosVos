-- =============================================================================
-- Ticket 15: Notificaciones push.
--
--   * suscripcion_push: suscripciones Web Push de cada Hincha (una por
--     navegador/dispositivo). El endpoint y las claves son sensibles: cada
--     Hincha solo ve, crea y borra las suyas. Se envían desde el servidor con
--     la service role.
--   * registrar_suscripcion_push(...): alta idempotente por endpoint. Si el
--     mismo navegador estaba suscripto con otra cuenta (cambio de sesión en el
--     mismo dispositivo), la suscripción pasa a la cuenta de la sesión.
--   * notificacion_enviada: registro de enviados (una fila por Hincha, tipo y
--     referencia). El proceso la inserta con ON CONFLICT DO NOTHING ANTES de
--     enviar: cada notificación sale a lo sumo una vez. Sin acceso por la API.
--
-- Ambas cuelgan de perfil con ON DELETE CASCADE (borrado de cuenta, ticket 13).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- suscripcion_push
-- -----------------------------------------------------------------------------
create table public.suscripcion_push (
  id uuid primary key default gen_random_uuid(),
  hincha_id uuid not null default auth.uid() references public.perfil (id) on delete cascade,
  -- URL del servicio push del navegador. Mismas reglas que validarSuscripcion
  -- de @/domain/notificaciones.
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 2048),
  -- Claves del navegador en base64url sin padding: P-256 (65 bytes) y auth (16 bytes).
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),
  -- Para que el Hincha reconozca sus dispositivos (opcional).
  user_agent text check (char_length(user_agent) <= 512),
  creado_en timestamptz not null default now()
);

create index suscripcion_push_hincha_idx on public.suscripcion_push (hincha_id);

alter table public.suscripcion_push enable row level security;
revoke all on public.suscripcion_push from anon, authenticated;
grant select, delete on public.suscripcion_push to authenticated;
grant insert (hincha_id, endpoint, p256dh, auth, user_agent) on public.suscripcion_push to authenticated;

create policy "suscripcion_push: el Hincha lee las suyas"
  on public.suscripcion_push for select
  to authenticated
  using (hincha_id = (select auth.uid()));

create policy "suscripcion_push: el Hincha crea las suyas"
  on public.suscripcion_push for insert
  to authenticated
  with check (hincha_id = (select auth.uid()));

create policy "suscripcion_push: el Hincha borra las suyas"
  on public.suscripcion_push for delete
  to authenticated
  using (hincha_id = (select auth.uid()));

-- Alta o reasignación por endpoint para el usuario de la sesión. SECURITY
-- DEFINER porque, si el endpoint estaba a nombre de otra cuenta (el mismo
-- navegador con otra sesión), hay que poder reemplazar esa fila, que RLS no
-- deja ver. Solo quien tiene el endpoint (el propio navegador) puede hacerlo:
-- es una URL secreta que no se expone por ningún lado.
create function public.registrar_suscripcion_push(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hincha uuid := auth.uid();
begin
  if v_hincha is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;
  insert into public.suscripcion_push (hincha_id, endpoint, p256dh, auth, user_agent)
  values (v_hincha, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 512))
  on conflict (endpoint) do update
    set hincha_id = excluded.hincha_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        creado_en = now();
end;
$$;

revoke execute on function public.registrar_suscripcion_push(text, text, text, text) from public, anon;
grant execute on function public.registrar_suscripcion_push(text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- notificacion_enviada
-- -----------------------------------------------------------------------------
create table public.notificacion_enviada (
  hincha_id uuid not null references public.perfil (id) on delete cascade,
  tipo text not null check (tipo in ('votacion_abierta', 'cierra_pronto', 'once_elegido', 'jugador_no_disponible')),
  -- partido.id (votacion_abierta, cierra_pronto, once_elegido) o
  -- evento_disponibilidad.id (jugador_no_disponible). Sin FK: es polimórfica.
  referencia uuid not null,
  enviado_en timestamptz not null default now(),
  primary key (hincha_id, tipo, referencia)
);

create index notificacion_enviada_referencia_idx on public.notificacion_enviada (referencia);

-- RLS sin políticas: solo la service role (el proceso de notificaciones).
alter table public.notificacion_enviada enable row level security;
revoke all on public.notificacion_enviada from anon, authenticated;

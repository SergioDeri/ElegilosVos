-- =============================================================================
-- Ticket 07: Admin de ejemplo SOLO PARA DESARROLLO LOCAL.
--   email:      admin@elegilosvos.local
--   contraseña: admin-local-123
-- Al entrar a /admin pide enrolar el 2FA (TOTP) la primera vez.
-- Los seeds no se aplican en producción: ahí el primer Admin se crea a mano
-- (ver README, "Backoffice").
-- =============================================================================
do $$
declare
  admin_id uuid := '00000000-0000-4000-8000-000000000007';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
    'admin@elegilosvos.local', extensions.crypt('admin-local-123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), admin_id, admin_id::text,
    jsonb_build_object('sub', admin_id::text, 'email', 'admin@elegilosvos.local', 'email_verified', true),
    'email', now(), now(), now()
  );

  -- El perfil lo creó el trigger de auth.users.
  update public.perfil set rol = 'admin', club_favorito_id = 'penarol' where id = admin_id;
end;
$$;

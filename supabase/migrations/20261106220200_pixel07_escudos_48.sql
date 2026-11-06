-- Diseño pixel art, ticket 07: escudos pixel 48x48 y sección "Clubes".
-- (.scratch/diseno-pixel-art/issues/07-escudos-48.md)
--
--   * El Admin con 2FA (`es_admin()`) puede cambiar el escudo de un Club
--     (`club.escudo_path`, columna que ya existía). Nada más de `club` se
--     escribe por la API: el resto sigue revocado (ticket 17).
--   * El bucket `escudos` (ticket 08 del MVP) pasa a aceptar solo PNG de
--     hasta 64 KB: todo escudo es un PNG pixel art de 48x48. La app valida
--     además la firma y las dimensiones (`validarEscudo`). Las políticas del
--     bucket ya eran solo para el Admin con 2FA y alcanzan para los escudos
--     de Club (rutas `clubes/<club>/<uuid>.png`).

grant update (escudo_path) on public.club to authenticated;

create policy "club: el Admin cambia el escudo"
  on public.club for update
  to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

update storage.buckets
   set file_size_limit = 65536,
       allowed_mime_types = array['image/png']
 where id = 'escudos';

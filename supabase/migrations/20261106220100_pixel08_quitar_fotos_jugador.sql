-- Diseño pixel art, ticket 08: quitar las fotos de Jugador.
-- (.scratch/diseno-pixel-art/issues/08-quitar-fotos-jugador.md)
--
-- La app ya no muestra ni carga fotos: se borran la columna `jugador.foto_path`,
-- las políticas del bucket `jugadores` y el bucket con sus archivos.
--
-- Storage no deja borrar sus tablas por SQL salvo con
-- `storage.allow_delete_query` (solo para esta transacción). Esto borra los
-- registros de los archivos; en un proyecto con archivos reales conviene
-- vaciar antes el bucket con la API de Storage (o el panel) para que no queden
-- archivos huérfanos en el almacenamiento.

drop policy if exists "jugadores (storage): el Admin lee" on storage.objects;
drop policy if exists "jugadores (storage): el Admin sube" on storage.objects;
drop policy if exists "jugadores (storage): el Admin reemplaza" on storage.objects;
drop policy if exists "jugadores (storage): el Admin borra" on storage.objects;

select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'jugadores';
delete from storage.buckets where id = 'jugadores';

alter table public.jugador drop column foto_path;

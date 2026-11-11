-- =============================================================================
-- Selección, ticket 17: escudos de la Selección (AUF) y de Argentina cargados
-- sin pasar por el backoffice. Los PNG pixel art (48x48) se sirven como
-- archivos estáticos de la app (public/escudos/), y `escudo_path` los apunta
-- con una ruta que empieza con "/" (ver `urlEscudo` en src/lib/imagenes/subida.ts).
-- Si después el Admin sube otro desde el backoffice, reemplaza a este como
-- cualquier escudo (al estático no hay que borrarlo del bucket).
-- =============================================================================

update public.club set escudo_path = '/escudos/seleccion.png' where id = 'seleccion';

update public.rival set escudo_path = '/escudos/argentina.png' where nombre = 'Argentina';

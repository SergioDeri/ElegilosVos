# 08: Quitar las fotos de Jugador

**What to build:** El Admin deja de cargar fotos de Jugadores: el formulario de Jugador pide solo nombre, número, posición natural y Disponibilidad. Una migración nueva borra la columna de foto del Jugador, sus políticas y el bucket de fotos con los archivos que tenga. Se sacan la subida y las lecturas de fotos. La utilidad de subida de imágenes queda solo para escudos.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] El formulario de alta y edición de Jugador ya no tiene campo de foto
- [x] Una migración nueva (sin tocar las existentes) borra la columna, las políticas y el bucket de fotos con sus archivos
- [x] Los tipos de la base se regeneran y no queda ninguna referencia a la foto del Jugador
- [x] Tests de RLS en un archivo nuevo: el bucket de fotos ya no existe y la tabla de Jugadores no tiene columna de foto
- [x] Se ajustan los tests de RLS que dependían de la foto
- [x] `npm run typecheck && npm run lint && npm test && npm run test:rls` pasan

## Comments

- Migración `20261106220100_pixel08_quitar_fotos_jugador.sql`: borra las 4 políticas `jugadores (storage): ...`, los objetos y el bucket `jugadores` (con `storage.allow_delete_query` solo en esa transacción, porque Storage bloquea el borrado por SQL), y la columna `jugador.foto_path`. El nombre lo generó `npm run db:new`, pero se cambió el timestamp: el reloj daba uno anterior a las migraciones existentes (20261106210201) y habría corrido antes de que existiera el bucket.
- **Ojo al desplegar:** borrar las filas de `storage.objects` por SQL no borra los archivos del almacenamiento. Si en producción hay fotos cargadas, conviene vaciar el bucket `jugadores` desde el panel o la API de Storage antes de aplicar la migración.
- App: sin campo de foto en el alta, sin formulario ni lectura de foto en la ficha del Jugador, sin las acciones `cambiarFoto` y `quitarFoto`. La subida de imágenes (`src/lib/imagenes/subida.ts`) queda solo para escudos. `validarFoto` sigue validando el escudo del Rival hasta el ticket 07.
- Tests de RLS: `tests/rls/pixel-08-quitar-fotos.test.ts` (no hay columna ni bucket, nadie sube). Se quitaron los de Storage de fotos de `07-backoffice.test.ts` y el bucket `jugadores` de `17-seguridad.test.ts`. El archivo nuevo no usa el número 08 solo, porque ya lo usa el ticket 08 del MVP.
- README actualizado. Tipos regenerados con `npm run db:types`.

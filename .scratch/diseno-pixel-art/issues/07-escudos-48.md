# 07: Escudos pixel 48x48: validación, sección Clubes y hueco "falta escudo"

**What to build:** Todo escudo, de Club o de Rival, tiene que ser un PNG pixel art de exactamente 48x48. El backoffice rechaza cualquier otro archivo con un mensaje claro. Se suma una sección "Clubes" donde el Admin sube o reemplaza el escudo de Peñarol y el de Nacional, guardado en el bucket público de escudos y en la columna de escudo del Club, que ya existe. Los escudos se muestran sin suavizado, más grandes que las Camisetas. Donde falta uno aparece un hueco pixelado de 48x48 de "falta escudo": en la tarjeta del Partido y en el backoffice.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Hay una validación de dominio, al lado de la validación de imágenes que ya existe: el archivo tiene que ser PNG por su firma y declarar 48x48 en su cabecera. Devuelve los motivos `vacia`, `tamano`, `formato` y `dimensiones`, y cada uno tiene tests
- [x] La subida de escudo de los Rivales usa la validación nueva
- [x] La sección "Clubes" del backoffice permite subir y reemplazar el escudo de cada Club, y borra el escudo anterior al reemplazarlo
- [x] Una migración nueva (sin tocar las existentes) permite que solo el Admin actualice el escudo del Club y suba o reemplace archivos en el bucket de escudos, siguiendo las convenciones de RLS
- [x] Tests de RLS en un archivo nuevo: el Admin puede; un Hincha y un anónimo no pueden; cualquiera puede leer el escudo
- [x] El hueco "falta escudo" aparece cuando no hay escudo, para Clubes y para Rivales
- [x] Los escudos se ven nítidos (`image-rendering: pixelated`) y en múltiplos enteros de `--px`
- [x] `npm run typecheck && npm run lint && npm test && npm run test:rls` pasan

## Comments

- **Validación** (`@/domain/planteles`): `validarEscudo({ tamano, cabecera })` reemplaza a `validarFoto`, que quedó sin uso al quitarse las fotos en el ticket 08 y además aceptaba JPEG y WebP. Exige la firma PNG, que el primer chunk sea IHDR y que declare 48x48, con un tamaño máximo de 64 KB (`TAMANO_MAXIMO_ESCUDO`). Motivos: `vacia`, `tamano`, `formato` (también si el PNG viene cortado o sin IHDR al principio) y `dimensiones`. Hay tests de cada uno.
- **Subida** (`@/lib/imagenes/subida`): `leerEscudo` y `subirEscudo` (bucket `escudos`, `<carpeta>/<uuid>.png`; borra el anterior solo si la asignación salió bien) y `MENSAJE_ESCUDO` con un mensaje por motivo. La usan el Rival y el Club. El campo de archivo (`CampoEscudo`) es el mismo en los dos y pide `image/png`.
- **Migración** `20261106220200_pixel07_escudos_48.sql`: `grant update (escudo_path) on club` y la política `"club: el Admin cambia el escudo"` (`es_admin()`). El bucket `escudos` pasa a aceptar solo `image/png` de hasta 64 KB. Las políticas del bucket ya eran solo para el Admin con 2FA y no hizo falta ampliarlas. El timestamp se eligió a mano para que corra después de las migraciones existentes (ver el ticket 08).
- **RLS**: `tests/rls/pixel-07-escudos.test.ts`. Un anónimo, un Hincha y un Admin sin 2FA leen el escudo, pero no lo cambian ni suben, reemplazan o borran archivos. El Admin con 2FA sube, asigna, reemplaza y borra el anterior, pero no puede cambiar otra columna del Club. El bucket rechaza archivos que no son PNG y los de más de 64 KB. Se actualizó `17-seguridad.test.ts` (bucket y privilegio por columna).
- **Hueco "falta escudo"**: `faltaEscudo()` en el módulo nuevo `@/domain/escudos` es una silueta de escudo de 48x48 con contorno, borde interior en sombra, fondo gris y un signo de pregunta, con tests. `Escudo` (`src/app/_pixel/escudo.tsx`) muestra el PNG a 48 × `--u` con `image-rendering: pixelated`, o el hueco si no hay. Se usa en la tarjeta del Partido (Rival), en la lista y la ficha de Rivales y en `/admin/clubes`.
- **Sección Clubes**: `/admin/clubes` muestra el escudo de cada Club y un formulario para subirlo o reemplazarlo (`cambiarEscudoDelClub`). El enlace está en el inicio del backoffice.
- **Pendiente:** la tarjeta del Partido del Hincha muestra el escudo del Rival pero no el del propio Club; sumarlo es parte de rediseñar la tarjeta (ticket 05). La clase `.escudo` de `alineacion.module.css` quedó sin uso; no se borró para no chocar con el ticket 05, que edita ese archivo.
- **Verificado a ojo** (al hacer el ticket 06), en `/admin/clubes`: el hueco "falta escudo" en los dos Clubes; un PNG de 64x64 se rechaza con "El escudo tiene que medir exactamente 48x48 píxeles."; uno de 48x48 se guarda y se ve nítido, y al reemplazarlo queda un solo archivo en `clubes/penarol/`.

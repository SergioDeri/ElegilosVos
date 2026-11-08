# 06: Backoffice liviano

**What to build:** El backoffice del Admin usa la misma paleta, la fuente y los bordes pixelados que la app, pero sin sprites, Camisetas ni efectos. Las tablas y los formularios siguen siendo densos, para cargar datos rápido.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 01

**Status:** resolved

- [x] Todas las pantallas del backoffice usan la paleta, la fuente y los bordes pixel
- [x] No hay sprites ni animaciones en el backoffice
- [x] Las tablas y los formularios siguen igual de densos y usables (revisado a ojo)
- [x] `npm run typecheck && npm run lint && npm test` pasan

## Comments

- **Cómo**: el layout de `/admin` envuelve todo en `.backoffice` (`src/app/admin/backoffice.module.css`) y usa la barra `barra-app` de `pixel.css` con el tema neutro (verde cancha: el backoffice no es de un Club). La paleta, las fuentes bitmap, los paneles y los botones ya venían de `pixel.css` (ticket 01). El módulo solo los hace densos: `main` ocupa todo el ancho (hasta 480 píxeles de arte, en pasos de `--u`), formularios con menos aire, tablas compactas con líneas de 1 píxel de arte, `fieldset` y `details` pixelados, y el botón del campo de archivo como los demás. Todo con colores de la paleta y medidas en `--u`.
- **Sin sprites ni efectos**, salvo el hueco "falta escudo" y los escudos, que pide el ticket 07 en el backoffice. Las vistas de hover de las tablas son solo un cambio de fondo, sin animación.
- **Verificado a ojo** a 1470x683 (`--px` 3) con un Admin de prueba con 2FA: inicio, Plantel (tabla), alta de Jugador (formulario), Clubes (subir un 64x64 lo rechaza con el mensaje de dimensiones, un 48x48 se guarda y se ve nítido, y al reemplazarlo queda un solo archivo en el bucket) y Votaciones. No se revisó en el celu: el backoffice se usa en desktop.
- **Ojo, ticket 04:** `/admin/votaciones` muestra el Parcial con `VistaParcial` (`src/app/_parcial`). Si el ticket 04 le pone Camisetas y la cancha pixel a ese componente, el backoffice va a mostrar sprites. Hay que darle a `VistaParcial` una variante sin sprites (o una tabla) para el backoffice.
- **Bug encontrado, fuera de este ticket:** en desarrollo, el primer enrolamiento de 2FA en `/admin/2fa` muestra "Algo salió mal". Con React StrictMode el `useEffect` de `DosFactores` corre dos veces, y los dos `mfa.enroll` con el mismo `friendlyName` chocan. Con el factor ya enrolado la verificación funciona. En producción no debería pasar (el efecto corre una vez), pero conviene hacer el enrolamiento idempotente.

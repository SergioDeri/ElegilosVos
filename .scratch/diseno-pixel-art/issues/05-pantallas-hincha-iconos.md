# 05: Resto de las pantallas del Hincha e íconos 8x8

**What to build:** Las pantallas del Hincha que no tienen cancha pasan al estilo pixel: el inicio (tarjeta del Partido y cuenta regresiva), la cuenta, los avisos y los estados vacíos. Se suman íconos de 8x8 dibujados como matrices de la paleta (guardado, cierre de la Votación, compartir, menú), alineados con el texto de cuerpo.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 01

**Status:** resolved

- [x] Los íconos de 8x8 salen de la paleta y se ven nítidos a cualquier `--px`
- [x] El inicio, la cuenta, los avisos y los estados vacíos usan fuentes, paneles y acentos pixel
- [x] La cuenta regresiva de la Votación usa la fuente pixel
- [x] No quedan en la parte del Hincha estilos que rompan la grilla (bordes redondeados, sombras difusas, degradados)
- [x] `npm run typecheck && npm run lint && npm test` pasan

## Comments

**Implementación.**

- Íconos: `icono(nombre, color)` en `@/domain/pixel` devuelve la matriz 8x8 de `guardado` (tilde), `cierre` (candado), `compartir` (flecha que sale de una caja) y `menu` (tres barras). Tests en `iconos.test.ts`: tamaño, solo paleta, fondo transparente, distintos entre sí y snapshot.
- `Icono` (`src/app/_pixel/icono.tsx`) los dibuja con `Sprite` y los pinta con `currentColor`, que siempre es un color de la paleta, así toman el color del texto o del botón (el acento del Club). Van apoyados en la línea base del cuerpo, 1 píxel de arte por debajo, con 2 de separación.
- Dónde: menú en "Mi cuenta" de la barra, guardado en el indicador de guardado, candado en el cierre de la Votación (abierta y cerrada) y compartir en el botón Compartir.
- Inicio: la tarjeta del Partido es un panel con borde del acento (`inicio.module.css`). La cuenta regresiva usa Press Start 2P a 8 × `--px`.
- Cuenta: secciones separadas por una línea de 1 píxel y datos en dos columnas (`cuenta.module.css`).
- Avisos y estados vacíos: ya usaban los paneles de `role="alert"` / `role="status"` del 01. Se sumaron listas con viñeta cuadrada en `pixel.css`, que usa el aviso de no disponibles.

**Verificado a ojo** con un Hincha de cada Club (celu no; desktop 1568x734): inicio, íconos, cuenta regresiva y cuenta.

**Fuera de este ticket:** quedan estilos fuera de la grilla en la cancha, el Parcial y los resultados (03 y 04) y en el escudo del Rival (`.escudo`, 07).

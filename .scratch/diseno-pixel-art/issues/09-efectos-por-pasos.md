# 09: Efectos por pasos

**What to build:** La app suma movimiento retro, siempre por pasos (nunca interpolado):
- transiciones por bloques o fundido por pasos entre pantallas;
- al soltar una Camiseta en un Puesto, salta y suelta partículas de píxeles cuadrados;
- en la cancha, los Jugadores se balancean con 2 frames a unos 4 FPS;
- al ver el 11 Elegido o la Coincidencia, caen papelitos pixelados.

Con `prefers-reduced-motion: reduce` todo se apaga y el resultado de cada acción se ve al instante.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 03, 04

**Status:** resolved

- [x] Las transiciones entre pantallas van por bloques o por pasos
- [x] Soltar una Camiseta en un Puesto dispara el salto y las partículas cuadradas, alineados a la grilla
- [x] Los Jugadores de la cancha se balancean con 2 frames, desfasados entre sí
- [x] Ver el 11 Elegido o la Coincidencia dispara los papelitos pixelados
- [x] Todas las animaciones usan `steps()` o cambios por frames, sin interpolar
- [x] Con reducir movimiento no corre ninguna animación y la información se ve igual
- [x] `npm run typecheck && npm run lint && npm test` pasan

## Comments

**Implementación.** Todo está en `src/app/_pixel/efectos.module.css`. Las animaciones solo existen dentro de `@media (prefers-reduced-motion: no-preference)`; afuera, cada cosa se ve en su lugar final. Todas van por pasos (`steps()` o `step-end` entre fotogramas) y se mueven en múltiplos de `--u`.

- **Transición entre pantallas.** Barrido por bloques de izquierda a derecha, con `clip-path` en 6 pasos y 240 ms. Va en `src/app/(app)/template.tsx` (se vuelve a montar en cada navegación) y en el link público. Usa solo `backwards`, para que no quede un `clip-path` que recorte lo que es `fixed` (el arrastre, los papelitos). El backoffice y el login no la tienen.
- **Salto y partículas.** Al soltar una Camiseta en un Puesto (arrastrando o tocando), si la operación cambió la Alineación, ese Puesto se vuelve a montar con `key`. La Camiseta salta de 4 píxeles en 5 fotogramas, y 8 partículas de 2x2 salen en 4 pasos hacia destinos múltiplos de 4 (todas en píxeles enteros).
- **Balanceo.** 2 fotogramas a 4 FPS (500 ms el ciclo); la mitad de los Puestos va desfasada según el orden del catálogo. Hay balanceo en el armado, en el Parcial y en el 11 Elegido, pero no en el banco ni en lo que se arrastra.
- **Papelitos.** 36 cuadrados de 2x2 con el acento, el detalle y la cal, que caen una vez en 16 pasos enteros. Las posiciones son deterministas. Salen en la pantalla del 11 Elegido (que muestra también la Coincidencia) y en el link público.

**Verificado** con Chrome sin ventana (por CDP):
- Después de soltar están corriendo `salto`, `particula` y `balanceo`. Al abrir el 11 Elegido, `papelito`.
- Con `prefers-reduced-motion: reduce` emulado, `document.getAnimations()` da 0 en el armado y en el 11 Elegido, y la pantalla muestra lo mismo.
- Se capturaron pantallas a mitad del salto y de los papelitos.

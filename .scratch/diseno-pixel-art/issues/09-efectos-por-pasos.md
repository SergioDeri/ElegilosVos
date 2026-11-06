# 09: Efectos por pasos

**What to build:** La app suma movimiento retro, siempre por pasos (nunca interpolado):
- transiciones por bloques o fundido por pasos entre pantallas;
- al soltar una Camiseta en un Puesto, salta y suelta partículas de píxeles cuadrados;
- en la cancha, los Jugadores se balancean con 2 frames a unos 4 FPS;
- al ver el 11 Elegido o la Coincidencia, caen papelitos pixelados.

Con `prefers-reduced-motion: reduce` todo se apaga y el resultado de cada acción se ve al instante.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] Las transiciones entre pantallas van por bloques o por pasos
- [ ] Soltar una Camiseta en un Puesto dispara el salto y las partículas cuadradas, alineados a la grilla
- [ ] Los Jugadores de la cancha se balancean con 2 frames, desfasados entre sí
- [ ] Ver el 11 Elegido o la Coincidencia dispara los papelitos pixelados
- [ ] Todas las animaciones usan `steps()` o cambios por frames, sin interpolar
- [ ] Con reducir movimiento no corre ninguna animación y la información se ve igual
- [ ] `npm run typecheck && npm run lint && npm test` pasan

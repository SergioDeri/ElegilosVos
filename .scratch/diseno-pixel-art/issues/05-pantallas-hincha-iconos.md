# 05: Resto de las pantallas del Hincha e íconos 8x8

**What to build:** Las pantallas del Hincha que no tienen cancha pasan al estilo pixel: el inicio (tarjeta del Partido y cuenta regresiva), la cuenta, los avisos y los estados vacíos. Se suman íconos de 8x8 dibujados como matrices de la paleta (guardado, cierre de la Votación, compartir, menú), alineados con el texto de cuerpo.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Los íconos de 8x8 salen de la paleta y se ven nítidos a cualquier `--px`
- [ ] El inicio, la cuenta, los avisos y los estados vacíos usan fuentes, paneles y acentos pixel
- [ ] La cuenta regresiva de la Votación usa la fuente pixel
- [ ] No quedan en la parte del Hincha estilos que rompan la grilla (bordes redondeados, sombras difusas, degradados)
- [ ] `npm run typecheck && npm run lint && npm test` pasan

# 06: Backoffice liviano

**What to build:** El backoffice del Admin usa la misma paleta, la fuente y los bordes pixelados que la app, pero sin sprites, Camisetas ni efectos. Las tablas y los formularios siguen siendo densos, para cargar datos rápido.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Todas las pantallas del backoffice usan la paleta, la fuente y los bordes pixel
- [ ] No hay sprites ni animaciones en el backoffice
- [ ] Las tablas y los formularios siguen igual de densos y usables (revisado a ojo)
- [ ] `npm run typecheck && npm run lint && npm test` pasan

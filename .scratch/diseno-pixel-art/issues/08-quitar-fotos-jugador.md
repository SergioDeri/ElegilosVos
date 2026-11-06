# 08: Quitar las fotos de Jugador

**What to build:** El Admin deja de cargar fotos de Jugadores: el formulario de Jugador pide solo nombre, número, posición natural y Disponibilidad. Una migración nueva borra la columna de foto del Jugador, sus políticas y el bucket de fotos con los archivos que tenga. Se sacan la subida y las lecturas de fotos. La utilidad de subida de imágenes queda solo para escudos.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] El formulario de alta y edición de Jugador ya no tiene campo de foto
- [ ] Una migración nueva (sin tocar las existentes) borra la columna, las políticas y el bucket de fotos con sus archivos
- [ ] Los tipos de la base se regeneran y no queda ninguna referencia a la foto del Jugador
- [ ] Tests de RLS en un archivo nuevo: el bucket de fotos ya no existe y la tabla de Jugadores no tiene columna de foto
- [ ] Se ajustan los tests de RLS que dependían de la foto
- [ ] `npm run typecheck && npm run lint && npm test && npm run test:rls` pasan

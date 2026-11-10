# 14: Notificaciones: Convocatoria y Gran Ausente final

**What to build:** Dos avisos nuevos para la Selección: cuando el Admin carga la Convocatoria (con el Gran Ausente provisorio) y cuando hay Gran Ausente final (con el 11 Elegido), que sale al cierre si ya había Convocatoria o cuando el Admin la carga si la Votación ya cerró. Van a los Hinchas con "Selección" prendido, sin duplicarse.

**Blocked by:** 10, 13

**Status:** resolved

- [x] Tipos nuevos de notificación: Convocatoria cargada y Gran Ausente final
- [x] El Gran Ausente final se avisa al cierre o al cargar la Convocatoria tarde, una sola vez
- [x] Con tests de dominio siguiendo los de Notificaciones existentes
- [x] Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls` && npm run test:e2e

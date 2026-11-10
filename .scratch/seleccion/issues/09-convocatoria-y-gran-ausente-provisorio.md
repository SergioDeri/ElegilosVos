# 09: Convocatoria y Gran Ausente provisorio

**What to build:** El Admin carga una Convocatoria eligiendo elegibles del Plantel de la Selección y marca a qué Partidos de la Selección se aplica (cada Partido tiene a lo sumo una). Puede corregirla mientras la Votación de sus Partidos sigue abierta. Solo la escribe un Admin con 2FA; la lee cualquier usuario con sesión. Cargarla no cambia lo que se puede votar: en el armado se marca quién está convocado, y el Parcial pasa del Más Pedido al Gran Ausente provisorio (el que figura en más Alineaciones sin estar convocado, con empates; nada si ningún no convocado aparece).

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Pantalla de Convocatoria en el backoffice: elegibles y Partidos a los que se aplica
- [ ] El armado marca a los convocados; los no convocados se siguen pudiendo elegir
- [ ] El Parcial muestra el Gran Ausente provisorio cuando hay Convocatoria
- [ ] Destacados: Gran Ausente con Convocatoria, empates, ningún no convocado elegido, con tests
- [ ] Tests de RLS: la Convocatoria se lee con sesión y solo la escribe un Admin con 2FA; un Partido no queda en dos Convocatorias
- [ ] Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls` && npm run test:e2e

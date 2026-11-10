# 07: Herencia en la Selección

**What to build:** Al abrir una Votación de la Selección, cada Hincha arranca con algo. Si el Partido anterior de la Selección sigue con la Votación abierta (fecha doble), se copia la Alineación que tiene en ese momento para ese Partido; si ya cerró, se hereda como en los Clubes. En los dos casos sin los Jugadores no disponibles o fuera del Plantel. Después cada Alineación sigue por su lado. El módulo de Herencia deja de suponer que el Partido anterior está cerrado, y el cron de herencia procesa la Selección.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Herencia: copia desde una Votación abierta y herencia desde una cerrada, sin no disponibles, con tests de dominio
- [ ] El cron de herencia procesa la Selección sin duplicar Alineaciones si corre dos veces
- [ ] Cambiar la Alineación copiada no toca la del Partido anterior
- [ ] Tests de RLS / integración siguiendo los de herencia existentes
- [ ] Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls` && npm run test:e2e

# 10: Cierre de la Selección: 11 Elegido y Gran Ausente final

**What to build:** Al cierre de una Votación de la Selección se calcula y congela el 11 Elegido como en los Clubes (ADR-0001), junto con las apariciones de cada Jugador. El Gran Ausente final no se guarda: se deriva de esas apariciones y la Convocatoria. Si la Votación cerró sin Convocatoria, el Gran Ausente aparece cuando el Admin la carga. Una vez que hay Gran Ausente final (Votación cerrada y Convocatoria cargada), la Convocatoria de ese Partido ya no se puede editar. El Hincha ve el 11 Elegido y el Gran Ausente final destacados en los resultados de la Selección.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] El cron de cierre procesa la Selección, incluidas dos Votaciones que cierran cerca
- [ ] Las apariciones quedan congeladas con el resultado inmutable
- [ ] Resultados de la Selección: 11 Elegido y Gran Ausente final
- [ ] Convocatoria cargada después del cierre → aparece el Gran Ausente sin modificar el resultado
- [ ] Tests de RLS: la Convocatoria no se edita después de publicado el Gran Ausente final; el resultado sigue inmutable
- [ ] Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls` && npm run test:e2e

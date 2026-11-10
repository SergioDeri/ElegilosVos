# 08: Parcial de la Selección con el Más Pedido

**What to build:** El Hincha ve el Parcial de la Selección: el 11 que va ganando y los porcentajes por Esquema y por Puesto, con los votos de todos (sin separar por hinchada). Además ve al Más Pedido: el Jugador que figura en más Alineaciones (en cualquier Puesto), con cuántas lo incluyen y su porcentaje sobre las Alineaciones con al menos un Jugador; si hay empate, todos los empatados. Lo calcula un módulo de dominio nuevo (destacados) a partir de las apariciones, con las mismas Alineaciones que el Conteo, incluidas las heredadas (ADR-0002). Ese módulo ya acepta una Convocatoria opcional, aunque todavía no haya forma de cargarla.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Módulo de destacados con tests: Más Pedido, empates, sin Alineaciones, Alineaciones vacías
- [ ] El Parcial de la Selección muestra el 11 que va ganando y el Más Pedido con su porcentaje
- [ ] El Parcial respeta la privacidad como el de los Clubes (solo totales)
- [ ] Tests de RLS siguiendo los del Parcial existentes
- [ ] Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls` && npm run test:e2e

# 03: Calendario de Votación

**What to build:** Módulo de lógica pura, desarrollado con TDD, que a partir de los Partidos de un Club y la hora actual determina el estado de cada Votación (pendiente, abierta, cerrada, anulada) y sus horas de apertura y cierre. Reglas:
- El cierre es el inicio menos 1 hora.
- Un Partido se considera terminado en el inicio más 2 horas.
- La Votación abre cuando termina el Partido anterior no cancelado del mismo Club, o cuando se carga si no hay uno anterior.
- Hay a lo sumo una Votación abierta por Club.
- Un Partido cancelado anula su Votación.
- Si se posterga un Partido, se recalculan las horas.

**Blocked by:** 01

**Status:** resolved

- [ ] Un Club sin Partidos no tiene Votación abierta
- [ ] Con Partidos consecutivos, la Votación del segundo abre exactamente en el inicio del primero más 2 horas
- [ ] La Votación cierra exactamente en el inicio menos 1 hora (con tests de borde al segundo)
- [ ] Nunca hay más de una Votación abierta por Club, aunque haya varios Partidos cargados por adelantado
- [ ] Un Partido cancelado queda anulado y la Votación del siguiente abre según la regla
- [ ] Una postergación mueve el cierre y no cambia qué Votación está abierta, salvo que corresponda por las reglas
- [ ] Los cálculos son correctos en America/Montevideo

# 08: Backoffice: Rivales y Partidos

**What to build:** El Admin gestiona el catálogo de Rivales (nombre, escudo subido a Storage, alta, edición y baja) y los Partidos: elige Club, Rival, fecha y hora (cargadas en hora de Montevideo), y puede postergar o cancelar un Partido. El Clásico se carga como un Partido para cada Club, con el otro Club como Rival en el catálogo. Cada Partido muestra el estado de su Votación según el Calendario de Votación (pendiente, abierta, cerrada, anulada) y sus horas de apertura y cierre.

**Blocked by:** 07, 03

**Status:** ready-for-agent

- [ ] Alta, edición y baja de Rivales con escudo; un Rival dado de baja no se ofrece para Partidos nuevos
- [ ] Alta de Partido con Club, Rival e inicio en hora de Montevideo, guardado en UTC
- [ ] Postergar un Partido recalcula su cierre y no toca las Alineaciones
- [ ] Cancelar un Partido anula su Votación
- [ ] La lista de Partidos muestra el estado de la Votación y sus horas, tomados del Calendario
- [ ] El Clásico se puede cargar como dos Partidos
- [ ] Tests de RLS: un Hincha no puede escribir Rivales, Partidos ni escudos

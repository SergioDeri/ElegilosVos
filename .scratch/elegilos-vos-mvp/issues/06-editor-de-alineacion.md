# 06: Editor de Alineación

**What to build:** Módulo de lógica pura, desarrollado con TDD, que modela el estado de una Alineación y sus operaciones. Estado: el Esquema, un mapa de Puesto a Jugador o vacío, una marca de Esquema elegido a mano y la hora de modificación de cada Puesto. Operaciones:
- Colocar desde el Plantel: si el Puesto está ocupado, el anterior vuelve al Plantel.
- Mover entre Puestos: si el destino está ocupado, se intercambian.
- Quitar un Jugador.
- Cambiar de Esquema: se reubica por la Tabla de Equivalencias y, si hay colisión, uno vuelve al Plantel.
- Heredar una Alineación filtrando los Jugadores no Disponibles o fuera del Plantel.

Una operación que viola una invariante se rechaza y el estado no cambia. También expone la serialización y deserialización que usará la persistencia.

**Blocked by:** 02

**Status:** resolved

- [ ] Colocar, mover, intercambiar, reemplazar desde el Plantel y quitar se comportan como se describe
- [ ] Un Jugador nunca queda en dos Puestos
- [ ] Un arquero solo entra en el Puesto de arquero y el Puesto de arquero solo acepta arqueros; si no se cumple, se rechaza sin cambios
- [ ] El cambio de Esquema reubica por equivalencias y resuelve las colisiones devolviendo un Jugador al Plantel
- [ ] Cambiar de Esquema marca el Esquema como elegido a mano
- [ ] Cada cambio actualiza la hora de modificación solo de los Puestos afectados
- [ ] La herencia filtra los no Disponibles y los que salieron del Plantel
- [ ] Serializar y deserializar una Alineación devuelve la misma Alineación

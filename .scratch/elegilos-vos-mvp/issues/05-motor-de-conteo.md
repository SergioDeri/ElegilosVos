# 05: Motor de Conteo

**What to build:** Módulo de lógica pura, desarrollado con TDD, que recibe las Alineaciones de una Votación, la Disponibilidad y la pertenencia al Plantel de cada Jugador, el Catálogo de Esquemas y la Tabla de Equivalencias, y devuelve el resultado: porcentajes por Esquema, votos por Puesto y por candidato, y el 11 asignado. Lo usan tanto el Parcial como el 11 Elegido. El algoritmo sigue ADR-0001:
1. Las Alineaciones sin Jugadores y sin Esquema elegido a mano no cuentan.
2. Se elige el Esquema más votado.
3. Todos los votos se mapean a los Puestos del Esquema ganador, descartando los Jugadores no Disponibles o fuera del Plantel.
4. Una asignación óptima (algoritmo húngaro) elige 11 Jugadores distintos, respetando la regla del arquero.
5. Las vacantes se completan con los Disponibles que más votos tengan en otros Puestos y, como último recurso, con cualquier Disponible de la posición adecuada.
6. Desempate por la menor hora de modificación de los Puestos y, si sigue el empate, por un orden fijo.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Gana el Esquema con más votos, y las Alineaciones vacías no suman
- [ ] Una Alineación de otro Esquema aporta votos a los Puestos equivalentes del Esquema ganador
- [ ] Si un Jugador es el más votado en dos Puestos, la asignación maximiza el total y el 11 queda con Jugadores distintos
- [ ] Los votos a Jugadores no Disponibles o fuera del Plantel se descartan
- [ ] Un Puesto sin votos válidos se completa según la regla de vacantes
- [ ] Los empates de Esquema y de asignación se resuelven por hora y después por orden fijo
- [ ] Con la misma entrada, siempre da la misma salida (incluso si cambia el orden de las Alineaciones)
- [ ] Con cero Alineaciones que cuentan, devuelve un resultado vacío explícito
- [ ] El rendimiento es aceptable con 50.000 Alineaciones (tiene un test de humo)

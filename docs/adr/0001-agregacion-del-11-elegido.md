# Agregación del 11 Elegido: Tabla de Equivalencias + asignación óptima

El 11 Elegido se calcula en dos pasos. Primero se elige el Esquema más votado (solo cuentan las Alineaciones con al menos un Jugador colocado o con un Esquema elegido a mano). Después, **todas** las Alineaciones aportan votos a los Puestos de ese Esquema, traducidos con una Tabla de Equivalencias escrita a mano en el código. Al final, una asignación óptima (algoritmo húngaro) elige 11 Jugadores distintos que maximizan el total de votos. Los votos a Jugadores no disponibles al cierre se descartan, y los Puestos sin votos válidos se completan con los Disponibles que más votos tengan en otros Puestos.

Contar solo las Alineaciones del Esquema ganador era más simple, pero descartaba una parte grande de la opinión de la hinchada. Mapear por cercanía en la cancha era automático, pero impredecible. El greedy se descartó porque con un Jugador ganador en dos Puestos da resultados menos justos.

## Consequences

- Los empates (de Esquema o de asignación) se desempatan por la hora de la última modificación de cada Puesto: gana la opción cuyos votos se consolidaron antes. El cálculo tiene que ser determinístico y reproducible.
- Agregar un Esquema obliga a completar su fila y su columna en la Tabla de Equivalencias.

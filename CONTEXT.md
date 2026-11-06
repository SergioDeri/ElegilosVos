# Elegilos Vos

Los hinchas de Peñarol y Nacional arman la alineación titular de su club para cada partido. Al cierre, las alineaciones de todos se agregan en un 11 elegido por la hinchada.

## Language

### Clubes y partidos

**Club**:
Uno de los dos equipos de la app: Peñarol o Nacional. Tiene escudo y dos Camisetas.
_Avoid_: Equipo (ambiguo con el 11 votado)

**Rival**:
Oponente de un Club en un Partido, tomado de un catálogo reutilizable (nombre y escudo). No tiene plantel en la app. En el Clásico, el otro Club figura como Rival.

**Partido**:
Encuentro programado de un Club contra un Rival, con fecha y hora de inicio. El Clásico son dos Partidos, uno por Club. Se considera terminado 2 horas después de su inicio.
_Avoid_: Fecha, semana

**Plantel**:
Conjunto de Jugadores que pertenecen hoy a un Club. Un Jugador que se va del Club sale del Plantel, pero se conserva en el historial.

**Jugador**:
Integrante del Plantel de un Club. Tiene nombre, número y posición natural (ARQ/DEF/MED/DEL).

**Camiseta**:
Vestimenta fija de un Club con la que se muestra a sus Jugadores. Cada Club tiene dos: la de campo y la de arquero; la de arquero la lleva el Jugador cuya posición natural es ARQ. Los Rivales no tienen Camiseta.
_Avoid_: Remera, equipación, kit

**Disponibilidad**:
Estado actual de un Jugador: Disponible, Lesionado, Suspendido o No disponible. Solo un Jugador Disponible puede elegirse y contar en la Votación.

### Votación

**Votación**:
Período en el que los Hinchas de un Club arman su Alineación para un Partido. Abre cuando termina el Partido anterior del Club y cierra 1 hora antes del inicio. Si el Partido cambia de horario, el cierre se mueve con él; si se cancela, la Votación se anula.
_Avoid_: Encuesta, semana

**Esquema**:
Formación táctica predefinida (4-3-3, 4-4-2, …) compuesta por 11 Puestos.
_Avoid_: Formación (ambiguo con Alineación), sistema

**Puesto**:
Lugar fijo dentro de un Esquema (por ejemplo, "DC izq." en el 4-4-2). El Puesto de arquero solo admite arqueros, y los arqueros solo van al arco.
_Avoid_: Posición (reservado a la posición natural del Jugador)

**Tabla de Equivalencias**:
Correspondencia fija que asocia cada Puesto de cada Esquema con un Puesto de cada otro Esquema.

**Alineación**:
Esquema más Jugadores ubicados en sus Puestos que tiene guardada un Hincha para una Votación. Puede estar incompleta. Se guarda sola, sin envío; la que existe al cierre es el voto del Hincha. Al abrir una Votación nueva se hereda la del Partido anterior, sin los Jugadores no disponibles.
_Avoid_: Voto (salvo para hablar del efecto en el conteo), formación

**Parcial**:
Resultado provisorio de la Votación abierta, con el 11 que va ganando y los porcentajes por Esquema y por Puesto.

**11 Elegido**:
Resultado inmutable de una Votación, calculado al cierre: el Esquema más votado y, en cada uno de sus Puestos, el Jugador asignado según los votos de todas las Alineaciones.
_Avoid_: Equipo de la semana, once ideal

**11 Real**:
Los 11 titulares que efectivamente puso el DT en el Partido, sin Esquema. Lo carga el Admin para compararlo con el 11 Elegido.

**Coincidencia**:
Cantidad de Jugadores en común entre dos onces (por ejemplo, la Alineación de un Hincha contra el 11 Elegido, o el 11 Elegido contra el 11 Real).

### Usuarios

**Hincha**:
Usuario registrado (con Google o con email verificado) que tiene un único Club Favorito y arma Alineaciones solo de ese Club. Su Alineación es privada; los demás solo ven totales.
_Avoid_: Usuario, votante

**Club Favorito**:
Club que el Hincha elige al registrarse. Es fijo; solo el Admin puede cambiarlo.

**Admin**:
Quien gestiona desde el backoffice los Partidos, los Rivales, los Planteles, la Disponibilidad y el 11 Real.

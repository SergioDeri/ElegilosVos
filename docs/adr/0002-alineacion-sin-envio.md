# La Alineación no se envía: lo guardado al cierre es el voto

No hay botón de enviar. La Alineación del Hincha se guarda sola en cada cambio y la que existe al cierre de la Votación es su voto. Al abrir la Votación siguiente se hereda la anterior (sin los no disponibles), así que un Hincha que no vuelve a entrar sigue votando. Se eligió así para bajar la fricción al mínimo, aceptando que el padrón incluya Hinchas inactivos.

## Consequences

- No existe un "momento del voto": los desempates usan la hora de la última modificación de cada Puesto (ver ADR-0001).
- El Parcial se calcula sobre las Alineaciones guardadas en ese momento, incluidas las heredadas.

# 09: Armar la Alineación (Hincha)

**What to build:** La pantalla principal del Hincha. Muestra el próximo Partido de su Club (Rival, escudo, fecha y hora) con la cuenta regresiva hasta el cierre. Tiene un selector de Esquema y una cancha con los Puestos donde el Hincha arrastra Jugadores Disponibles del Plantel (con arrastre táctil en el celular). La UI solo despacha operaciones del Editor de Alineación. Cada cambio se guarda solo (con debounce) y hay un indicador de "guardado". No hay botón de enviar (ADR-0002). Los Jugadores no Disponibles se ven con su motivo pero no se pueden elegir. Si no hay Votación abierta, se muestra el motivo y la edición queda bloqueada. La tabla de Alineaciones (una por Hincha y Partido) tiene políticas de acceso: solo su dueño lee y escribe, solo para su Club Favorito y solo con la Votación abierta (validado en la base de datos con la misma regla que el Calendario).

**Blocked by:** 03, 06, 04

**Status:** ready-for-agent

- [ ] El Hincha ve su próximo Partido y la cuenta regresiva al cierre
- [ ] Puede elegir Esquema y arrastrar, intercambiar, reemplazar y quitar Jugadores en el celular y en la compu
- [ ] Los cambios se guardan solos y persisten al recargar la página
- [ ] Puede dejar Puestos vacíos
- [ ] Los no Disponibles se muestran con su motivo y no se pueden elegir
- [ ] Sin Votación abierta, la cancha queda en solo lectura con un mensaje claro
- [ ] Tests de RLS: no se puede leer ni escribir la Alineación de otro Hincha; no se puede escribir para el otro Club; no se puede escribir con la Votación cerrada, pendiente o anulada

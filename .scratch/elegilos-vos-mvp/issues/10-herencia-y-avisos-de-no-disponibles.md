# 10: Herencia de Alineación y avisos de no disponibles

**What to build:** Cuando abre la Votación de un nuevo Partido, el Hincha arranca con su Alineación del Partido anterior, filtrada con la herencia del Editor (sin no Disponibles ni bajas). Esa Alineación heredada cuenta como voto aunque el Hincha no entre (ADR-0002), así que tiene que existir en la base de datos aunque el Hincha no abra la app: se materializa al abrir la Votación. Cuando un Jugador de la Alineación del Hincha deja de estar Disponible durante la Votación abierta, el Hincha ve un aviso en la app para reemplazarlo.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] Al abrir una Votación, cada Hincha con Alineación en el Partido anterior del Club tiene una Alineación heredada para el nuevo Partido
- [ ] La herencia excluye a los no Disponibles y a los que salieron del Plantel
- [ ] La materialización es idempotente: si corre dos veces no duplica ni pisa los cambios que ya hizo el Hincha
- [ ] Si un Jugador de tu Alineación pasa a no Disponible, ves un aviso con el motivo en la pantalla de armado
- [ ] Una Alineación heredada que el Hincha nunca tocó cuenta en el conteo

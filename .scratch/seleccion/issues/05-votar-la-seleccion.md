# 05: Votar la Selección

**What to build:** Un Hincha con Club usa el selector "mi club / Selección" de la barra y arma su Alineación de la Selección con los mismos Esquemas y la misma cancha, eligiendo entre los elegibles Disponibles. La cancha y los bancos muestran el nombre completo de cada Jugador, sin número y sin cortarlo (en dos líneas si hace falta), con las Camisetas de la Selección. La Alineación se guarda sola, es privada e independiente de la de su Club. La Votación de un Partido de la Selección abre 14 días antes del inicio (o al cargarse el Partido, si fue después) y cierra 1 hora antes; puede haber dos abiertas a la vez (ADR-0005), y entonces la pantalla deja elegir el Partido. El Calendario agrega la regla de la Selección y expone sus Votaciones abiertas en plural; la misma regla se replica en las funciones SQL de Votación abierta y de Votación de un Partido, y las políticas de Alineación dejan que cualquier usuario con perfil tenga Alineaciones de Partidos de la Selección. Los Clubes siguen igual.

**Blocked by:** 02, 03, 04

**Status:** ready-for-agent

- [ ] Calendario: apertura a 14 días, Partido cargado tarde, fecha doble con dos abiertas, postergación y cancelación, con tests; los Clubes siguen con una sola abierta
- [ ] Un Hincha de Peñarol y uno de Nacional arman y guardan su Alineación de la Selección; persiste al recargar
- [ ] Selector "mi club / Selección" en la barra
- [ ] Nombre completo sin número en la cancha y en los bancos; nombres largos no se cortan
- [ ] En fecha doble, el Hincha elige el Partido y arma los dos por separado
- [ ] Tests de RLS: Hinchas de los dos Clubes escriben Alineaciones de la Selección; nadie lee la de otro; no se escribe fuera de la ventana de 14 días ni con la Votación cerrada o anulada; dos abiertas a la vez aceptan Alineaciones
- [ ] E2E: fecha doble, el Hincha elige el Partido y arma los dos
- [ ] Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls` && npm run test:e2e

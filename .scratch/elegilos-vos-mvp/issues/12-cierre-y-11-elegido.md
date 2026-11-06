# 12: Cierre de Votación y 11 Elegido

**What to build:** Un proceso programado (cron) detecta las Votaciones vencidas, ejecuta el Motor de Conteo con la Disponibilidad del momento del cierre y persiste el 11 Elegido de forma inmutable (Esquema, Jugador por Puesto, detalle de votos y hora de cálculo). Es idempotente: si corre dos veces no cambia el resultado. Una Votación anulada no genera 11 Elegido. El Hincha ve el 11 Elegido del último Partido, su Coincidencia con él ("coincidiste en X de 11") y el historial de 11 Elegidos de su Club con Rival y fecha. El endpoint del cron está protegido por un secreto.

**Blocked by:** 05, 09

**Status:** ready-for-agent

- [ ] Al pasar la hora de cierre, el próximo ciclo del cron genera el 11 Elegido
- [ ] Volver a correr el cierre no cambia ni duplica el resultado
- [ ] Ni el Admin ni nadie puede modificar un 11 Elegido (está garantizado por RLS)
- [ ] Una Votación anulada o sin Alineaciones que cuentan queda registrada sin 11 Elegido, y el Hincha ve el motivo
- [ ] El Hincha ve el 11 Elegido, su Coincidencia y el historial de su Club
- [ ] Sin el secreto, el endpoint del cron responde 401

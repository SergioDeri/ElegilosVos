# 11: Parcial en vivo

**What to build:** Mientras la Votación está abierta, el Hincha ve el Parcial de su Club: el 11 que va ganando (en el Esquema ganador), el porcentaje de cada Esquema y los candidatos de cada Puesto con su porcentaje. Se calcula con el Motor de Conteo sobre las Alineaciones guardadas. Se expone solo agregado (una función de servidor o security definer que nunca devuelve Alineaciones individuales) y puede tener caché de corta duración. El backoffice muestra para cada Votación la cantidad de Alineaciones que cuentan y el Parcial.

**Blocked by:** 05, 09

**Status:** resolved

- [ ] El Hincha ve el Parcial de su Club (el 11, los porcentajes por Esquema y los porcentajes por Puesto)
- [ ] El Parcial se actualiza al cambiar Alineaciones (con la caché que se haya definido, como máximo un minuto)
- [ ] La respuesta nunca contiene datos que permitan identificar la Alineación de un Hincha
- [ ] Un Hincha no puede ver el Parcial del otro Club
- [ ] El Admin ve la participación y el Parcial de cada Votación

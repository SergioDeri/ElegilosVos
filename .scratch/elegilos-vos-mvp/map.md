# Mapa de ejecución en paralelo: MVP

Spec: `spec.md`. Tickets en `issues/`.

## Olas (los tickets de cada ola corren en paralelo)

| Ola | Tickets |
|---|---|
| 1 | 01 |
| 2 | 02, 03, 04 |
| 3 | 05, 06, 07 |
| 4 | 08, 09 |
| 5 | 10, 11, 12, 13 |
| 6 | 14, 15, 16 |
| 7 | 17 |

## Estrategia de git (decidida por el usuario)

- Cada agente trabaja en su propio git worktree, en una rama temporal `wip/<NN>-<slug>`, a partir de una rama de integración temporal `wip/integracion`.
- Al terminar una ola, sus ramas se mergean a `wip/integracion` antes de lanzar la ola siguiente.
- Para crear los worktrees hace falta un commit base temporal en `wip/integracion`; no va a quedar en el historial final.
- Al final (después del 17), todo se aplasta en **un único commit inicial en `main`**, a nombre del usuario y **sin co-autoría de Claude**. Después se borran las ramas `wip/*`.
- Los conflictos esperables al mergear son en `package.json`, el lockfile y el README. Las migraciones usan timestamp para no chocar.

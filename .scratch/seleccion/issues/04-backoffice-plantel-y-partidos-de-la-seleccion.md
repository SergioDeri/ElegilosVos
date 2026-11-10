# 04: Backoffice: Plantel y Partidos de la Selección

**What to build:** El Admin mantiene el Plantel de la Selección (los elegibles) desde el mismo backoffice de Planteles: alta, baja lógica, posición natural y Disponibilidad con motivo, sin número (el formulario no lo pide en la Selección). Un Jugador de un Club que también es elegible se carga aparte, con su propia Disponibilidad. El Admin también carga Partidos de la Selección contra Rivales del catálogo (otras selecciones con su escudo), con postergación y cancelación como en los Clubes.

**Blocked by:** 01

**Status:** resolved

- [x] El Plantel de la Selección aparece en el backoffice de Planteles y se edita como los demás, sin número
- [x] Los cambios de Disponibilidad de la Selección quedan registrados como en los Clubes
- [x] El Admin carga, posterga y cancela Partidos de la Selección
- [x] Tests de RLS: solo un Admin con 2FA escribe el Plantel y los Partidos de la Selección
- [x] Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls && npm run test:e2e` (los E2E, verificados al integrar con el ticket 02)

## Comments

- (Revisión del ticket 01) En cuanto exista un Partido de la Selección, `clubIdDeLaBase` lanza en el proceso de cierre y en el conteo de la Votación (`src/lib/cierre/proceso.ts`, `src/lib/votacion/conteo.ts`), y `numeroDeClubDeLaBase` lanza en la ficha del Jugador del backoffice. Este ticket tiene que dejar esos caminos sin romperse para la Selección (saltearla o usar `clubOSeleccionDeLaBase`) hasta que los tickets 05 y 10 la procesen de verdad. Las acciones de Planteles ya pasan `plantel` a la validación.

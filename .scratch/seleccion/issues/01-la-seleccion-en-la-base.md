# 01: La Selección en la base

**What to build:** Prefactor para que el resto sea fácil. La Selección pasa a existir en la base como una fila más de la tabla de clubes (id `seleccion`), con una marca que la distingue de los Clubes, para que Partido, Jugador, Alineación, resultado, 11 Real y notificaciones la reutilicen. En el dominio no es un Club: `ClubId` sigue siendo Peñarol o Nacional y se agrega un tipo "Club o Selección" (por ejemplo `ClubOSeleccion`) con su guard y su conversión desde la base, más el nombre para mostrar. Nadie puede elegir la Selección como Club Favorito (ni el Hincha ni el Admin al cambiarlo). El número de un Jugador pasa a ser obligatorio solo en los Planteles de un Club y nulo en el de la Selección, tanto en la base como en la validación de dominio de Planteles. Nada visible cambia para los Hinchas de hoy.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] La Selección existe en la tabla de clubes con su marca, y la lectura pública de clubes la incluye
- [x] `elegir_club_favorito` y el cambio de Club Favorito del Admin rechazan la Selección
- [x] El tipo de dominio "Club o Selección" con guard y conversión desde la base, con tests; `ClubId` no cambia
- [x] Un Jugador de la Selección se guarda sin número; uno de un Club sin número se rechaza (base y validación de Planteles)
- [x] Las pantallas y crons existentes no muestran ni procesan la Selección como si fuera un Club (no aparece en la elección de Club ni en los listados de Clubes del backoffice)
- [x] Tests de RLS en un archivo nuevo del feature (prefijo `seleccion-`)
- [x] `npm run typecheck && npm run lint && npm test && npm run test:rls` en verde

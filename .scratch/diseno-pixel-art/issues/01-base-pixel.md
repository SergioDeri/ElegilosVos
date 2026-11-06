# 01: Base pixel: paleta, --px, fuentes y tema por Club

**What to build:** La app adopta la base del estilo pixel art. Hay un módulo de dominio nuevo y puro para el arte pixel, con la paleta única (unos 24 colores, 16 bits vivos), el cálculo de `--px` y el texto bitmap. Se suman dos fuentes bitmap auto-hospedadas con Latin-1 completo (títulos y cuerpo de 8 px), paneles y botones con borde de 1 o 2 píxeles de arte y esquinas escalonadas, y el tema por Club: acentos del Club Favorito sobre una base neutra verde cancha, todo neutro mientras no hay Club, y el `themeColor` de la PWA acompaña. Se aplica a la estructura general de la app y a las pantallas de login, registro, verificar, recuperar y elegir club. Se puede ver iniciando sesión con un Hincha de cada Club.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] El módulo de dominio de arte pixel existe, es puro (no importa React, Next ni Supabase) y expone la paleta, `--px` y el texto bitmap desde su API pública
- [ ] Ningún color del arte se define fuera de la paleta
- [ ] `--px` es siempre entero entre 2 y 4 y depende del lado corto de la ventana (lado corto ≥ ~220 píxeles de arte): 390x844 → 2, 1470x739 → 3. Lo cubren tests
- [ ] El texto bitmap tiene ancho variable (M y W de 5 px, el resto de 3x5), tildes y Ñ en una fila superior y contorno opcional de 1 px, y expone el ancho de un texto en píxeles de arte. Lo cubren tests
- [ ] Las dos fuentes bitmap elegidas tienen licencia libre, se sirven desde la app (sin pedidos a terceros) y se usan solo a tamaños enteros. La elección y su licencia quedan anotadas en los Comments de este ticket
- [ ] Paneles y botones usan bordes pixelados con esquinas escalonadas; no hay `border-radius`, sombras difusas ni degradados
- [ ] Un Hincha de Peñarol ve acentos amarillo y negro, uno de Nacional blanco, azul y rojo; login, registro y elegir club se ven neutros
- [ ] Todo valor de tamaño del estilo pixel es múltiplo entero de `--px`; nada se ve borroso (`image-rendering: pixelated` / `crispEdges`)
- [ ] `npm run typecheck && npm run lint && npm test` pasan

# 01: Base pixel: paleta, --px, fuentes y tema por Club

**What to build:** La app adopta la base del estilo pixel art. Hay un módulo de dominio nuevo y puro para el arte pixel, con la paleta única (unos 24 colores, 16 bits vivos), el cálculo de `--px` y el texto bitmap. Se suman dos fuentes bitmap auto-hospedadas con Latin-1 completo (títulos y cuerpo de 8 px), paneles y botones con borde de 1 o 2 píxeles de arte y esquinas escalonadas, y el tema por Club: acentos del Club Favorito sobre una base neutra verde cancha, todo neutro mientras no hay Club, y el `themeColor` de la PWA acompaña. Se aplica a la estructura general de la app y a las pantallas de login, registro, verificar, recuperar y elegir club. Se puede ver iniciando sesión con un Hincha de cada Club.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] El módulo de dominio de arte pixel existe, es puro (no importa React, Next ni Supabase) y expone la paleta, `--px` y el texto bitmap desde su API pública
- [x] Ningún color del arte se define fuera de la paleta
- [x] `--px` es siempre entero entre 2 y 4 y depende del lado corto de la ventana (lado corto ≥ ~220 píxeles de arte): 390x844 → 2, 1470x739 → 3. Lo cubren tests
- [x] El texto bitmap tiene ancho variable (M y W de 5 px, el resto de 3x5), tildes y Ñ en una fila superior y contorno opcional de 1 px, y expone el ancho de un texto en píxeles de arte. Lo cubren tests
- [x] Las dos fuentes bitmap elegidas tienen licencia libre, se sirven desde la app (sin pedidos a terceros) y se usan solo a tamaños enteros. La elección y su licencia quedan anotadas en los Comments de este ticket
- [x] Paneles y botones usan bordes pixelados con esquinas escalonadas; no hay `border-radius`, sombras difusas ni degradados
- [x] Un Hincha de Peñarol ve acentos amarillo y negro, uno de Nacional blanco, azul y rojo; login, registro y elegir club se ven neutros
- [x] Todo valor de tamaño del estilo pixel es múltiplo entero de `--px`; nada se ve borroso (`image-rendering: pixelated` / `crispEdges`)
- [x] `npm run typecheck && npm run lint && npm test` pasan

## Comments

**Fuentes elegidas** (las dos con licencia OFL-1.1, desde los paquetes `@fontsource/press-start-2p` y `@fontsource/tiny5`, servidas por la app con `next/font/local`, subset latin U+0000-00FF):

- **Títulos y números: Press Start 2P.** Tamaño nativo de 8 px; se usa a 8 × `--px`, así que 1 píxel de la fuente es 1 píxel de arte.
- **Cuerpo: Tiny5.** Mayúsculas de 5 px de alto y minúsculas legibles. Tamaño nativo de 10 px; se usa a 10 × `--px`, también 1 píxel de la fuente por píxel de arte. Se prefirió a la lectura literal de "cuerpo de 8 px de alto": la línea de Tiny5 mide 10 px de arte, pero la letra es más baja que eso y en la grilla se ve más chica que cualquier fuente de 8 px de cuerpo.
- **Descartada: VT323.** Su píxel nativo es 1/16 de su tamaño: para alinearla a la grilla con `--px=2` habría que usarla a 32 px CSS, demasiado grande para texto corrido en el celu.
- **También probadas:** Silkscreen (solo mayúsculas), Pixelify Sans y Micro 5 (menos legibles en minúsculas).
- **Verificado a ojo:** "Peñarol", "Alineación", "¿Confirmás?" y "fernández" se ven bien en las dos. No se verificó glifo por glifo que cubran todo Latin-1 (¡, ü, etc.).

**Revisión de código (Standards + Spec).** Correcciones aplicadas:

- el ancho y el centrado de `main`, redondeados a píxeles de arte;
- los colores del manifest, tomados de la paleta;
- el rojo de Nacional, visible como línea de detalle bajo la barra;
- los checkbox y radios, dibujados en la grilla y sin el control nativo;
- los temas, recorridos con `CLUBES`;
- `--u`, documentada en el ADR 0004.

Queda pendiente y a sabiendas: los estilos globales por elemento también alcanzan al backoffice y a las vistas de cancha, Parcial y resultados. Esas pantallas mantienen sus CSS modules con colores fuera de la paleta hasta sus tickets (02 a 06).

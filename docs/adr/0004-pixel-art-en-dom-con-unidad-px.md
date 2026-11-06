# Pixel art en DOM con una unidad `--px` entera, no en canvas

La dirección artística (`design.txt`) pide pixel art con una resolución interna baja (320x180) escalada por un factor entero, como se hace en un juego dibujado en canvas. La app, en cambio, es una PWA que se usa en el celu en vertical, llena de formularios, texto y drag & drop (dnd-kit). Por eso se decidió dibujar todo en HTML y CSS sobre una grilla común: una variable `--px` (1 píxel de arte = N px CSS, con N entero según el breakpoint, nunca fraccionario) mide bordes, paneles, sprites, íconos y tipografía, y los sprites se escalan con `image-rendering: pixelated`. Así se conservan los controles nativos, la accesibilidad, el scroll y dnd-kit, y la regla de "una sola grilla por pantalla" se cumple porque todo se expresa en múltiplos de `--px`.

## Considered Options

- **Canvas en toda la app con resolución interna fija**: se pierden los formularios nativos, el texto seleccionable, los lectores de pantalla y dnd-kit. Además, 320x180 es apaisado y la app se usa en vertical.
- **Canvas solo en la cancha y DOM en el resto**: dos sistemas de render que hay que mantener alineados en la misma grilla, y el drag & drop entre la lista de Jugadores (DOM) y la cancha (canvas) habría que reimplementarlo a mano.

## Consequences

- No existe una "resolución interna": el ancho visible en píxeles de arte depende del dispositivo. Los layouts se diseñan fluidos en múltiplos de `--px`, no para un lienzo fijo.
- `--px` se elige según el lado corto de la pantalla (2 en celu, 3 en desktop) y no según el ancho, para que la cancha tenga siempre alto suficiente.
- La cancha tampoco tiene tamaño fijo: se dibuja con las dimensiones del espacio disponible medidas en píxeles de arte, así llena la pantalla sin scroll ni huecos (lo que sobra es menos de 1 píxel de arte). En pantallas apaisadas se dibuja horizontal, con el arco propio a la izquierda y los suplentes al costado; en verticales, vertical con los suplentes debajo. Lo validó un prototipo (rama `prototype/camisetas`).
- Todo valor de tamaño o posición del estilo pixel tiene que expresarse como `calc(n * var(--u))` con `n` entero, donde `--u` es `calc(var(--px) * 1px)` (1 píxel de arte en px CSS). Un valor suelto en px o en % rompe la grilla; si hace falta partir de un %, se redondea con `round(down, …, var(--u))`. `--px`, `--u` y la paleta los genera el módulo de dominio de arte pixel.
- Las posiciones de los Puestos en la cancha (hoy en %) se redondean a píxeles de arte enteros para que las camisetas no tiemblen ni se vean borrosas en los bordes.

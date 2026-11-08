# 03: Cancha pixel adaptable en el armado

**What to build:** La cancha del armado pasa a ser pixel art y ocupa todo el espacio disponible, sin scroll ni huecos. Se dibuja vista desde arriba, con franjas de césped, matas en tiles de 16x16 con variantes, líneas de cal, áreas, círculo central, medialunas y arcos con red, todo en proporción al tamaño. En una pantalla vertical la cancha va vertical y los suplentes debajo: título "SUPLENTES" y una fila alineada a la izquierda que salta de línea. En una pantalla apaisada la cancha va horizontal, con el arco propio a la izquierda y el lado izquierdo del equipo arriba, y los suplentes en una columna a la derecha que se divide en más columnas si no entra a lo alto. El componente de cancha compartido es el que cambia. Las demás vistas que lo usan (Parcial, resultados, link compartido) se adaptan en el 04.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 02

**Status:** resolved

- [x] El dominio expone la disposición: a partir del espacio en píxeles CSS, `--px`, el Esquema y la cantidad de suplentes, devuelve la orientación, el tamaño de la cancha en píxeles de arte (`floor(espacio / --px)`), el dibujo de la cancha, la posición entera de cada Puesto y cómo se reparte el banco
- [x] Tests: para todos los Esquemas del catálogo y las pantallas 390x844, 360x740, 844x390, 1470x739 y 1920x1080, con apellidos largos reales del seed, ninguna caja (Camiseta más apellido) se superpone con otra y todas caen dentro de la cancha
- [x] Tests: en horizontal el arquero queda junto al borde izquierdo; el arquero no se pisa con los zagueros (se pueden redistribuir las coordenadas del catálogo para la cancha pixel)
- [x] Tests: el banco alcanza para todos los suplentes sin pasarse del espacio
- [x] La pantalla de armado ocupa el alto visible sin scroll en celu vertical, celu acostado y desktop; revisado a ojo contra la variante D del prototipo
- [x] El drag & drop entre suplentes y Puestos funciona en las dos orientaciones
- [x] Las matas son deterministas: la cancha no cambia entre renders
- [x] `npm run typecheck && npm run lint && npm test` pasan

## Comments

**Implementación.**

- Dominio nuevo `@/domain/cancha`: `disponer({ ancho, alto, px, esquema, suplentes })` devuelve la orientación, el área (`floor(espacio / --px)`), la cancha, su dibujo, la caja de cada Puesto y la grilla del banco, todo en píxeles de arte enteros. Además expone `rotulo(nombre, ancho)` (el apellido en texto bitmap, centrado en un ancho exacto) y `siluetaDePuestoLibre()`.
- **Cómo evita los choques.** Las coordenadas del catálogo se estiran al largo de la cancha, con el arquero junto al arco propio y el más adelantado junto al rival. Recorriendo del arco propio hacia adelante, si dos Camisetas se pisan, la de más adelante se corre hacia el arco rival; así se separan el arquero y los zagueros del 5-3-2 y del 3-5-2. Si no entra, se aprieta el largo usado. Después, cada caja se ensancha hasta 48 píxeles sin tocar a sus vecinas, y el apellido se acorta con un punto para entrar en ella.
- **Banco.** En vertical va debajo, con el título "SUPLENTES" y una grilla que salta de línea. En horizontal va en columnas a la derecha. Si el 11 no entra en la cancha, los suplentes se achican (de 40 a 24 píxeles de ancho).
- **Acortado de apellidos.** El ticket pedía hacerlo con `nombreCorto` pasándole el ancho disponible, pero `nombreCorto` cuenta caracteres y no píxeles, y su "…" no existe en la fuente bitmap. Se toma el apellido con `nombreCorto` y se lo acorta por ancho en píxeles, con un punto al final.
- **App.** `CanchaPixel` (`src/app/_cancha/cancha-pixel.tsx`) mide su contenedor con un `ResizeObserver`, lee `--px` del documento y ubica todo con `calc(n * var(--u))`. `BancoPixel` dibuja el título y la grilla. El `Sprite` une los tramos iguales de filas consecutivas, así la cancha son pocos rectángulos.
- **Armado.** La sección del editor mide el alto visible (`100dvh`) y ocupa todo el ancho de `main`. La tarjeta del Partido queda arriba: la pantalla baja hasta la cancha, y desde ahí no hay más scroll. Rediseñar la tarjeta es del ticket 05. El aviso y las acciones (Quitar o Cancelar) van en un renglón de alto fijo, para que la cancha no salte. La lista de no disponibles quedó debajo de la cancha. El botón "Mandar al banco" se sacó: hacía lo mismo que "Quitar".
- Parcial, resultados y el link compartido siguen con la cancha vieja hasta el 04.

**Verificado a ojo** con Chrome sin ventana, manejado por CDP desde un script, porque la extensión de Chrome no llegaba a localhost. Se probó con un Hincha de Peñarol en 390x844 (vertical, banco debajo), 844x390 y 1470x739 (horizontal, arquero a la izquierda y banco en columnas). En ningún caso hubo scroll dentro del armado. El arrastre con mouse funcionó del banco a un Puesto, entre Puestos y de un Puesto al banco, y mientras se arrastra se ve la misma Camiseta.

**Tests.** Para los 6 Esquemas, las 5 pantallas y 0, 11 o 22 suplentes: ninguna caja se pisa con otra, todas caen dentro de la cancha y los apellidos largos del seed entran en su caja. También se prueban la orientación, el arquero junto al borde izquierdo en horizontal, el banco y que el dibujo sea determinista.

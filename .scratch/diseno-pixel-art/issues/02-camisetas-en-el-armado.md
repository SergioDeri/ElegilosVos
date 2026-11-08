# 02: Camisetas en el armado de la Alineación

**What to build:** En el armado de la Alineación, cada Jugador se muestra con la Camiseta de su Club en 24x24: el número en el pecho con contorno de 1 px y el apellido debajo. La Camiseta de arquero la lleva sola el Jugador con posición natural ARQ. Esto vale para los Puestos ocupados y para la lista de suplentes. El drag & drop sigue funcionando igual. En este ticket la cancha sigue siendo la actual; la cancha pixel llega en el 03.

Forma de la Camiseta, tomada del prototipo: mitad izquierda de 12 columnas que se espeja. `o` contorno, `m` manga, `k` puño, `b` cuerpo, `c` cuello. El número va centrado en las filas 9 a 13 (dígitos de 3x5). Luz arriba a la izquierda; sombra en las columnas de la derecha y en la última fila.

```
"............", "............", "....oooooo..", "...ommmbbccc",
"..ommmmbbbcc", ".ommmmmbbbbc", "ommmmmbbbbbb", "okmmmmbbbbbb",
"okkmmobbbbbb", ".okkmobbbbbb", "..oooobbbbbb", ".....obbbbbb"  (×11 filas)
".....ooooooo", "............"
```

Peñarol: bastones que alternan amarillo y negro cada 3 columnas, desde amarillo en la columna 6, con mangas amarillas, puños y cuello negros y números blancos. Arquero de Peñarol: negra con números amarillos. Nacional: blanca con cuello y puños azules y números rojos. Arquero de Nacional: toda azul con números blancos.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 01

**Status:** resolved

- [x] El dominio devuelve la matriz 24x24 de la Camiseta según Club y posición natural, con número estampado opcional; las 4 Camisetas son fijas en el código, no en la base
- [x] Tests: cada matriz mide 24x24, usa solo colores de la paleta y es simétrica salvo el sombreado y los bastones; la de arquero corresponde a ARQ; el número queda dentro del torso, rodeado de contorno; snapshot de las 4 Camisetas
- [x] En el armado, los Puestos ocupados y los suplentes muestran Camiseta, número y apellido (con el `nombreCorto` que ya existe)
- [x] La Camiseta no lleva escudo
- [x] Arrastrar y soltar Jugadores funciona como antes, y lo que se arrastra se ve con el mismo sprite
- [x] Los Jugadores no disponibles heredados se siguen distinguiendo como hoy
- [x] `npm run typecheck && npm run lint && npm test` pasan

## Comments

**Implementación.**

- Dominio: `camiseta(club, posicionNatural, { numero })` en `@/domain/pixel` devuelve la matriz 24x24; el número se estampa con `textoBitmap` (los mismos dígitos 3x5 y el mismo contorno). Tests en `camisetas.test.ts`, con snapshot de las 4 Camisetas.
- App: `Sprite` (`src/app/_pixel/sprite.tsx`) dibuja cualquier matriz como SVG medido en `--u`, y `JugadorConCamiseta` muestra la Camiseta con el apellido (`nombreCorto`) en texto bitmap. Se usa en los Puestos ocupados, en los suplentes y en el `DragOverlay`.
- Los Puestos ocupados ya no muestran la sigla, que queda solo en los vacíos (y en el `aria-label`). Los suplentes se muestran en una fila que salta de línea; la posición y el nombre completo quedan solo en el `aria-label`.
- Los no disponibles heredados se siguen distinguiendo, ahora con fondo `rojoSombra` y un "!" en vez del naranja con "(!)".
- El CSS del armado pasó a la paleta y a `--u`, salvo la tarjeta del Partido (`.partido`, `.rival`, `.escudo`), que queda para el ticket 07.

**Verificado a ojo** con un Hincha de cada Club: Camisetas de campo y de arquero, arrastre con teclado (el overlay es el mismo sprite) y Jugador lesionado heredado.

**Queda para el 03:** en la cancha actual, la Camiseta del arquero (y = 0.05) se sale un poco por abajo y recorta el apellido, y los apellidos largos pueden pisarse en las líneas de 5. Los dos casos los resuelve la disposición nueva.

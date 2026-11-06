# 03: Cancha pixel adaptable en el armado

**What to build:** La cancha del armado pasa a ser pixel art y ocupa todo el espacio disponible, sin scroll ni huecos. Se dibuja vista desde arriba, con franjas de césped, matas en tiles de 16x16 con variantes, líneas de cal, áreas, círculo central, medialunas y arcos con red, todo en proporción al tamaño. En una pantalla vertical la cancha va vertical y los suplentes debajo: título "SUPLENTES" y una fila alineada a la izquierda que salta de línea. En una pantalla apaisada la cancha va horizontal, con el arco propio a la izquierda y el lado izquierdo del equipo arriba, y los suplentes en una columna a la derecha que se divide en más columnas si no entra a lo alto. El componente de cancha compartido es el que cambia. Las demás vistas que lo usan (Parcial, resultados, link compartido) se adaptan en el 04.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] El dominio expone la disposición: a partir del espacio en píxeles CSS, `--px`, el Esquema y la cantidad de suplentes, devuelve la orientación, el tamaño de la cancha en píxeles de arte (`floor(espacio / --px)`), el dibujo de la cancha, la posición entera de cada Puesto y cómo se reparte el banco
- [ ] Tests: para todos los Esquemas del catálogo y las pantallas 390x844, 360x740, 844x390, 1470x739 y 1920x1080, con apellidos largos reales del seed, ninguna caja (Camiseta más apellido) se superpone con otra y todas caen dentro de la cancha
- [ ] Tests: en horizontal el arquero queda junto al borde izquierdo; el arquero no se pisa con los zagueros (se pueden redistribuir las coordenadas del catálogo para la cancha pixel)
- [ ] Tests: el banco alcanza para todos los suplentes sin pasarse del espacio
- [ ] La pantalla de armado ocupa el alto visible sin scroll en celu vertical, celu acostado y desktop; revisado a ojo contra la variante D del prototipo
- [ ] El drag & drop entre suplentes y Puestos funciona en las dos orientaciones
- [ ] Las matas son deterministas: la cancha no cambia entre renders
- [ ] `npm run typecheck && npm run lint && npm test` pasan

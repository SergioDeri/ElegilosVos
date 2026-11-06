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

**Status:** ready-for-agent

- [ ] El dominio devuelve la matriz 24x24 de la Camiseta según Club y posición natural, con número estampado opcional; las 4 Camisetas son fijas en el código, no en la base
- [ ] Tests: cada matriz mide 24x24, usa solo colores de la paleta y es simétrica salvo el sombreado y los bastones; la de arquero corresponde a ARQ; el número queda dentro del torso, rodeado de contorno; snapshot de las 4 Camisetas
- [ ] En el armado, los Puestos ocupados y los suplentes muestran Camiseta, número y apellido (con el `nombreCorto` que ya existe)
- [ ] La Camiseta no lleva escudo
- [ ] Arrastrar y soltar Jugadores funciona como antes, y lo que se arrastra se ve con el mismo sprite
- [ ] Los Jugadores no disponibles heredados se siguen distinguiendo como hoy
- [ ] `npm run typecheck && npm run lint && npm test` pasan

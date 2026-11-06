# 04: Parcial, resultados y link compartido en la cancha pixel

**What to build:** El Parcial, el 11 Elegido, el 11 Real, la Coincidencia y el link público del 11 Elegido se muestran en la cancha pixel adaptable, con Camisetas, número y apellido. Los porcentajes por Esquema y por Puesto, la Coincidencia y los demás números usan la fuente pixel. Así, quien abre el link compartido ve la misma estética.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] El Parcial se ve en la cancha pixel, con la misma disposición sin choques
- [x] El 11 Elegido y el 11 Real se ven en la cancha pixel (el 11 Real no tiene Esquema: se muestra como hoy, con el estilo nuevo)
- [x] Los porcentajes y la Coincidencia usan la fuente pixel y respetan la grilla
- [x] La página pública del 11 Elegido tiene el estilo pixel y funciona sin sesión
- [x] Revisado a ojo en celu vertical, celu acostado y desktop
- [x] `npm run typecheck && npm run lint && npm test` pasan

## Comments

**Implementación.**

- `CanchaDeLectura` (`src/app/_cancha/cancha-de-lectura.tsx`): un Client Component que recibe datos serializables (Jugador, detalle, resaltado, atenuado y descripción accesible por Puesto) y los dibuja sobre `CanchaPixel`, con la misma disposición sin choques del armado. La Camiseta de arquero va en el Puesto ARQ, que por regla solo ocupa un arquero; así no hace falta la posición natural en los modelos de vista.
- **Parcial.** El 11 que va ganando se ve en la cancha pixel. El porcentaje va en una chapita de la fuente pixel sobre la Camiseta. Un Puesto completado sin votos se ve atenuado: "sin votos" sigue en el nombre accesible y en las tablas.
- **Backoffice.** `/admin/votaciones` sigue usando `VistaParcial`, pero sin `club`, y entonces el 11 va en una tabla, sin sprites (ticket 06).
- **11 Elegido.** Se ve en la cancha pixel. Los Jugadores que también están en tu Alineación se resaltan con un borde del acento. La Coincidencia y el acierto del 11 Real se escriben con la fuente pixel de títulos. El 11 Real no tiene Esquema y sigue como lista, con el estilo nuevo.
- **Link público.** `/compartir/once-elegido/[id]` se ve con los acentos del Club del Partido (`data-club`) y la cancha pixel en lugar de la imagen. La imagen sigue en los metadatos Open Graph y en el botón de compartir. `modeloOnceElegido` devuelve además `clubId` y `esquemaId`.
- La cancha vieja (`_cancha/cancha.tsx`) se borró, junto con los CSS de Parcial y resultados que tenían colores fuera de la paleta.
- **Alto de la cancha.** En estas páginas con scroll, la cancha ocupa a lo sumo el alto visible (260 píxeles de arte en vertical, 160 en apaisado).

**Verificado a ojo** con Chrome sin ventana (por CDP):
- Parcial en 390x844, con una Alineación de prueba.
- 11 Elegido (3-5-2) en 390x844 y 1470x739, con un resultado de prueba que se insertó en la base local y se borró después.
- Link público en 844x390. Sin sesión responde 200.

**Pendiente.** No se probó el 11 Real con datos cargados.

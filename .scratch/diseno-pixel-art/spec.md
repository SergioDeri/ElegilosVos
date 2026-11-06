Status: ready-for-agent

# Spec: Diseño pixel art

## Problem Statement

La app funciona, pero no tiene identidad visual: casi no tiene estilos, los Puestos de la cancha son rótulos de texto y nada recuerda a un Club. Al Hincha le cuesta reconocer de un vistazo a los Jugadores de su Club en la cancha, y la experiencia de armar la Alineación no se siente como "armar el equipo". Además, los escudos de los Rivales son imágenes de cualquier estilo y tamaño, el escudo de cada Club no tiene dónde cargarse, y el backoffice sigue pidiendo una foto de cada Jugador que no se va a usar.

## Solution

Toda la app pasa a una estética pixel art retro de 16 bits, con colores vivos:

- **Grilla de píxeles.** Todo se dibuja en una misma grilla: 1 píxel de arte equivale a `--px` píxeles CSS, siempre un número entero (2 en celu, 3 en desktop, según el lado corto de la pantalla). Se dibuja en el DOM, no en canvas (ADR 0004).
- **Jugadores con Camiseta.** En la cancha, cada Jugador se muestra con la **Camiseta** de su Club (24x24), el número en el pecho con contorno y el apellido debajo. La Camiseta de arquero la lleva el Jugador cuya posición natural es ARQ. Las Camisetas son fijas: Peñarol amarilla con bastones negros en todo el frente y números blancos, y arquero negra con números amarillos; Nacional blanca con cuello y puños azules y números rojos, y arquero toda azul con números blancos.
- **Cancha a pantalla completa.** La cancha tiene césped a franjas con matas y líneas de cal, y ocupa exactamente el espacio disponible, sin scroll ni huecos. En una pantalla vertical va vertical con los suplentes debajo; en una apaisada va horizontal, con el arco propio a la izquierda y los suplentes en columna a la derecha.
- **Colores.** La base es neutra, verde cancha, con acentos del Club Favorito. Antes de elegir Club, todo es neutro.
- **Texto, íconos y paneles.** Dos fuentes bitmap (una para títulos y otra para el cuerpo), íconos de 8x8, y paneles y botones con borde de 1 o 2 píxeles y esquinas escalonadas.
- **Efectos por pasos.** Transiciones por bloques, la Camiseta que salta y suelta partículas cuadradas al soltarla en un Puesto, un balanceo de 2 frames en la cancha y papelitos pixelados en el 11 Elegido. Todo se apaga con "reducir movimiento".
- **Backoffice.** Usa la misma paleta y fuente, sin sprites ni efectos. Suma una pantalla para subir el escudo de cada Club, exige que todo escudo (de Club o de Rival) sea un PNG pixel art de exactamente 48x48, y deja de pedir fotos de Jugadores. Mientras un escudo no esté cargado, se muestra un hueco de "falta escudo".

## User Stories

### Estética general

1. Como Hincha, quiero que toda la app tenga un mismo estilo pixel art, para que se sienta como un juego de fútbol retro y no como un formulario.
2. Como Hincha, quiero que nunca se vean píxeles de distintos tamaños en una misma pantalla, para que el estilo se vea prolijo.
3. Como Hincha, quiero que nada se vea borroso ni con bordes suavizados, para que el pixel art se vea nítido en cualquier pantalla.
4. Como Hincha con un celu chico, quiero que el tamaño de los píxeles se ajuste a mi pantalla en pasos enteros, para que todo entre y se lea sin perder nitidez.
5. Como Hincha en desktop, quiero que los píxeles se vean más grandes que en el celu, para que la app no quede diminuta en una pantalla grande.
6. Como Hincha, quiero que los colores salgan de una paleta limitada y vivida, para que todas las pantallas combinen.
7. Como Hincha de Peñarol, quiero ver acentos amarillos y negros (botón principal, encabezado), para sentir la app como de mi Club.
8. Como Hincha de Nacional, quiero ver acentos blancos, azules y rojos, para sentir la app como de mi Club.
9. Como visitante que todavía no eligió Club, quiero ver la app en colores neutros (verde cancha), para no sentir que está inclinada hacia un Club.
10. Como Hincha, quiero que los textos usen una fuente pixelada que tenga ñ y tildes, para que "Peñarol" o "Alineación" se escriban bien.
11. Como Hincha, quiero que el texto corrido (avisos, cuenta regresiva) use una fuente pixel legible, para leerlo sin esfuerzo.
12. Como Hincha, quiero que los títulos usen una fuente pixel más llamativa, para distinguirlos del texto común.
13. Como Hincha, quiero que botones y paneles tengan bordes pixelados con esquinas escalonadas, para que la interfaz sea coherente con el arte.
14. Como Hincha, quiero íconos pixelados de 8x8 alineados con el texto, para entender las acciones (guardado, cierre, compartir, menú) sin romper el estilo.
15. Como Hincha, quiero que no haya degradados suaves, sombras difusas ni gráficos vectoriales suaves, para que la estética no se mezcle.

### Camisetas

16. Como Hincha, quiero ver a cada Jugador en la cancha con la Camiseta de mi Club, para reconocer al equipo de un vistazo.
17. Como Hincha de Peñarol, quiero que la Camiseta de campo sea amarilla con bastones negros en todo el frente, para que se parezca a la del Club.
18. Como Hincha de Peñarol, quiero que el arquero use una Camiseta negra con números amarillos, para distinguirlo de los jugadores de campo.
19. Como Hincha de Nacional, quiero que la Camiseta de campo sea blanca con cuello y puños azules y números rojos, para que se parezca a la del Club.
20. Como Hincha de Nacional, quiero que el arquero use una Camiseta toda azul con números blancos, para distinguirlo.
21. Como Hincha, quiero que la Camiseta de arquero aparezca sola en los Jugadores cuya posición natural es ARQ, sin que yo haga nada.
22. Como Hincha, quiero ver el número del Jugador en el pecho de la Camiseta con un contorno oscuro de 1 píxel, para leerlo incluso sobre los bastones.
23. Como Hincha, quiero que la Camiseta no tenga escudo, solo los colores, para que se vea limpia en un tamaño chico.
24. Como Hincha, quiero que las Camisetas tengan sombreado de 2 o 3 tonos y contorno oscuro, para que tengan volumen sin perder el estilo retro.
25. Como Hincha, quiero que las Camisetas sean chicas (24x24), para que entren 5 por línea en la cancha del celu sin pisarse.

### Cancha y armado de la Alineación

26. Como Hincha, quiero que la cancha sea una vista desde arriba con césped a franjas y líneas de cal, para que se sienta como un campo de juego.
27. Como Hincha, quiero que el césped tenga matas variadas, para que no se note un patrón repetido.
28. Como Hincha, quiero que la cancha ocupe todo el espacio disponible sin scroll ni huecos, para aprovechar la pantalla.
29. Como Hincha en el celu en vertical, quiero ver la cancha vertical y los suplentes debajo, en una fila alineada a la izquierda que salta de línea, para tener todo a mano con el pulgar.
30. Como Hincha en desktop o con el celu acostado, quiero ver la cancha horizontal, con el arco propio a la izquierda y los suplentes en columna a la derecha, para usar bien una pantalla ancha.
31. Como Hincha con muchos suplentes en una pantalla baja, quiero que la columna de suplentes se divida en más columnas, para no tener que hacer scroll.
32. Como Hincha, quiero ver el apellido de cada Jugador debajo de su Camiseta, para saber quién es sin tocarlo.
33. Como Hincha, quiero que ninguna Camiseta ni apellido se pise con otro en ningún Esquema, para leer bien el 11 completo.
34. Como Hincha, quiero que los apellidos largos (por ejemplo Arismendi o Fernández) no tapen a los vecinos, para que la cancha se lea siempre.
35. Como Hincha, quiero que los Jugadores queden ubicados en píxeles enteros, para que no tiemblen ni se vean borrosos al moverse.
36. Como Hincha, quiero que el arquero no se pise con los zagueros, para distinguir bien la última línea.
37. Como Hincha, quiero que los suplentes se muestren con la misma Camiseta, número y apellido que en la cancha, para reconocerlos igual.
38. Como Hincha, quiero arrastrar una Camiseta de los suplentes a un Puesto, como ya hago hoy, para armar mi Alineación con el estilo nuevo.
39. Como Hincha, quiero que al soltar una Camiseta en un Puesto la Camiseta salte y suelte partículas cuadradas, para sentir que el cambio se registró.
40. Como Hincha, quiero que los Jugadores de la cancha se balanceen con una animación de 2 frames, para que la cancha se sienta viva.
41. Como Hincha, quiero que un Puesto vacío se vea como un lugar libre en la cancha, para saber qué me falta completar.
42. Como Hincha, quiero que los Jugadores no disponibles de mi Alineación heredada se vean claramente distintos o fuera de la cancha, como hoy, para saber a quién reemplazar.

### Parcial, resultados y 11 Elegido

43. Como Hincha, quiero ver el Parcial en la misma cancha pixel con Camisetas, para comparar fácil con lo que armé.
44. Como Hincha, quiero ver el 11 Elegido en la cancha pixel, para ver el equipo de la hinchada como un equipo de verdad.
45. Como Hincha, quiero ver papelitos pixelados cuando veo el 11 Elegido o mi Coincidencia, para festejar el resultado.
46. Como Hincha, quiero que los porcentajes y los números del Parcial y de la Coincidencia usen la fuente pixel, para que todo combine.
47. Como Hincha que comparte el 11 Elegido, quiero que el link público también tenga el estilo pixel, para que quien lo abra vea la misma estética.

### Navegación y movimiento

48. Como Hincha, quiero que al cambiar de pantalla haya una transición por bloques o un fundido por pasos, para que el cambio se sienta retro.
49. Como Hincha con "reducir movimiento" activado, quiero que se apaguen las transiciones, el balanceo, las partículas y los papelitos, para usar la app sin animaciones.
50. Como Hincha con "reducir movimiento" activado, quiero seguir viendo al instante el resultado de cada acción, para no perder información.

### Partidos y escudos

51. Como Hincha, quiero ver el escudo pixel art del Rival en la tarjeta del Partido, para identificar el encuentro rápido.
52. Como Hincha, quiero ver el escudo pixel art de mi Club, para sentir la pantalla como propia.
53. Como Hincha, quiero que los escudos se vean más grandes que las Camisetas (48x48), para que destaquen.
54. Como Hincha, quiero que donde falta un escudo se vea un hueco pixelado de "falta escudo", para que la pantalla no se vea rota.

### Backoffice

55. Como Admin, quiero que el backoffice use la misma paleta y fuente que la app, para que se sienta parte del mismo producto.
56. Como Admin, quiero que el backoffice no tenga sprites ni efectos, para cargar datos rápido y con mucha información a la vista.
57. Como Admin, quiero una sección "Clubes" para subir el escudo de Peñarol y el de Nacional, para no depender de un cambio de código.
58. Como Admin, quiero reemplazar el escudo de un Club ya cargado, para corregirlo si me equivoqué.
59. Como Admin, quiero que el backoffice rechace un escudo que no sea PNG de exactamente 48x48, con un mensaje claro, para que nunca se cuele una imagen fuera de la grilla.
60. Como Admin, quiero que la misma regla de 48x48 valga para los escudos de los Rivales, para que todos los escudos sean coherentes.
61. Como Admin, quiero que el formulario de Jugador deje de pedir una foto, para cargar solo nombre, número, posición natural y Disponibilidad.
62. Como Admin, quiero que las fotos que ya estaban cargadas se borren, para no guardar datos que no se usan.
63. Como Admin, quiero que solo el Admin pueda subir o reemplazar escudos, para que nadie más cambie la identidad de los Clubes.

## Implementation Decisions

- **Render (ADR 0004).** Todo en DOM y CSS sobre una unidad `--px` entera; nada de canvas ni de resolución interna fija. Los sprites se dibujan en matrices de colores de la paleta y se muestran sin suavizado (`image-rendering: pixelated` o SVG con `crispEdges`). Toda medida del estilo pixel es un múltiplo entero de `--px`.
- **`--px`.** Se calcula según el lado corto de la ventana, con mínimo 2 y máximo 4, de forma que el lado corto tenga al menos unos 220 píxeles de arte (en la práctica, 2 en celu y 3 en desktop). Lo validó el prototipo.
- **Módulo de dominio nuevo para el arte pixel**, puro y sin React ni Next, con su API pública y tests al lado. Concentra las decisiones del estilo:
  - **Paleta**: una única definición de unos 24 colores (contorno; negro, amarillo, blanco, azul y rojo con 3 tonos cada uno; 4 verdes de césped; cal; grises; fondo). Ningún otro lugar define colores del arte.
  - **Camisetas**: a partir de un Club y una posición natural, devuelve la matriz 24x24 de la Camiseta, con opción de estampar un número con contorno. Las 4 Camisetas son fijas y viven acá; no van a la base.
  - **Texto bitmap**: convierte un texto en una matriz, con mayúsculas de ancho variable (M y W de 5 px; las demás de 3x5), tildes y Ñ en una fila superior, y contorno opcional. Expone el ancho de un texto en píxeles de arte para poder ubicar y evitar choques.
  - **Disposición de la cancha**: recibe el espacio disponible en píxeles CSS, `--px`, el Esquema y la cantidad de suplentes. Devuelve la orientación (vertical si el espacio es más alto que ancho, horizontal si no), el tamaño de la cancha en píxeles de arte, el dibujo de la cancha (franjas, matas por tile de 16x16 con variantes deterministas, líneas, áreas, círculo central, medialunas y arcos, en proporción al tamaño) y la posición de cada Puesto en píxeles de arte enteros. En horizontal, el arco propio queda a la izquierda y el lado izquierdo del equipo arriba. Esta función es responsable de que ninguna Camiseta y ningún apellido se pisen: puede redistribuir las coordenadas del catálogo de Esquemas (por ejemplo, separar al arquero de los zagueros) y acortar apellidos con el `nombreCorto` que ya existe, pasándole el ancho disponible.
  - **Banco**: cuántas columnas o filas necesitan los suplentes según la orientación y el espacio.
- **Forma de la Camiseta** (sale del prototipo): mitad izquierda de 12 columnas que se espeja; `o` contorno, `m` manga, `k` puño, `b` cuerpo, `c` cuello. El número va centrado en las filas 9 a 13 (dígitos de 3x5), con contorno de 1 px en las 8 direcciones. Luz arriba a la izquierda y sombra en las columnas de la derecha y en la última fila.

  ```
  "............", "............", "....oooooo..", "...ommmbbccc",
  "..ommmmbbbcc", ".ommmmmbbbbc", "ommmmmbbbbbb", "okmmmmbbbbbb",
  "okkmmobbbbbb", ".okkmobbbbbb", "..oooobbbbbb", ".....obbbbbb"  (×11 filas)
  ".....ooooooo", "............"
  ```

  Bastones de Peñarol: el cuerpo alterna amarillo y negro cada 3 columnas, empezando por amarillo en la columna 6.
- **La cancha** es un componente compartido nuevo que reemplaza al actual. Sigue sirviendo al armado de la Alineación, al Parcial, a los resultados y al link compartido. Mide su espacio con un observador de tamaño y le pide la disposición al módulo de dominio. El contenido de cada Puesto (arrastrable o no) lo sigue decidiendo cada vista.
- **Layout de las pantallas con cancha**: ocupan el alto visible (`100dvh`) sin scroll. La cancha toma el espacio que sobra después del encabezado y del banco. En vertical, el banco va debajo: título "SUPLENTES" y fila alineada a la izquierda que salta de línea, cada suplente con Camiseta, número y apellido. En horizontal, el banco va en columna a la derecha y se divide en más columnas si no entra a lo alto.
- **Drag & drop**: se mantiene dnd-kit. Arrastrar una Camiseta muestra el mismo sprite; al soltarla, la animación de salto y partículas va por pasos (`steps()`), sin interpolar.
- **Tema por Club**: variables CSS de acento derivadas de la paleta según el Club Favorito; neutras (verde cancha) cuando todavía no hay Club. El `themeColor` de la PWA acompaña.
- **Fuentes**: dos fuentes bitmap de licencia libre, auto-hospedadas (sin pedidos a terceros) y con Latin-1 completo: una para títulos y otra de cuerpo de 8 px de alto. Se usan solo en múltiplos enteros de su tamaño nativo. Si no se encuentra una con licencia y cobertura adecuadas, se usa la fuente bitmap del módulo de dominio. Las elige el agente y se documentan en el ticket.
- **Íconos**: 8x8, dibujados como matrices de la paleta, como las Camisetas.
- **Efectos**: transiciones por bloques entre pantallas, salto y partículas al soltar en un Puesto, balanceo de 2 frames a unos 4 FPS en la cancha y papelitos al ver el 11 Elegido o la Coincidencia. Todos por pasos y todos desactivados con `prefers-reduced-motion: reduce`.
- **Backoffice liviano**: paleta, fuente y bordes pixelados, sin sprites ni efectos. Las tablas y formularios siguen siendo densos.
- **Escudos**:
  - Validación de dominio nueva, al lado de la validación de imágenes que ya existe: el archivo tiene que ser PNG (por la firma), y su cabecera tiene que declarar exactamente 48x48. Devuelve motivos tipados (`vacia`, `tamano`, `formato`, `dimensiones`) para que la UI muestre mensajes claros.
  - Rivales: la subida existente pasa a usar esa validación.
  - Clubes: sección nueva "Clubes" en el backoffice para subir o reemplazar el escudo de cada Club, guardado en el mismo bucket público de escudos. Se usa la columna que ya existe en la tabla de Clubes.
  - **Migración nueva**: permite que el Admin actualice el escudo de un Club y amplía las políticas del bucket de escudos si hace falta. Siguen las convenciones de RLS (deny-by-default y políticas con nombre `"<tabla>: <qué permite>"`).
  - **Hueco "falta escudo"**: sprite de 48x48 que se muestra cuando no hay escudo, para Clubes y Rivales.
- **Quitar las fotos de Jugador**: migración nueva que borra la columna de foto del Jugador, las políticas y el bucket de fotos con los archivos que tenga. Se sacan el campo del formulario, la subida y las lecturas. La utilidad de subida de imágenes queda solo para escudos. Se regeneran los tipos de la base.
- **Glosario**: `CONTEXT.md` ya define **Camiseta** y que el **Club** tiene escudo y dos Camisetas. No se agregan términos nuevos.
- **Prototipo**: la rama `prototype/camisetas` tiene el prototipo descartable (variante D) como fuente de referencia del aspecto validado. No se mergea.

## Testing Decisions

- **Un buen test** prueba el comportamiento visible desde la API pública del módulo, no cómo está hecho por dentro: "la Camiseta de arquero de Nacional es azul y lleva el número en blanco", "ningún par de Puestos del 5-3-2 se pisa en una pantalla de 390x844", "el texto PEÑAROL mide N píxeles de arte". No se fijan detalles internos que se puedan refactorizar, como el orden de los `rect` o los nombres de funciones auxiliares.
- **Módulo de arte pixel (unit, Node)**:
  - Camisetas: para cada Club y posición natural, la matriz mide 24x24, usa solo colores de la paleta, es simétrica salvo el sombreado y los bastones, y la de arquero corresponde a ARQ. El número estampado queda dentro del torso y rodeado de contorno. Snapshot de las 4 Camisetas, como el snapshot que ya existe del catálogo de Esquemas.
  - Texto: anchos (M y W de 5 px, las demás de 3), tildes y Ñ en la fila superior, el contorno agrega 1 px por lado y los caracteres desconocidos no rompen nada.
  - `--px`: siempre entero entre 2 y 4. Celu vertical (390x844) da 2, desktop (1470x739) da 3, celu acostado da el que corresponda según el lado corto.
  - Disposición: orientación según la forma del espacio; tamaño de la cancha igual a `floor(espacio / --px)`; todas las posiciones son enteras y caen dentro de la cancha. Para **todos los Esquemas del catálogo** y un conjunto de tamaños de pantalla típicos (390x844, 360x740, 844x390, 1470x739, 1920x1080), ningún par de cajas (Camiseta más apellido) se superpone, con apellidos largos reales del seed. En horizontal, el arquero queda cerca del borde izquierdo.
  - Banco: la cantidad de columnas o filas alcanza para todos los suplentes sin pasarse del espacio.
- **Validación de escudos (unit, Node)**: PNG de 48x48 válido; PNG de otro tamaño (`dimensiones`); JPEG o WebP (`formato`); vacío; demasiado grande. Prior art: los tests de la validación de imágenes que ya existe en el dominio de Planteles.
- **RLS (Supabase local)**: un archivo nuevo de tests de RLS. El Admin puede actualizar el escudo de un Club y subirlo o reemplazarlo en el bucket; un Hincha y un anónimo no pueden; cualquiera puede leer el escudo. Después de la migración no existe el bucket de fotos de Jugadores, y la tabla de Jugadores no tiene columna de foto. Prior art: los tests de RLS de Rivales y escudos, y los helpers de clientes y usuarios que ya existen.
- **Lo visual** (componentes React, CSS, animaciones) no se testea automáticamente: se revisa a ojo con la app corriendo, en celu vertical, celu acostado y desktop, comparando con la variante D de la rama del prototipo.

## Out of Scope

- Personajes animados (muñequitos corriendo), parallax y escenas decorativas: quedan para una etapa posterior.
- Camisetas de los Rivales, Camisetas alternativas o especiales, y edición de Camisetas desde el backoffice.
- Dibujar los escudos: los sube el Admin ya hechos en pixel art. Tampoco hay conversión automática de imágenes comunes a pixel art.
- Mostrar fotos de Jugadores de cualquier forma.
- Sonido y música.
- Tests visuales automáticos (capturas de pantalla, Playwright).
- Cambios en las reglas del dominio (Votación, conteo, Herencia, 11 Elegido): este trabajo es solo de presentación, salvo la quita de fotos y los escudos.

## Further Notes

- Lo que se aprendió en el prototipo y que este spec ya incorpora:
  - Con una fuente de ancho fijo de 3 px, la M se lee como N, por eso la fuente tiene ancho variable.
  - Los apellidos largos chocan en las líneas de 5 jugadores en el celu.
  - En el catálogo, el arquero (alto 0.05) y el zaguero central (0.16) se pisan en el 5-3-2 y el 3-5-2.
  - Con `--px=4` en desktop, la cancha horizontal queda baja y los defensores se pisan; por eso `--px` depende del lado corto de la pantalla.
- La Camiseta negra del arquero de Peñarol tiene poco contraste con el contorno oscuro. Es aceptable, pero se puede revisar al definir la paleta final.
- El prototipo está en la rama `prototype/camisetas`, ruta `/prototipo-camisetas?variant=D`, solo en desarrollo.

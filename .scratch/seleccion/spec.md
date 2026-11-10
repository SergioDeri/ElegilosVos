Status: ready-for-agent

# Spec: Votación de la Selección

## Problem Statement

Hoy Elegilos Vos solo sirve a la hinchada de Peñarol y a la de Nacional: cada Hincha arma la Alineación de su Club Favorito y de ningún otro. Pero la discusión más grande del fútbol uruguayo, la que une a las dos hinchadas, es a quién tendría que poner el DT de la Selección. Esa opinión no tiene dónde registrarse. Además, el que no es de ninguno de los dos clubes (o no quiere decirlo) no tiene por qué entrar a la app.

Y en la Selección hay una pregunta que en los clubes casi no existe: ¿a quién reclama la gente que el DT no convocó? Hoy no hay forma de medirlo ni de mostrarlo.

## Solution

Un módulo nuevo de Votación para la **Selección** (la mayor masculina), abierto a cualquier Hincha sin importar su Club Favorito, e incluso a quien se registra sin elegir Club ("Quiero votar solo por la Selección").

El Hincha arma su Alineación de la Selección con la misma cancha y los mismos Esquemas que en su Club, eligiendo entre los **elegibles** que mantiene el Admin (el Plantel de la Selección, convocados o no). La Votación abre 14 días antes de cada Partido y cierra 1 hora antes; en una fecha doble puede haber dos abiertas a la vez (ADR-0005).

Mientras la Votación está abierta, el Parcial muestra el 11 que va ganando y destaca un Jugador: el **Más Pedido** hasta que el Admin carga la **Convocatoria**, y desde ahí el **Gran Ausente** provisorio (el más elegido que el DT no convocó). Al cierre queda el 11 Elegido y el Gran Ausente final, que se comparte, se notifica y se compara con el 11 Real.

Los Hinchas con Club pasan de una hinchada a la otra con un selector "mi club / Selección" y ven un aviso de la Selección la primera vez.

## User Stories

### Registro y acceso

1. Como persona que se registra, quiero ver en el selector de Club la opción "Quiero votar solo por la Selección", para poder usar la app sin declarar un Club.
2. Como persona que se registra, quiero que el selector me avise que el Club Favorito no se puede cambiar, pero que elegir "solo Selección" no me impide elegir Club más tarde, para decidir sin miedo.
3. Como Hincha sin Club Favorito, quiero entrar directo a la Selección al abrir la app, para no pasar por pantallas que no me sirven.
4. Como Hincha sin Club Favorito, quiero que después de guardar mi primera Alineación de la Selección se me invite a elegir Club, para sumarme a mi hinchada si quiero.
5. Como Hincha sin Club Favorito, quiero poder rechazar esa invitación y seguir solo con la Selección, para que la app no me obligue.
6. Como Hincha sin Club Favorito, quiero poder elegir Club más tarde desde mi cuenta, para hacerlo cuando me decida.
7. Como Hincha que eligió Club después de la Selección, quiero que ese Club quede fijo igual que para cualquier Hincha, para que las reglas sean las mismas para todos.
8. Como Hincha sin Club Favorito, quiero que la app no me muestre ni me deje abrir las pantallas de un Club, para no ver cosas que no puedo votar.
9. Como Hincha que ya tenía Club, quiero ver un aviso la primera vez que entro después del lanzamiento, que me cuente que ahora puedo votar a la Selección y me lleve ahí, para enterarme.
10. Como Hincha que ya vio el aviso, quiero que no vuelva a aparecer, para que no moleste.
11. Como Hincha con Club, quiero un selector "mi club / Selección" siempre visible, para cambiar de una a otra cuando quiera.

### Armar la Alineación de la Selección

12. Como Hincha, quiero armar mi Alineación de la Selección con los mismos Esquemas y la misma cancha que en mi Club, para no aprender nada nuevo.
13. Como Hincha, quiero elegir entre todos los elegibles de la Selección, estén convocados o no, para hacer de DT de verdad.
14. Como Hincha, quiero ver el nombre completo de cada Jugador de la Selección, sin número, para reconocerlo aunque juegue afuera.
15. Como Hincha, quiero ver a los Jugadores de la Selección con la camiseta celeste y al arquero con la negra, para que se sienta la Selección.
16. Como Hincha, quiero ver el escudo de la AUF en la Selección, para distinguirla de mi Club.
17. Como Hincha, quiero que mi Alineación de la Selección se guarde sola, como la de mi Club, para no tener que enviar nada.
18. Como Hincha, quiero que mi Alineación de la Selección sea privada, para que nadie vea mi voto individual.
19. Como Hincha, quiero que mis Alineaciones de la Selección y de mi Club sean independientes, para que cambiar una no toque la otra.
20. Como Hincha, quiero no poder elegir a un Jugador de la Selección Lesionado, Suspendido o No disponible, para que mi voto cuente.
21. Como Hincha, quiero ver si un Jugador figura en la Convocatoria cuando ya se cargó, para decidir si igual lo pongo.
22. Como Hincha, quiero poder seguir poniendo a un Jugador no convocado después de que salió la Convocatoria, para reclamarlo con mi voto.

### Calendario de la Votación de la Selección

23. Como Hincha, quiero que la Votación de un Partido de la Selección abra 14 días antes del inicio, para tener tiempo de armarla.
24. Como Hincha, quiero que cierre 1 hora antes del inicio, como en los clubes, para que la regla sea la misma.
25. Como Hincha, en una fecha doble quiero tener abiertas las dos Votaciones a la vez, para armar los dos partidos.
26. Como Hincha, en una fecha doble quiero elegir para qué Partido estoy armando, para no confundirme.
27. Como Hincha, al abrir la Votación del segundo Partido de una fecha doble quiero que arranque con una copia de lo que tengo armado para el primero, para no empezar de cero.
28. Como Hincha, quiero que después de esa copia cada Alineación siga por su lado, para cambiar una sin tocar la otra.
29. Como Hincha, cuando abre la Votación y el Partido anterior de la Selección ya cerró, quiero heredar mi Alineación de ese Partido sin los Jugadores no disponibles, como en mi Club.
30. Como Hincha, si el Admin cambia el horario de un Partido de la Selección, quiero que la apertura y el cierre se muevan con él.
31. Como Hincha, si un Partido de la Selección se cancela, quiero que su Votación se anule.

### Parcial, Más Pedido y Gran Ausente

32. Como Hincha, quiero ver el Parcial de la Selección con el 11 que va ganando y los porcentajes por Esquema y por Puesto, como en mi Club.
33. Como Hincha, antes de que salga la Convocatoria quiero ver al Más Pedido (el Jugador que figura en más Alineaciones), para saber a quién quiere la gente.
34. Como Hincha, cuando sale la Convocatoria quiero ver al Gran Ausente provisorio (el Jugador que figura en más Alineaciones sin estar convocado), para saber a quién reclama la gente.
35. Como Hincha, quiero que el Más Pedido y el Gran Ausente se actualicen mientras la Votación sigue abierta, para seguir la discusión.
36. Como Hincha, quiero ver cuántas Alineaciones lo incluyen (o en qué porcentaje), para entender el peso del reclamo.
37. Como Hincha, si hay empate, quiero ver a todos los empatados, para que no se esconda a nadie.
38. Como Hincha, si ningún no convocado figura en ninguna Alineación, quiero que no se muestre un Gran Ausente, en vez de uno inventado.
39. Como Hincha, al cierre quiero ver el 11 Elegido de la Selección y el Gran Ausente final, destacados.
40. Como Hincha, si la Votación cerró sin Convocatoria cargada, quiero ver el Gran Ausente cuando el Admin la cargue, calculado con los votos del cierre.
41. Como Hincha, quiero un solo resultado con los votos de todos, sin separar por hinchada.

### 11 Real, Coincidencia y compartir

42. Como Hincha, quiero ver el 11 Real de la Selección cuando el Admin lo cargue, comparado con el 11 Elegido.
43. Como Hincha, quiero ver la Coincidencia entre mi Alineación de la Selección y el 11 Elegido y el 11 Real.
44. Como Hincha, quiero compartir la imagen del 11 Elegido de la Selección con el Gran Ausente destacado.
45. Como Hincha, mientras no hay Gran Ausente quiero que la imagen muestre al Más Pedido, para compartir igual.
46. Como Hincha, quiero compartir mi propia Alineación de la Selección, como con mi Club.
47. Como Hincha, quiero que las imágenes de la Selección muestren el nombre completo de los Jugadores, sin número.

### Notificaciones

48. Como Hincha, quiero un aviso cuando abre una Votación de la Selección.
49. Como Hincha, quiero un aviso cuando una Votación de la Selección está por cerrar.
50. Como Hincha, quiero un aviso cuando sale la Convocatoria, con el Gran Ausente provisorio.
51. Como Hincha, quiero un aviso con el Gran Ausente final y el 11 Elegido.
52. Como Hincha, quiero apagar las notificaciones de la Selección sin apagar las de mi Club (y al revés).
53. Como Hincha sin Club, quiero recibir solo las notificaciones de la Selección.
54. Como Hincha, en una fecha doble quiero que cada aviso diga de qué Partido habla.

### Admin

55. Como Admin, quiero mantener el Plantel de la Selección (los elegibles) desde el mismo backoffice de Planteles, para no aprender otra herramienta.
56. Como Admin, quiero cargar a los Jugadores de la Selección sin número, para no inventar datos.
57. Como Admin, quiero cargar a un Jugador de un Club también en la Selección como entrada aparte, con su propia Disponibilidad, para que una lesión en el Club no lo saque de la Selección (y al revés).
58. Como Admin, quiero marcar la Disponibilidad de los elegibles de la Selección, como en los clubes.
59. Como Admin, quiero cargar Partidos de la Selección contra Rivales del catálogo (otras selecciones con su escudo), como en los clubes.
60. Como Admin, quiero cargar una Convocatoria eligiendo elegibles del Plantel de la Selección y marcar a qué Partidos se aplica, para cargarla una vez en una fecha doble.
61. Como Admin, quiero poder corregir la Convocatoria mientras la Votación de sus Partidos sigue abierta, si el DT reemplaza a alguien.
62. Como Admin, quiero cargar la Convocatoria después del cierre si se me pasó, y que el Gran Ausente se calcule igual.
63. Como Admin, quiero que una Convocatoria con Gran Ausente final ya mostrado quede fija, para que el resultado no cambie por detrás.
64. Como Admin, quiero cargar el 11 Real de la Selección.
65. Como Admin, quiero que solo un Admin con 2FA pueda cargar y editar la Convocatoria, como el resto del backoffice.

## Implementation Decisions

### Modelo

- **La Selección se guarda como una fila más de la tabla de clubes** (id `seleccion`), con una marca que la distingue de los Clubes. Así Partido, Jugador, Alineación, resultado de la Votación, 11 Real y notificaciones la reutilizan sin tablas paralelas. En el dominio y en el glosario **no es un Club**: el tipo de dominio `ClubId` sigue siendo `penarol | nacional`, y se agrega un tipo para "Club o Selección" (por ejemplo `ClubOSeleccion`) que usan solo los módulos que sirven a los dos (Calendario, Conteo, Parcial, Herencia, Compartir, Notificaciones, Pixel).
- **El Club Favorito nunca puede ser la Selección.** `elegir_club_favorito` y el cambio de Club Favorito del Admin la rechazan.
- **Perfil "solo Selección"**: el perfil registra que el Hincha ya pasó por la elección de Club (eligiendo "solo Selección"), aparte de que `club_favorito_id` siga siendo nulo. Así el layout distingue "todavía no eligió" (va a la pantalla de elegir Club) de "eligió solo Selección" (entra a la Selección). Elegir Club más tarde usa la misma función que hoy, que solo fija el Club si era nulo.
- **Jugador sin número en la Selección**: el número pasa a ser obligatorio solo para Jugadores de un Club y nulo en la Selección. La validación de dominio de Planteles recibe a qué Plantel pertenece el Jugador.
- **Convocatoria**: tablas nuevas para la Convocatoria, sus Jugadores (elegibles del Plantel de la Selección) y los Partidos de la Selección a los que se aplica. Cada Partido tiene a lo sumo una Convocatoria. Lectura para cualquier usuario autenticado; escritura solo con `es_admin()`. Una vez que el Gran Ausente final de un Partido se publicó, su Convocatoria no se puede editar.
- **Preferencias de notificación**: dos interruptores por Hincha, "mi club" y "Selección", los dos prendidos por defecto.
- **Aviso de la Selección para Hinchas con Club**: se recuerda en el dispositivo que ya lo vieron; no hace falta guardarlo en la base.

### Calendario

- Se agrega una **regla de apertura de la Selección**: `abre(P) = max(P.creado_en, P.inicio − 14 días)`. No depende del Partido anterior, y por eso pueden superponerse dos Votaciones (ADR-0005). Cierre, anulación y postergación siguen igual.
- El Calendario expone las **Votaciones abiertas** de la Selección (en plural). La consulta de una sola abierta por Club se mantiene para los Clubes.
- La regla se replica en SQL en las funciones de Votación abierta y de Votación de un Partido, que hoy suponen una sola abierta por club. Las políticas de Alineación dejan de exigir que el Club del Partido sea el Club Favorito cuando el Partido es de la Selección: cualquier usuario autenticado con perfil puede tener Alineaciones de Partidos de la Selección; para los Clubes la regla no cambia.

### Herencia

- Al abrir una Votación de la Selección: si el Partido anterior de la Selección sigue con la Votación abierta, se copia la Alineación que el Hincha tiene en ese momento para ese Partido; si ya cerró, se hereda como hoy. En los dos casos se sacan los Jugadores no disponibles o fuera del Plantel.
- El módulo de Herencia recibe el Partido anterior junto con su estado de Votación, y no supone que está cerrado.

### Más Pedido y Gran Ausente

- Un **módulo de dominio nuevo** (por ejemplo `destacados`) recibe las **apariciones** (en cuántas Alineaciones figura cada Jugador, en cualquier Puesto, sobre el total de Alineaciones con al menos un Jugador) y, si existe, la Convocatoria. Devuelve una de tres cosas:
  - el **Más Pedido**, si no hay Convocatoria;
  - el **Gran Ausente**, si hay Convocatoria y algún no convocado aparece;
  - nada.
  Con empate devuelve todos los empatados; cada uno trae sus apariciones y su porcentaje.
- Las apariciones se calculan con las mismas Alineaciones que el Conteo, incluidas las heredadas (ADR-0002).
- **Al cierre** se congelan las apariciones de la Selección junto con el resultado inmutable de la Votación. El Gran Ausente final no se guarda: se deriva de las apariciones congeladas y la Convocatoria. Por eso, si la Convocatoria se carga después del cierre, aparece solo y no hace falta modificar el resultado. Que la Convocatoria quede fija (ver Modelo) garantiza que no cambie después.
- El Parcial de la Selección agrega el destacado provisorio a su vista.

### Notificaciones

- Tipos nuevos: Convocatoria cargada (con el Gran Ausente provisorio) y Gran Ausente final (con el 11 Elegido). Votación abierta y Cierra pronto se reutilizan para la Selección.
- El Gran Ausente final se avisa al cierre si ya hay Convocatoria, o cuando el Admin la carga si la Votación ya cerró.
- Los destinatarios de los avisos de la Selección son todos los Hinchas con la preferencia "Selección" prendida. Los de un Club son los de ese Club con "mi club" prendida. Cada aviso de la Selección nombra al Rival para que se distinga en una fecha doble.

### Compartir y pixel art

- La imagen del 11 Elegido de la Selección agrega el destacado: Gran Ausente, o Más Pedido mientras no lo hay.
- En la Selección, la cancha y las imágenes muestran el nombre completo, sin número. El largo máximo de nombre para la imagen se define para que entren los nombres reales (por ejemplo "Giorgian De Arrascaeta"); si no entra en una línea, va en dos, pero no se corta.
- Camisetas de la Selección: celeste la de campo y negra la de arquero. El escudo de la AUF va en pixel art de 48 px, con la misma validación que los escudos de los clubes.

### Interfaz

- Selector "mi club / Selección" en la barra para Hinchas con Club. Los Hinchas sin Club solo ven la Selección.
- En la Selección, si hay más de una Votación abierta, la pantalla deja elegir el Partido.
- La opción "Quiero votar solo por la Selección" va en el selector de Club del registro. La invitación a elegir Club aparece después de la primera Alineación de la Selección guardada y se puede descartar.
- Backoffice: el Plantel de la Selección dentro de Planteles; los Partidos de la Selección junto a los de los Clubes; una pantalla de Convocatoria con los elegibles y los Partidos de la Selección; el 11 Real como en los Clubes.

## Testing Decisions

- **Qué es un buen test acá**: prueba el comportamiento visible a través de la interfaz pública del módulo (entradas → salidas, o "este usuario puede o no puede hacer esto"), sin depender de cómo está implementado. Los nombres de los tests usan el vocabulario de `CONTEXT.md`.
- **Unidad (Vitest, `src/domain/`)**, siguiendo los tests que ya existen al lado de cada módulo:
  - Calendario: apertura a 14 días, `creado_en` posterior, fecha doble con dos abiertas, postergación, cancelación; los Clubes siguen con una sola abierta. Prior art: los tests del Calendario de Votación.
  - Destacados: Más Pedido sin Convocatoria, Gran Ausente con Convocatoria, empates, ningún no convocado elegido, Alineaciones vacías. Prior art: los tests del Conteo y de Cierre (Coincidencia).
  - Herencia: copia desde una Votación abierta y herencia desde una cerrada, sin no disponibles. Prior art: los tests de Herencia.
  - Notificaciones: tipos nuevos, destinatarios según preferencias, Hincha sin Club, fecha doble. Prior art: los tests de Notificaciones.
  - Planteles: número obligatorio en un Club y ausente en la Selección. Compartir: nombre completo sin número y el destacado. Pixel: camisetas de la Selección (snapshots como los de las camisetas actuales).
- **RLS (`tests/rls/`, contra Supabase local)**, un archivo nuevo para el feature (`seleccion-…`) con los helpers existentes:
  - Un Hincha de Peñarol, uno de Nacional y uno sin Club guardan Alineaciones de la Selección; ninguno lee la de otro.
  - Un Hincha sin Club no puede guardar Alineaciones de un Club.
  - Nadie puede elegir la Selección como Club Favorito; elegir "solo Selección" y después un Club funciona una sola vez.
  - Dos Votaciones de la Selección abiertas a la vez aceptan Alineaciones; fuera de la ventana de 14 días no.
  - La Convocatoria se lee con sesión y solo la escribe un Admin con 2FA; no se puede editar después de publicado el Gran Ausente final.
  - Un Jugador de la Selección sin número se acepta; uno de un Club sin número no.
  - Preferencias de notificación: cada Hincha lee y cambia solo las suyas.
  - Prior art: `09-alineacion`, `10-herencia`, `12-cierre`, `14-once-real`, `15-push`.
- **E2E (nuevo en el proyecto)**: Playwright contra la app en local con Supabase local. Pocos flujos y críticos:
  - Registro con "Quiero votar solo por la Selección" → arma y guarda una Alineación → aparece la invitación a elegir Club.
  - Hincha con Club → ve el aviso una sola vez → cambia con el selector entre su Club y la Selección.
  - Fecha doble → elige el Partido y arma los dos.
  Es infraestructura nueva: script `test:e2e`, datos de ejemplo propios en un seed nuevo y usuarios creados por el test. No entra en el `npm test` por defecto, y sí en la checklist de "antes de terminar" de los tickets del feature.

## Out of Scope

- Otras selecciones (femenina, juveniles) y otros clubes.
- Resultados separados por hinchada (los datos lo permiten, pero no se muestra).
- Plantel de la Selección cargado automáticamente desde los Planteles de los Clubes o desde una fuente externa.
- Que un Jugador sea el mismo en un Club y en la Selección (Disponibilidad compartida).
- Clasificar los Partidos por torneo (Eliminatorias, Copa América, amistosos).
- Cambiar la regla de apertura de los Clubes.
- Guardar en la base que el Hincha ya vio el aviso de la Selección.

## Further Notes

- Glosario actualizado en `CONTEXT.md`: Selección, Convocatoria, Gran Ausente, Más Pedido, y los cambios en Hincha, Club Favorito, Plantel, Jugador, Camiseta, Votación, Alineación y Parcial.
- ADR-0005: Votaciones superpuestas en la Selección. Respetar ADR-0001 (agregación del 11 Elegido, que no cambia) y ADR-0002 (sin envío: las heredadas y copiadas cuentan).
- Migraciones nuevas con timestamp (`npm run db:new`); no editar las existentes. Las funciones SQL de Votación abierta se reemplazan en una migración nueva.
- El escudo de la AUF es una marca de terceros, igual que los escudos de los clubes que ya usa la app.

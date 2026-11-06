Status: ready-for-agent

# Spec: Elegilos Vos — MVP

## Problem Statement

Los hinchas de Peñarol y Nacional opinan todo el tiempo sobre quién tendría que jugar, pero no tienen un lugar donde esa opinión se registre, se sume a la de los demás y se compare con lo que finalmente decide el DT. Además, el Admin necesita una forma simple de mantener los Planteles, la Disponibilidad de los Jugadores y el calendario de Partidos para que la Votación refleje la realidad de cada semana.

## Solution

Una web responsive (pensada para celular) donde cada Hincha, registrado con Google o con email verificado, elige su Club Favorito y arma la Alineación de su Club para el próximo Partido. Elige un Esquema y arrastra Jugadores a los Puestos. La Alineación se guarda sola, sin botón de enviar, y la que está guardada al cierre de la Votación (1 hora antes del Partido) es su voto. Mientras la Votación está abierta, el Hincha ve el Parcial en vivo. Al cierre se calcula y congela el 11 Elegido, que se compara con la Alineación de cada Hincha y, más tarde, con el 11 Real que carga el Admin.

El Admin tiene un backoffice dentro de la misma app para gestionar Rivales (con escudo), Partidos, Planteles, Disponibilidad y el 11 Real.

## User Stories

### Registro y cuenta

1. Como visitante, quiero registrarme con mi cuenta de Google, para empezar a votar sin crear una contraseña nueva.
2. Como visitante sin cuenta de Google, quiero registrarme con email y contraseña, para poder participar igual.
3. Como visitante que se registra con email, quiero recibir un código de verificación, para confirmar que el email es mío y activar la cuenta.
4. Como visitante, quiero poder pedir que me reenvíen el código de verificación, para no quedar trabado si no me llegó.
5. Como Hincha, quiero iniciar sesión con el mismo método con el que me registré, para volver a mi Alineación.
6. Como Hincha que olvidó su contraseña, quiero recuperarla por email, para no perder mi cuenta.
7. Como Hincha nuevo, quiero elegir mi Club Favorito (Peñarol o Nacional) al registrarme, para armar la Alineación de mi Club.
8. Como Hincha, quiero que se me avise que el Club Favorito no se puede cambiar, para elegir con cuidado.
9. Como Hincha, quiero borrar mi cuenta y mis datos, para no dejar información personal en la app.
10. Como Hincha, quiero que nadie más pueda ver mi email, mi nombre ni mi Alineación, para mantener mi privacidad.
11. Como Admin, quiero que los intentos de login y los reenvíos de código tengan un límite, para frenar abusos y ataques de fuerza bruta.

### Partido y Votación

12. Como Hincha, quiero ver el próximo Partido de mi Club (Rival, escudo, fecha y hora), para saber para qué estoy armando la Alineación.
13. Como Hincha, quiero ver cuánto falta para el cierre de la Votación, para no quedarme afuera.
14. Como Hincha, quiero que la Votación abra sola cuando termina el Partido anterior de mi Club, para poder empezar a armar la siguiente Alineación enseguida.
15. Como Hincha, quiero ver un mensaje claro cuando no hay Votación abierta (por ejemplo, durante un Partido o si no hay Partido cargado), para entender por qué no puedo editar.
16. Como Hincha, quiero que si el Partido se posterga, la Votación siga abierta con mi Alineación intacta y el nuevo horario de cierre, para no perder lo que armé.
17. Como Hincha, quiero enterarme si un Partido se cancela, para entender por qué esa Votación no tuvo 11 Elegido.

### Armado de la Alineación

18. Como Hincha, quiero elegir un Esquema de una lista predefinida, para definir cómo juega mi equipo.
19. Como Hincha, quiero ver los Jugadores Disponibles del Plantel de mi Club con su número y su posición natural, para elegir entre ellos.
20. Como Hincha, quiero arrastrar un Jugador a un Puesto de la cancha, para ubicarlo en mi Alineación.
21. Como Hincha, quiero que al soltar un Jugador sobre un Puesto ocupado los dos se intercambien, para reorganizar rápido sin pasos extra.
22. Como Hincha, quiero que al soltar en un Puesto ocupado un Jugador que viene del Plantel, el que estaba vuelva al Plantel, para reemplazar con un solo gesto.
23. Como Hincha, quiero sacar un Jugador de la cancha, para dejar ese Puesto vacío o elegir a otro.
24. Como Hincha, quiero que un mismo Jugador no pueda estar en dos Puestos a la vez, para que mi Alineación sea coherente.
25. Como Hincha, quiero que el Puesto de arquero solo acepte arqueros y que los arqueros solo vayan al arco, para no armar una Alineación absurda.
26. Como Hincha, quiero que al cambiar de Esquema mis Jugadores se reubiquen en los Puestos equivalentes, para no tener que armar todo de nuevo.
27. Como Hincha, quiero que si dos Jugadores caen en el mismo Puesto al cambiar de Esquema, uno vuelva al Plantel y quede una vacante, para resolverlo yo después.
28. Como Hincha, quiero que cada cambio se guarde solo, para no tener que acordarme de enviar nada.
29. Como Hincha, quiero ver que mi Alineación quedó guardada, para estar tranquilo de que cuenta.
30. Como Hincha, quiero poder dejar Puestos vacíos, para que en esos Puestos decidan los votos de los demás Hinchas.
31. Como Hincha, quiero cambiar mi Alineación todas las veces que quiera hasta el cierre, para ajustarla con las últimas noticias.
32. Como Hincha, quiero que al abrir una Votación nueva aparezca precargada mi Alineación del Partido anterior, para no empezar de cero.
33. Como Hincha, quiero que de la Alineación heredada se quiten los Jugadores que ya no están Disponibles o que dejaron el Plantel, para que mi voto sea válido.
34. Como Hincha que no entra a la app en toda la semana, quiero que mi Alineación heredada cuente igual como voto, para seguir participando sin esfuerzo.
35. Como Hincha, quiero que si dejo la cancha vacía no se cuente ningún voto de Esquema a mi nombre, para no inflar el Esquema por defecto.
36. Como Hincha, quiero ver el motivo cuando un Jugador no está Disponible (Lesionado, Suspendido, No disponible), para entender por qué no lo puedo elegir.
37. Como Hincha, quiero que se me avise si un Jugador de mi Alineación dejó de estar Disponible, para reemplazarlo si quiero.
38. Como Hincha, quiero que la edición quede bloqueada una vez cerrada la Votación, para que el resultado sea justo.
39. Como Hincha, quiero poder armar la Alineación cómodamente desde el celular (con arrastre táctil), para usar la app donde estoy.

### Parcial y resultados

40. Como Hincha, quiero ver en vivo el Parcial (el 11 que va ganando), para saber qué piensa la hinchada.
41. Como Hincha, quiero ver el porcentaje de cada Esquema en el Parcial, para entender cuál prefiere la mayoría.
42. Como Hincha, quiero ver el porcentaje de cada candidato en cada Puesto, para ver qué tan reñido está.
43. Como Hincha, quiero ver el 11 Elegido cuando cierra la Votación, para conocer el resultado final.
44. Como Hincha, quiero ver mi Coincidencia con el 11 Elegido (por ejemplo, "8 de 11"), para comparar mi criterio con el de la hinchada.
45. Como Hincha, quiero ver la Coincidencia entre el 11 Elegido y el 11 Real, para saber si el DT pensó como la hinchada.
46. Como Hincha, quiero ver el historial de 11 Elegidos de mi Club con Rival y fecha, para recordar Partidos anteriores.
47. Como Hincha, quiero que el 11 Elegido de un Partido no cambie nunca después del cierre, para que el historial sea confiable.
48. Como Hincha, quiero que los votos a un Jugador que no está Disponible al cierre no cuenten, para que el 11 Elegido no incluya a un lesionado.
49. Como Hincha, quiero que el 11 Elegido tenga siempre 11 Jugadores distintos, para que sea un equipo posible.
50. Como Hincha, quiero que todas las Alineaciones aporten al 11 Elegido aunque usen otro Esquema, para que el resultado represente a toda la hinchada.

### Compartir

51. Como Hincha, quiero generar una imagen de mi Alineación para compartir en redes, para mostrar mi equipo.
52. Como Hincha, quiero generar una imagen del 11 Elegido para compartir en redes, para difundir lo que eligió la hinchada.

### Notificaciones

53. Como Hincha, quiero activar las notificaciones push del navegador, para enterarme de lo importante sin entrar a la app.
54. Como Hincha, quiero que me avisen cuando abre la Votación de un nuevo Partido de mi Club, para empezar a armar mi Alineación.
55. Como Hincha, quiero que me avisen cuando falta poco para el cierre, para no olvidarme de revisar mi Alineación.
56. Como Hincha, quiero que me avisen cuando sale el 11 Elegido, para verlo enseguida.
57. Como Hincha, quiero que me avisen cuando un Jugador de mi Alineación deja de estar Disponible, para reemplazarlo antes del cierre.
58. Como Hincha, quiero desactivar las notificaciones cuando quiera, para controlar lo que recibo.
59. Como Hincha con iPhone, quiero saber que para recibir notificaciones tengo que agregar la web a la pantalla de inicio, para poder activarlas.

### Backoffice (Admin)

60. Como Admin, quiero entrar al backoffice con segundo factor obligatorio, para que nadie pueda tomar control de la app con solo mi contraseña.
61. Como Admin, quiero que el backoffice sea inaccesible para cualquier cuenta que no tenga el rol de Admin, aunque conozca la URL.
62. Como Admin, quiero crear, editar y dar de baja Rivales con nombre y escudo, para reutilizarlos en distintos Partidos.
63. Como Admin, quiero subir la imagen del escudo de un Rival, para que se muestre en el Partido.
64. Como Admin, quiero cargar un Partido eligiendo Club, Rival, fecha y hora, para que se abra su Votación.
65. Como Admin, quiero cargar el Clásico como un Partido para cada Club, con el otro Club como Rival, para que cada hinchada vote lo suyo.
66. Como Admin, quiero cambiar la fecha u hora de un Partido, para reflejar una postergación sin perder las Alineaciones.
67. Como Admin, quiero cancelar un Partido, para anular su Votación y que se abra la del siguiente.
68. Como Admin, quiero dar de alta Jugadores en el Plantel de un Club con nombre, número, posición natural y foto opcional, para mantener el Plantel al día.
69. Como Admin, quiero editar los datos de un Jugador, para corregir errores o cambios de número.
70. Como Admin, quiero dar de baja a un Jugador del Plantel sin borrarlo, para que desaparezca de la elección pero siga en el historial.
71. Como Admin, quiero cambiar la Disponibilidad de un Jugador (Disponible, Lesionado, Suspendido, No disponible), para que la Votación abierta refleje la realidad.
72. Como Admin, quiero cargar el 11 Real de un Partido marcando 11 Jugadores, para compararlo con el 11 Elegido.
73. Como Admin, quiero cambiar el Club Favorito de un Hincha cuando me lo pide, para resolver errores al registrarse.
74. Como Admin, quiero ver un resumen de cada Votación (cantidad de Alineaciones que cuentan, Parcial), para seguir la participación.
75. Como Admin, quiero que las horas se carguen y muestren en hora de Uruguay, para no confundirme con zonas horarias.

### Seguridad y repo público

76. Como dueño del proyecto, quiero que el repo pueda ser público sin exponer ningún secreto, para compartir el código tranquilo.
77. Como dueño del proyecto, quiero que las reglas de acceso se apliquen en la base de datos, para que un cliente modificado no pueda saltearlas.
78. Como dueño del proyecto, quiero que un Hincha solo pueda escribir su propia Alineación, solo de su Club y solo mientras la Votación está abierta.
79. Como dueño del proyecto, quiero que el Parcial y el 11 Elegido se expongan solo como agregados, para que no se pueda reconstruir el voto de un Hincha.

## Implementation Decisions

### Stack y arquitectura

- Next.js (App Router) con TypeScript, deploy en Vercel. Supabase para Postgres, Auth y Storage (ver ADR-0003).
- Toda la autorización vive en Postgres con Row Level Security. El cliente usa solo la anon key. La service role key se usa solo en el servidor (cálculo del cierre, envío de push) y nunca llega al navegador. Los secretos van en variables de entorno, y en el repo hay solo un `.env.example`.
- Las horas se guardan en UTC y se muestran y cargan en America/Montevideo.
- Las reglas de negocio viven en módulos de lógica pura, sin dependencias de UI ni de base de datos, que se usan desde el servidor (y desde el cliente cuando aplica). Son los cuatro módulos que se describen abajo.

### Módulo: Catálogo de Esquemas

- Una definición estática en el código: la lista de Esquemas (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2, 4-1-4-1). Cada uno tiene 11 Puestos con un identificador estable, una etiqueta, coordenadas para dibujarlo en la cancha y una marca de "es arquero".
- Incluye la Tabla de Equivalencias, que para cada par (Esquema origen, Esquema destino) asocia cada Puesto de origen con un Puesto de destino. Es escrita a mano y se valida con un test que exige que esté completa y que el arquero se asocie siempre con el arquero.
- Hay un Esquema por defecto, que solo se usa para mostrar.

### Módulo: Editor de Alineación (lógica pura)

- Estado: el Esquema, un mapa de Puesto a Jugador (o vacío), una marca de si el Esquema se eligió a mano y la hora de la última modificación de cada Puesto.
- Operaciones: colocar un Jugador desde el Plantel en un Puesto (si está ocupado, el anterior vuelve al Plantel), mover entre Puestos (si el destino está ocupado, se intercambian), quitar un Jugador, cambiar de Esquema (reubicación por la Tabla de Equivalencias; si hay colisión, uno vuelve al Plantel), heredar una Alineación (filtrando los Jugadores no Disponibles o fuera del Plantel).
- Invariantes: un Jugador está en un solo Puesto, y el arquero solo va al Puesto de arquero (y viceversa). Si una operación viola una invariante, se rechaza y el estado no cambia.
- La UI de drag and drop (con soporte táctil) solo despacha estas operaciones. La persistencia es automática y con debounce.

### Módulo: Calendario de Votación (lógica pura)

- Entrada: los Partidos de un Club (con inicio y estado programado o cancelado) y la hora actual. Salida: el estado de cada Partido (pendiente, abierta, cerrada, anulada) y sus horas de apertura y cierre.
- Reglas:
  - El cierre es el inicio menos 1 hora.
  - Un Partido se considera terminado en el inicio más 2 horas.
  - La Votación de un Partido abre cuando termina el Partido anterior no cancelado del mismo Club, o cuando se carga si no hay uno anterior.
  - Hay a lo sumo una Votación abierta por Club.
  - Un Partido cancelado anula su Votación.
  - Si se cambia el horario, se recalculan las horas y se conservan las Alineaciones.

### Módulo: Motor de Conteo (lógica pura)

- Entrada: las Alineaciones de una Votación, la Disponibilidad de los Jugadores, el Catálogo de Esquemas y la Tabla de Equivalencias. Salida: el resultado completo (porcentajes por Esquema, votos por Puesto y por candidato, el 11 asignado). Se usa tanto para el Parcial como para el 11 Elegido.
- Algoritmo (ver ADR-0001):
  1. Las Alineaciones que no tienen ningún Jugador colocado ni un Esquema elegido a mano no cuentan.
  2. Se elige el Esquema más votado.
  3. Cada Jugador colocado en cada Alineación suma un voto al Puesto equivalente del Esquema ganador. Se descartan los votos a Jugadores que no están Disponibles o que dejaron el Plantel. Si dos Puestos de origen caen en el mismo Puesto de destino, los dos Jugadores suman votos ahí.
  4. Una asignación óptima (algoritmo húngaro) elige 11 Jugadores distintos que maximizan el total de votos, respetando la regla del arquero. Los Puestos sin votos válidos se completan con los Disponibles que más votos tengan en otros Puestos, y como último recurso con cualquier Disponible de la posición adecuada.
  5. Empates: gana la opción cuyos votos tienen la menor hora de última modificación del Puesto (se consolidaron antes). Si siguen empatados, decide un orden fijo (orden del catálogo o número de camiseta), para que el resultado sea siempre determinístico.
- El resultado es determinístico y reproducible a partir de la misma entrada.

### Modelo de datos (alto nivel)

- **Club**: valores fijos (Peñarol, Nacional), con su escudo propio.
- **Rival**: nombre, escudo en Storage y marca de activo.
- **Partido**: Club, Rival, inicio y estado (programado o cancelado).
- **Jugador**: Club, nombre, número, posición natural, foto opcional, marca de pertenencia al Plantel, Disponibilidad y motivo.
- **Hincha (perfil)**: vinculado al usuario de Auth, con el Club Favorito (no lo puede editar el propio Hincha) y el rol (Hincha o Admin).
- **Alineación**: Hincha y Partido (únicos por par), Esquema, marca de Esquema elegido a mano y, por cada Puesto, el Jugador y la hora de modificación. Solo la puede leer y escribir su dueño, y solo con la Votación abierta y para el Club Favorito.
- **Resultado de Votación (11 Elegido)**: Partido, Esquema ganador, Jugador por Puesto, el detalle de votos congelado y la hora de cálculo. Es inmutable.
- **11 Real**: Partido y los 11 Jugadores.
- **Suscripción push**: Hincha y datos de la suscripción. Solo la ve su dueño.
- El Parcial se expone con una vista o función agregada (security definer) que devuelve solo totales.

### Procesos programados

- Un job periódico (cron de Vercel o de Supabase) hace dos cosas:
  - Cierra las Votaciones vencidas: ejecuta el Motor de Conteo con la Disponibilidad del momento del cierre y persiste el 11 Elegido, sin volver a calcularlo nunca.
  - Envía las notificaciones push que corresponden (abrió la Votación, cierra pronto a 3 horas del cierre, salió el 11 Elegido).
- La notificación "un Jugador tuyo no está Disponible" se dispara cuando el Admin cambia una Disponibilidad.
- El cierre es idempotente: correrlo dos veces no cambia el resultado.

### Auth y seguridad

- Supabase Auth con Google OAuth y con email y contraseña, verificando el email con un código (OTP).
- Rate limiting en login y reenvío de códigos (con la configuración de Supabase, más un límite propio en las rutas del servidor si hace falta).
- El rol de Admin se guarda en la base de datos y se exige en RLS y en el servidor. El acceso al backoffice exige 2FA (TOTP de Supabase, nivel AAL2).
- Al borrar una cuenta se eliminan el perfil, las Alineaciones y las suscripciones. Si había una Votación abierta, esa Alineación deja de contar; los 11 Elegidos ya congelados no cambian.
- Storage: el bucket de escudos y fotos tiene lectura pública y escritura solo para el Admin.

### Compartir

- Se genera una imagen en el servidor (Open Graph o un endpoint de imagen) de la Alineación propia o del 11 Elegido. La imagen de la Alineación propia solo la puede generar su dueño.

### Notificaciones

- Web Push con claves VAPID (la privada va en una variable de entorno) y un service worker. La web es instalable como PWA para soportar iOS.

## Testing Decisions

- Un buen test verifica comportamiento observable desde la interfaz pública del módulo (entradas y salidas, o efectos permitidos y prohibidos), no detalles internos. Los tests no deberían romperse si se reescribe la implementación.
- Puntos de testeo acordados:
  1. **Motor de Conteo**: esquema ganador; mapeo entre Esquemas; asignación óptima cuando un Jugador gana en dos Puestos; descarte de no Disponibles; completado de vacantes; desempate por hora y por orden fijo; Alineaciones vacías que no cuentan; resultado determinístico.
  2. **Editor de Alineación**: colocar, intercambiar, reemplazar desde el Plantel, quitar; regla del arquero; cambio de Esquema con colisiones; herencia filtrando no Disponibles; invariante de no duplicar Jugadores.
  3. **Calendario de Votación**: apertura tras el Partido anterior; cierre a inicio menos 1 hora; un Club sin Partidos; Partidos consecutivos; postergación; cancelación; nunca más de una Votación abierta por Club; bordes exactos de hora en America/Montevideo.
  4. **Políticas de acceso (RLS)**: tests de integración contra un Supabase local que, como Hincha A, intentan leer o escribir la Alineación de B, escribir para el otro Club, escribir con la Votación cerrada, cambiar su Club Favorito, modificar un 11 Elegido o escribir en las tablas de Admin, y verifican que todo se rechace. Como Admin sin AAL2, el acceso al backoffice se rechaza.
  - Además, un test del Catálogo de Esquemas que valida que la Tabla de Equivalencias esté completa y sea consistente.
- No hay código previo en el repo. Este spec establece el estilo de tests: Vitest para los módulos puros y Supabase CLI local para los tests de RLS.
- Desarrollo test-first (TDD) en los módulos puros.

## Out of Scope

- Diseño visual e identidad gráfica (es una etapa aparte; esta spec solo cubre funcionalidad).
- Comentarios de Hinchas.
- Notificaciones por email (solo web push).
- App nativa iOS/Android.
- Suplentes, capitán y DT en la Alineación.
- Posicionamiento libre en la cancha.
- Esquemas cargados desde el backoffice.
- Importar Planteles o Partidos desde APIs externas.
- Perfiles públicos o alias de Hinchas.
- Que el Hincha pueda cambiar su Club Favorito por su cuenta.
- Captcha en el registro.
- Tests end-to-end en el navegador.

## Further Notes

- Referencias: el glosario está en `CONTEXT.md` y las decisiones en `docs/adr/` (0001 conteo, 0002 Alineación sin envío, 0003 stack y seguridad).
- Riesgo de manipulación aceptado: un usuario puede crear muchas cuentas con emails verificados. Se acepta de forma explícita.
- La Tabla de Equivalencias es la pieza más discutible del dominio. Conviene revisarla con el dueño del producto antes de darla por cerrada.
- Las Alineaciones heredadas cuentan como voto aunque el Hincha esté inactivo. Es una decisión deliberada (ADR-0002).

## Decisiones posteriores al code review (2026-11-06)

- **Procesos programados**: los dispara la base (pg_cron + pg_net cada minuto, con la URL y el secreto en Supabase Vault); no se usan crons de Vercel.
- **Parcial**: se muestra sin mínimo de Alineaciones. El riesgo de reconstruir una Alineación con muy pocos votos se acepta.
- **Funciones de Admin agregadas** (no estaban en las historias originales; se conservan porque sirven para corregir errores de carga): borrar un Partido sin Alineaciones ni resultado, reactivar un Partido cancelado mientras su Votación no haya cerrado, borrar un Rival sin Partidos y borrar el 11 Real.
- **Partido suspendido después del cierre**: el Admin puede postergarlo o cancelarlo. El 11 Elegido queda congelado y la Votación no se reabre.
- **Herencia**: cada Hincha hereda su Alineación más reciente del Club, aunque el Partido inmediatamente anterior no haya tenido Votación.
- **Cambio de Club Favorito por el Admin**: solo cuentan las Alineaciones de Hinchas que hoy son del Club del Partido.

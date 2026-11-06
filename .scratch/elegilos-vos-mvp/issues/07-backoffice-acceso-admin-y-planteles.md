# 07: Backoffice: acceso Admin y Planteles

**What to build:** Un backoffice dentro de la app, accesible solo para cuentas con rol de Admin y sesión con 2FA (TOTP, nivel AAL2). Incluye el enrolamiento del segundo factor para el Admin. El Admin puede:
- Dar de alta, editar y dar de baja (baja lógica) Jugadores del Plantel de cada Club, con foto opcional subida a Storage.
- Cambiar la Disponibilidad de un Jugador (Disponible, Lesionado, Suspendido, No disponible) con su motivo.
- Cambiar el Club Favorito de un Hincha.

El cambio de Disponibilidad deja un registro (evento) que usarán los tickets 10 y 15 para avisar a los Hinchas. La UI es funcional y mínima.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Una cuenta sin rol de Admin no accede al backoffice, ni por URL ni por API
- [ ] Un Admin sin 2FA verificado en la sesión no puede hacer ninguna escritura de Admin
- [ ] Alta, edición y baja lógica de Jugadores funcionan; los dados de baja no aparecen como elegibles
- [ ] La Disponibilidad con motivo se puede cambiar y queda registrado el evento del cambio
- [ ] El Admin puede cambiar el Club Favorito de un Hincha
- [ ] Storage de fotos: lectura pública, escritura solo para el Admin
- [ ] Tests de RLS: un Hincha no puede escribir Jugadores, Disponibilidad, perfiles ajenos ni Storage

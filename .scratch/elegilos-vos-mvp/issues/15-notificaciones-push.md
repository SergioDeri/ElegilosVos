# 15: Notificaciones push

**What to build:** La web es instalable como PWA (con manifest y service worker). El Hincha activa o desactiva las notificaciones push del navegador desde su perfil; en iOS se le explica que primero tiene que agregar la web a la pantalla de inicio. Las suscripciones se guardan por Hincha (solo las ve su dueño) y se envían con claves VAPID (la privada solo en una variable de entorno). Hay cuatro eventos:
- Abrió la Votación de su Club.
- Cierra pronto (3 horas antes del cierre).
- Salió el 11 Elegido.
- Un Jugador de su Alineación dejó de estar Disponible (a partir del evento de cambio de Disponibilidad).

Cada notificación se envía una sola vez por Hincha y por evento. Las suscripciones vencidas se limpian.

**Blocked by:** 07, 12

**Status:** ready-for-agent

- [ ] El Hincha puede activar y desactivar las notificaciones; en iOS ve las instrucciones de PWA
- [ ] Los cuatro eventos disparan su notificación solo a los Hinchas del Club que corresponde
- [ ] No se envían duplicados (registro de enviados idempotente)
- [ ] Las suscripciones inválidas (410) se eliminan
- [ ] Tests de RLS: un Hincha no puede leer suscripciones ajenas
- [ ] La clave privada VAPID nunca llega al cliente

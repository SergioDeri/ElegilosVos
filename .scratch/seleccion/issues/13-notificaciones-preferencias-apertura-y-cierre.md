# 13: Notificaciones: preferencias, apertura y cierre

**What to build:** Cada Hincha tiene dos interruptores de notificaciones, "mi club" y "Selección", prendidos por defecto; un Hincha sin Club solo ve el de la Selección. Los avisos de Votación abierta y Cierra pronto se mandan también para la Selección, a todos los Hinchas con "Selección" prendido, y nombran al Rival para que se distingan en una fecha doble. Los avisos de los Clubes respetan "mi club".

**Blocked by:** 05

**Status:** resolved

- [x] Interruptores "mi club" y "Selección" en la cuenta, prendidos por defecto
- [x] Avisos de Votación abierta y Cierra pronto para la Selección, uno por Partido en fecha doble, con el Rival
- [x] Destinatarios según preferencias, incluidos Hinchas sin Club, con tests de dominio
- [x] Tests de RLS: cada Hincha lee y cambia solo sus preferencias
- [x] Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls` && npm run test:e2e

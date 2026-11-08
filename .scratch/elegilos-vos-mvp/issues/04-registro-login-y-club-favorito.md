# 04: Registro, login y Club Favorito

**What to build:** Un visitante se registra con Google o con email y contraseña (verificando el email con un código OTP, con opción de reenviarlo), inicia sesión, recupera su contraseña y, la primera vez, elige su Club Favorito, que queda fijo. Rate limiting en el login y en el reenvío de códigos. Las rutas de la app exigen sesión y Club Favorito elegido. El Hincha no puede ver ni modificar el perfil de otros ni cambiar su propio Club Favorito o su rol. La UI es funcional y mínima; el diseño va en una etapa aparte.

**Blocked by:** 01

**Status:** resolved

- [ ] Registro e inicio de sesión con Google funcionando (con instrucciones en el README para configurar las credenciales en local)
- [ ] Registro con email y contraseña; sin verificar el código no se puede usar la app
- [ ] El código de verificación se puede reenviar, con límite de frecuencia
- [ ] La contraseña se puede recuperar
- [ ] Hay límite de intentos de login
- [ ] Un Hincha sin Club Favorito es llevado a elegirlo; una vez elegido, la UI no permite cambiarlo y avisa antes de confirmar
- [ ] Tests de RLS: un Hincha no puede leer perfiles ajenos, ni cambiar su Club Favorito o su rol (ni siquiera con llamadas directas a la API)

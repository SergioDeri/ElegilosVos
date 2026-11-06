# 17: Revisión de seguridad antes de publicar

**What to build:** Auditoría final antes de hacer el commit inicial y publicar el repo:
- Escaneo de secretos en todo el árbol (por ejemplo, gitleaks).
- Todas las tablas con RLS habilitado y políticas revisadas.
- Ninguna función security definer que filtre datos individuales.
- La service role key y la clave privada VAPID solo se usan en el servidor.
- Los buckets de Storage con las políticas correctas.
- Los endpoints de cron protegidos.
- Las cabeceras de seguridad básicas configuradas.
- Toda la suite de tests (lógica pura y RLS) en verde.

Se corrige lo que aparezca y se documenta en el README cómo configurar los secretos en Vercel y Supabase.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16

**Status:** ready-for-agent

- [ ] El escaneo de secretos no encuentra nada
- [ ] Una consulta al catálogo de Postgres confirma que todas las tablas públicas tienen RLS habilitado
- [ ] Un grep confirma que la service role key y la VAPID privada no se usan en código de cliente
- [ ] Toda la suite de tests pasa
- [ ] El README documenta las variables de entorno y el deploy sin exponer valores

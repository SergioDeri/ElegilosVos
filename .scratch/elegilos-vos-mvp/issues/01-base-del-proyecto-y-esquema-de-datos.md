# 01: Base del proyecto y esquema de datos

**What to build:** El esqueleto sobre el que trabajan todos los demás tickets en paralelo. Un proyecto Next.js (App Router, TypeScript estricto) con Vitest configurado y Supabase local (CLI) andando. El esquema inicial del dominio: Club (Peñarol y Nacional fijos), Rival, Partido (Club, Rival, inicio en UTC, estado programado/cancelado), Jugador (Club, nombre, número, posición natural ARQ/DEF/MED/DEL, foto opcional, pertenencia al Plantel, Disponibilidad y motivo) y perfil de Hincha (vinculado al usuario de Auth, Club Favorito, rol Hincha/Admin). RLS habilitado en todas las tablas con política de denegación por defecto (cada ticket abre lo que necesita). Datos de ejemplo: los dos Planteles, algunos Rivales y Partidos de prueba. Un `.env.example` sin secretos reales. Scripts para correr los tests de lógica pura y los de RLS (Vitest contra Supabase local), más un helper de tests para crear usuarios de prueba (Hincha de cada Club y Admin).

Convenciones para el trabajo en paralelo (documentarlas en el README):
- Las migraciones usan timestamp en el nombre; cada ticket agrega las suyas sin editar las ajenas.
- Los módulos de lógica pura viven en un área propia, sin depender de Next ni de Supabase.
- Las horas se guardan en UTC y se muestran en America/Montevideo.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [ ] El proyecto levanta en local, junto con Supabase local
- [ ] Las migraciones crean las tablas del dominio con RLS habilitado y sin políticas abiertas
- [ ] Los datos de ejemplo cargan los dos Planteles, algunos Rivales y algunos Partidos
- [ ] Un test de RLS de ejemplo demuestra que un usuario anónimo no puede leer los perfiles
- [ ] El `.env.example` documenta todas las variables, y el `.gitignore` excluye los `.env` reales
- [ ] El README explica cómo levantar el proyecto, cómo correr los tests y las convenciones de trabajo en paralelo

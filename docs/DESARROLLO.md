# Elegilos Vos — guía de desarrollo

Los hinchas de Peñarol y Nacional arman la alineación titular de su Club para cada Partido. Al cierre, las Alineaciones de todos se agregan en un 11 Elegido por la hinchada.

- Glosario del dominio: [`CONTEXT.md`](../CONTEXT.md) (usá ese vocabulario en el código).
- Decisiones de arquitectura: [`docs/adr/`](adr/).
- Spec y tickets del MVP: `.scratch/elegilos-vos-mvp/`.

## Stack

- Next.js 16 (App Router) + TypeScript estricto. Deploy en Vercel, con las funciones fijadas en `gru1` (São Paulo) por `vercel.json`: Supabase está en `sa-east-1` y cada página hace varias consultas en serie, así que con la región por defecto (`iad1`, Washington) cada click tardaba más de un segundo. No cambiar una región sin la otra.
- Supabase (Postgres + Auth + Storage). **Toda la autorización vive en Postgres con RLS** (ADR-0003).
- Vitest para tests de lógica pura y tests de RLS contra Supabase local.
- npm (no pnpm ni yarn).

## Requisitos

- Node.js 24 y npm.
- Docker (Docker Desktop) corriendo, para Supabase local.
- Para los tests E2E, el Chromium de Playwright (una vez por máquina): `npx playwright install chromium`.

## Levantar el proyecto en local

```bash
npm install
npx supabase start          # levanta Postgres, Auth, Storage, Studio (Docker)
npx supabase db reset       # aplica migraciones + datos de ejemplo
cp .env.example .env.local  # y completá las claves (ver abajo)
npm run dev                 # http://localhost:3000
```

Para completar `.env.local` en local, `npx supabase status` muestra `API_URL`, `ANON_KEY` y `SERVICE_ROLE_KEY`. Studio queda en http://127.0.0.1:54323 y Mailpit (emails de Auth) en http://127.0.0.1:54324.

Para frenar Supabase: `npx supabase stop`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Next. |
| `npm run build` | Build de producción. |
| `npm test` | Alias de `test:unit`. |
| `npm run test:unit` | Tests de lógica pura (`src/**/*.test.ts`). Sin red ni Docker. |
| `npm run test:rls` | Tests de políticas de acceso (`tests/rls/**/*.test.ts`) contra Supabase local. Requiere `npx supabase start`. |
| `npm run test:e2e` | Tests E2E con Playwright (`tests/e2e/**/*.spec.ts`) contra la app en local y Supabase local. No entran en `npm test`. Ver [Tests E2E](#tests-e2e). |
| `npm run test:watch` | Tests de lógica pura en modo watch. |
| `npm run typecheck` | `next typegen` + `tsc --noEmit`. |
| `npm run lint` | ESLint (incluye la regla de pureza de `src/domain`). |
| `npm run db:start` / `db:stop` | `supabase start` / `supabase stop`. |
| `npm run db:reset` | Recrea la base local: migraciones + seeds. |
| `npm run db:new -- <nombre>` | Crea una migración nueva con timestamp. |
| `npm run db:types` | Regenera `src/lib/supabase/database.types.ts` desde la base local. |

## Estructura

```
src/
  app/                    Rutas de Next (App Router). UI mínima: el diseño es una etapa aparte.
  domain/                 Lógica pura del dominio. SIN Next, React ni Supabase (lo exige ESLint).
    comun/                Tipos compartidos (ClubId, PosicionNatural, Disponibilidad, Rol...) y guards (esClubId, esUuid), textos compartidos (NOMBRE_CLUB, NOMBRE_DISPONIBILIDAD) y horario UY.
    esquemas/             Catálogo de Esquemas y Tabla de Equivalencias (ticket 02).
    calendario/           Calendario de Votación (ticket 03).
    conteo/               Motor de Conteo (ticket 05).
    editor/               Editor de Alineación (ticket 06).
  lib/supabase/
    client.ts             crearClienteNavegador()  → Client Components (anon key + sesión).
    server.ts             crearClienteServidor()   → Server Components / Actions / Route Handlers.
    admin.ts              crearClienteAdmin()      → SERVICE ROLE, solo servidor (`server-only`).
    database.types.ts     Tipos generados (`npm run db:types`). No editar a mano.
supabase/
  config.toml             Config de Supabase local.
  migrations/             Migraciones SQL con timestamp.
  seed.sql                Datos de ejemplo base (Rivales, Planteles, Partidos).
  seeds/                  Seeds adicionales por ticket (se cargan después de seed.sql, en orden alfabético).
tests/rls/                Tests de RLS + helpers (usuarios de prueba, clientes autenticados).
tests/e2e/                Tests E2E con Playwright + helpers (Hinchas de prueba, login). Config en playwright.config.ts.
```

## Modelo de datos (base)

Migración `supabase/migrations/20261106120000_esquema_base.sql`:

- `club` (`id` = `'penarol' | 'nacional'`, fijos, cargados en la migración). **Lectura pública** (anon y authenticated): son datos fijos no sensibles que hacen falta antes del login para elegir el Club Favorito. Nadie los escribe por la API.
- `rival`: nombre único, `escudo_path`, `activo` (baja lógica). El Clásico usa al otro Club como Rival (hay filas "Peñarol" y "Nacional").
- `partido`: `club_id`, `rival_id`, `inicio` (timestamptz, UTC), `estado` (`programado | cancelado`), `creado_en`. El estado de la Votación **no se guarda**: lo calcula el Calendario.
- `jugador`: `club_id`, `nombre`, `numero` (1-99), `posicion_natural` (`ARQ | DEF | MED | DEL`), `en_plantel` (baja lógica), `disponibilidad` (`disponible | lesionado | suspendido | no_disponible`), `motivo_disponibilidad`.
- `perfil` (Hincha): `id` = `auth.users.id` (cascade al borrar el usuario), `club_favorito_id` (nulo hasta elegirlo), `rol` (`hincha | admin`). Lo crea el trigger `al_crear_usuario_crear_perfil`.
- Todas las tablas tienen `actualizado_en` mantenido por trigger (salvo `club`).
- Función `public.es_admin()`: `true` solo si el usuario tiene rol `admin` **y** la sesión es AAL2 (2FA). Pensada para las políticas de escritura del backoffice. Todavía no la usa ninguna política.

**RLS:** habilitado en todas las tablas, deny-by-default. Salvo la lectura de `club`, no hay políticas: cada ticket abre lo que necesita en su propia migración.

## Convenciones para el trabajo en paralelo

Varios agentes trabajan a la vez en worktrees separados (rama `wip/<NN>-<slug>` desde `wip/integracion`). Para minimizar conflictos:

1. **Migraciones**: siempre nuevas, con `npm run db:new -- <ticket>_<descripcion>` (nombre con timestamp). **Nunca edites una migración ajena ni una ya mergeada**; si hay que cambiar algo de la base, hacelo con una migración nueva (`alter table`, `create policy`, `drop policy`...).
2. **Políticas de RLS**: cada ticket crea las políticas de las tablas que necesita, en su migración. Nombrá las políticas `"<tabla>: <qué permite>"`. No abras más de lo que el ticket requiere.
3. **Lógica pura** en `src/domain/<modulo>/`, una carpeta por módulo, con su API pública en `index.ts` y tests `*.test.ts` al lado del código. No importa Next, React, Supabase ni `@/lib`/`@/app` (ESLint falla). Puede importar `@/domain/comun` y otros módulos de dominio.
4. **`src/domain/comun/`** es compartido: si un enum de la base cambia, actualizá `tipos.ts` en la misma rama. Evitá agregar ahí cosas de un solo módulo.
5. **Horas**: UTC en la base y en el dominio (`Date`/ISO con `Z`); America/Montevideo solo en el borde de la UI, con `src/domain/comun/horario.ts` (`formatearHoraUy`, `desdeHoraUy`, `aHoraUyLocal`). Única excepción: `validarInicio` de `@/domain/partidos`, que parsea el `datetime-local` del formulario de Partido dentro de `validarPartido` y lo devuelve en UTC.
6. **Datos de ejemplo**: no edites `seed.sql`; agregá `supabase/seeds/<NN>-<slug>.sql`.
7. **Tests de RLS**: un archivo por ticket, `tests/rls/<NN>-<slug>.test.ts` (los tickets de otro feature que repiten número llevan su prefijo, por ejemplo `pixel-07-escudos.test.ts`), usando `tests/rls/helpers.ts` (clientes y usuarios) y `tests/rls/datos.ts` (datos de prueba).
8. **`database.types.ts`** es generado: si al mergear hay conflicto, no lo resuelvas a mano; aplicá las migraciones (`npm run db:reset`) y corré `npm run db:types`.
9. **`package.json` / `package-lock.json`**: si chocan al mergear, quedate con la unión de dependencias y regenerá el lock con `npm install`.
10. **Secretos**: nunca en el repo. La service role key y la VAPID privada solo en código de servidor (`import "server-only"`). Las variables con `NEXT_PUBLIC_` llegan al navegador: nunca le pongas ese prefijo a un secreto.
11. Antes de terminar un ticket: `npm run typecheck && npm run lint && npm test && npm run test:rls` (este último con Supabase local corriendo). Los tickets del feature Selección (`.scratch/seleccion/`) suman `npm run test:e2e`.
12. **Tests E2E**: un archivo por ticket, `tests/e2e/<NN>-<slug>.spec.ts` (con prefijo de feature si el número se repite, como en RLS), usando `tests/e2e/fixtures.ts`. Sus datos de ejemplo van en un seed propio, `supabase/seeds/e2e-<NN>-<slug>.sql`.

## Tests de RLS

Corren contra el Supabase local que levanta `npx supabase start`. Las claves se leen solas de `supabase status` (o de `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY` y `SUPABASE_TEST_SERVICE_ROLE_KEY` si están definidas). Conviene correr `npm run db:reset` antes si cambiaron las migraciones.

El setup global (`tests/rls/setup-global.ts`) crea una vez por corrida tres usuarios estándar con email confirmado, inicia sesión con cada uno y los borra al final:

| Nombre | Club Favorito | Rol |
|---|---|---|
| `hinchaPenarol` | `penarol` | `hincha` |
| `hinchaNacional` | `nacional` | `hincha` |
| `admin` | `penarol` | `admin` (sesión **AAL1**, sin 2FA) |

```ts
import { clienteAnonimo, clienteComo, clienteServicio, crearUsuario, borrarUsuario, usuario } from "./helpers";

const penarol = clienteComo("hinchaPenarol");   // autenticado como ese Hincha (RLS aplica)
const anon = clienteAnonimo();                    // sin sesión
const servicio = clienteServicio();               // service role: solo para preparar/limpiar datos
usuario("hinchaNacional").id;                     // id del usuario estándar
const descartable = await crearUsuario({ club: null }); // usuario propio para tests destructivos
await borrarUsuario(descartable.id);
```

Detalles:

- Con RLS, un `select` denegado **no da error**: devuelve `[]`. Un `insert` denegado da error; un `update`/`delete` denegado afecta cero filas (usá `.select()` para verificarlo).
- Auth limita los logins por IP (`auth.rate_limit.sign_in_sign_ups`), por eso los usuarios estándar inician sesión una sola vez. `crearUsuario()` hace un login real: usalo con moderación.
- El Admin estándar no tiene 2FA. Para probar escrituras de Admin hace falta una sesión AAL2 (enrolar y verificar un factor TOTP): lo resuelve el ticket 07 agregando un helper.
- No cambies el perfil de un usuario estándar sin restaurarlo; los archivos corren en serie pero comparten la base.

## Tests E2E

Playwright maneja un Chromium contra la app levantada con `next dev` y el Supabase local. Son pocos flujos críticos (los del feature Selección); la lógica se sigue probando con tests unitarios y de RLS.

**Requisitos:** Supabase local corriendo (`npx supabase start`) con las migraciones y seeds al día (`npm run db:reset`), y el Chromium de Playwright instalado (`npx playwright install chromium`, una vez por máquina).

```bash
npm run test:e2e                              # levanta la app en http://localhost:3100 y corre todo
E2E_PORT=3200 npm run test:e2e                # otro puerto (por ejemplo, otro worktree a la vez)
npm run test:e2e -- tests/e2e/smoke.spec.ts   # un archivo
npm run test:e2e -- --headed                  # mirando el navegador
npm run test:e2e -- --ui                      # modo interactivo de Playwright
```

- **Puerto:** `E2E_PORT` (por defecto `3100`, para no chocar con el `3000` de `npm run dev`). Playwright levanta su propio `next dev` en ese puerto y lo apaga al terminar. Si el puerto está ocupado, falla en vez de correr contra un servidor ajeno. Next no deja dos `next dev` en la misma carpeta: frená el tuyo o usá otro worktree.
- **Siempre Supabase local:** `playwright.config.ts` toma URL y claves de `supabase status` (o de `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY` y `SUPABASE_TEST_SERVICE_ROLE_KEY`) y se las pasa a la app por encima de `.env.local` (las variables del proceso le ganan a los `.env` en Next). Las demás variables (VAPID, `CRON_SECRET`) salen de `.env.local`, como en `npm run dev`.
- Corren **de a un test** (`workers: 1`): comparten la base.
- Si un test falla queda una traza en `test-results/` (`npx playwright show-trace test-results/<carpeta>/trace.zip`). `test-results/` y `playwright-report/` están en `.gitignore`.

Helpers (`tests/e2e/fixtures.ts`):

```ts
import { expect, iniciarSesion, test } from "./fixtures";

test("...", async ({ page, crearHincha }) => {
  const hincha = await crearHincha({ club: "penarol" }); // { club: null } = sin Club Favorito
  await iniciarSesion(page, hincha);                      // login con email desde /login
  await expect(page).toHaveURL("/");
});
```

- `crearHincha({ club, rol? })` crea un usuario con email confirmado usando la service role (sin login ni email) y **lo borra solo al terminar el test**. Para preparar otros datos: `clienteServicio()` de `tests/e2e/usuarios.ts`.
- `iniciarSesion(page, hincha)` completa el formulario de `/login` y espera a salir de ahí (a `/`, o a `/elegir-club` si no tiene Club).
- **Rate limit de Auth:** cada `iniciarSesion` es un login real y cuenta para `auth.rate_limit.sign_in_sign_ups` (30 cada 5 minutos por IP, compartido con los tests de RLS, que hacen unos 15 por corrida). Un login por test; si aparece "demasiados intentos", esperá 5 minutos.
- **Datos de ejemplo:** no dependas de los Partidos de `seed.sql` (sus fechas se mueven con `now()` y desarrollo los usa). Cada ticket carga los suyos en `supabase/seeds/e2e-<NN>-<slug>.sql` (se cargan con `npm run db:reset`), con nombres que no choquen con los de desarrollo.

## Variables de entorno

Todas están documentadas en [`.env.example`](../.env.example). Los `.env` reales están en `.gitignore`.

| Variable | Dónde se usa | ¿Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente y servidor | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor (`src/lib/supabase/admin.ts`) | **Sí** |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | `supabase/config.toml` (Google OAuth, ticket 04) | El secret sí |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Cliente (push, ticket 15) | No |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Solo servidor (push, ticket 15) | La privada sí |
| `CRON_SECRET` | Endpoints de cron (ticket 12) | **Sí** |
| `NEXT_PUBLIC_SITE_URL` | URLs absolutas (redirects, imágenes para compartir) | No |

## Autenticación y Club Favorito (ticket 04)

**Rutas.** Públicas para invitados: `/login`, `/registro`, `/verificar` (con sesión mandan a `/`). Libres con o sin sesión: `/recuperar`, `/auth/*` (`/auth/callback` de Google, `/auth/salir` para cerrar sesión con POST) y `/api/*` (cada Route Handler se autentica solo). Todo lo demás exige sesión. Las páginas de la app van dentro de `src/app/(app)/`, cuyo layout exige sesión **y** Club Favorito (si no lo eligió, a `/elegir-club`, que avisa que no se puede cambiar). `src/app/(app)/page.tsx` es un placeholder: lo reemplaza el ticket 09.

**En el servidor**, usá `src/lib/auth/sesion.ts`:

```ts
const hincha = await requerirHincha();  // { id, email, clubFavorito: "penarol" | "nacional", rol }
const h = await requerirSesion();       // igual, pero clubFavorito puede ser null
const o = await obtenerHincha();        // o null si no hay sesión (no redirige)
```

Los layouts no protegen las Server Actions: cada acción tiene que llamar a `requerirHincha()` (y RLS hace el resto).

**Proxy** (`src/proxy.ts` + `src/lib/supabase/proxy.ts`): refresca la sesión de Supabase en cada pedido (todo menos `_next/static`, `_next/image` y archivos con extensión) y hace la redirección optimista con `decidirAcceso()` de `src/lib/auth/rutas.ts`. Para sumar rutas públicas, editá las listas de ese archivo (tiene tests).

**Login con email.** Los formularios llaman a Supabase Auth desde el navegador (no desde Server Actions) para que los rate limits de Auth cuenten por IP del Hincha y no por la del servidor. Registro → código de 6 dígitos por email → `verifyOtp({ type: "signup" })`. Recuperación → código por email → `verifyOtp({ type: "recovery" })` + `updateUser({ password })`. En local los emails se ven en Mailpit: http://127.0.0.1:54324.

**Base de datos** (`supabase/migrations/20261106140400_04_perfil_club_favorito.sql`):

- Política `"perfil: el Hincha lee el suyo"` (SELECT, `id = auth.uid()`).
- Sin INSERT/UPDATE/DELETE en `perfil` para `anon`/`authenticated` (revocados).
- `elegir_club_favorito(club text) returns text`: fija el Club Favorito del usuario de la sesión solo si era nulo. Errores: `42501` sin sesión, `22023` club inválido, `EV001` ya tenía Club.
- Trigger `perfil_proteger_cambios`: en pedidos de la API (anon/authenticated) impide cambiar `rol`, `id`, `creado_en` y un Club Favorito ya elegido, salvo `es_admin()` (Admin con 2FA). La service role y las conexiones directas no se restringen. Si el ticket 07 quiere que el Admin edite perfiles por la API: `grant update (club_favorito_id, rol) on public.perfil to authenticated` + política de UPDATE con `es_admin()`.

**Cambios en `supabase/config.toml`** (todos marcados con `# Ticket 04`):

| Clave | Antes | Ahora |
|---|---|---|
| `auth.additional_redirect_urls` | `https://127.0.0.1:3000` | + `http://localhost:3000/auth/callback`, `http://127.0.0.1:3000/auth/callback` |
| `auth.minimum_password_length` | 6 | 8 |
| `auth.email.enable_confirmations` | false | **true** (sin código no hay sesión) |
| `auth.email.max_frequency` | 1s | 60s (reenvío de código y recuperación, por email) |
| `auth.email.template.confirmation` / `.recovery` | (por defecto) | `supabase/templates/confirmacion.html` / `recuperacion.html`, con `{{ .Token }}` |
| `auth.external.google` | (no estaba) | `enabled = true`, `client_id`/`secret` por `env(...)` |
| `auth.rate_limit.sign_in_sign_ups` / `token_verifications` | 30 / 30 | sin cambios (30 cada 5 min por IP; solo se comentaron) |

> **Importante:** Supabase local lee `config.toml` al arrancar. Después de traer estos cambios hay que reiniciarlo (`npx supabase stop && npx supabase start`). Con la config vieja (autoconfirm) el test del registro con código de `tests/rls/04-auth.test.ts` se saltea solo.

### Login con Google

Supabase hace de intermediario: Google redirige a Supabase (`/auth/v1/callback`) y Supabase a la app (`/auth/callback`).

**Local:**

1. En [Google Cloud Console](https://console.cloud.google.com/) creá (o elegí) un proyecto.
2. *APIs y servicios → Pantalla de consentimiento de OAuth*: tipo **Externo**, nombre de la app, email de soporte; scopes `openid`, `email`, `profile`. Mientras esté en modo *Prueba*, agregá tu cuenta como usuario de prueba.
3. *APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth*, tipo **Aplicación web**:
   - Orígenes autorizados de JavaScript: `http://localhost:3000`
   - URI de redireccionamiento autorizados: `http://127.0.0.1:54321/auth/v1/callback`
4. Poné el Client ID y el Client secret como `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` en `supabase/.env` (no se commitea) o exportalos en la shell antes de `npx supabase start`: la CLI los lee al arrancar, así que reiniciá Supabase. (Next no los necesita.)
5. Entrá por http://localhost:3000 (no `127.0.0.1`: tiene que coincidir con `site_url` y las redirect URLs).

Sin esas variables, Supabase arranca igual, pero el botón de Google falla.

**Producción:**

1. Otro ID de cliente (o el mismo) con origen `https://<dominio>` y URI de redireccionamiento `https://<ref-del-proyecto>.supabase.co/auth/v1/callback`. Publicá la pantalla de consentimiento (sacala de *Prueba*).
2. En el dashboard de Supabase: *Authentication → Sign In / Providers → Google*: activalo y pegá Client ID y secret.
3. *Authentication → URL Configuration*: `Site URL = https://<dominio>` y agregá `https://<dominio>/auth/callback` (y las URLs de preview de Vercel si se usan, p. ej. `https://*-<equipo>.vercel.app/auth/callback`).

**El resto de la config de Auth en producción** también va en el dashboard (el `config.toml` es solo local): *Confirm email* activado, largo mínimo de contraseña 8, plantillas *Confirm signup* y *Reset password* con el contenido de `supabase/templates/`, *Email OTP expiration* 3600 s, rate limits (*Authentication → Rate Limits*), y un SMTP propio (el de Supabase solo manda unos pocos emails por hora).

## Backoffice: acceso Admin y Planteles (ticket 07)

**Rutas** (`src/app/admin/`): el layout de `/admin` exige rol `admin` (si no, 404; sin sesión, al login). El panel (`admin/(panel)/`: `/admin`, `/admin/planteles/[club]`, `/admin/planteles/[club]/nuevo`, `/admin/jugadores/[id]`, `/admin/hinchas`) exige además **2FA en la sesión (AAL2)**; si falta, va a `/admin/2fa`, que enrola el factor TOTP la primera vez (QR de Supabase + código) o lo verifica. El enrolamiento y la verificación se hacen desde el navegador.

**En el servidor**, `src/lib/auth/admin.ts`:

```ts
await requerirCuentaAdmin();                  // rol admin, con o sin 2FA (404 si no es Admin)
await requerirAdmin();                        // rol admin + AAL2 (si no, a /admin/2fa)
const supabase = await requerirAdminEnAccion(); // TODA Server Action de Admin: pregunta es_admin() a Postgres
```

Las Server Actions del backoffice (`src/app/admin/(panel)/acciones.ts`) no confían en el layout: todas llaman a `requerirAdminEnAccion()` y usan el cliente de la sesión (RLS), nunca la service role. Los tickets 08 y 14 pueden reutilizar este helper.

**Base de datos** (`supabase/migrations/20261106200700_07_backoffice_planteles.sql`), todo con `es_admin()`:

- `jugador`: el Admin lee todos, da de alta y edita (baja lógica con `en_plantel = false`; DELETE revocado para la API). La lectura para Hinchas la crea el ticket 09.
- `evento_disponibilidad` (nueva): `jugador_id`, `club_id`, `disponibilidad_anterior`, `disponibilidad_nueva`, `motivo`, `momento`. La escribe solo el trigger `jugador_registrar_cambio_de_disponibilidad` cuando cambia la Disponibilidad (cambiar solo el motivo no genera evento). Sin acceso por la API para nadie: se lee con la service role (tickets 10 y 15).
- `perfil`: política SELECT para el Admin. El Club Favorito de un Hincha se cambia con `cambiar_club_favorito(hincha uuid, club text)` (errores `42501` no es Admin con 2FA, `22023` club inválido, `P0002` no existe). `perfil` sigue sin UPDATE por la API para nadie, así que **el rol no se puede cambiar desde la app**.
- `buscar_hinchas(texto)`: Hinchas cuyo email contiene el texto (máx. 50), con `id, email, club_favorito_id, rol, creado_en`. Solo Admin con 2FA (`42501` si no).
- Las fotos de Jugador (bucket `jugadores` y columna `foto_path`) se quitaron en el ticket 08 del diseño pixel art (migración `*_pixel08_quitar_fotos_jugador.sql`). **Antes de aplicar esa migración en producción**, vaciá el bucket `jugadores` desde el dashboard o la API de Storage: la migración borra las filas de `storage.objects` pero no los archivos guardados.

**Dominio** (`@/domain/planteles`): `validarJugador`, `validarDatosJugador`, `validarDisponibilidad` (el motivo se descarta si queda Disponible), `validarEscudo` (PNG de exactamente 48x48 por firma y cabecera IHDR, hasta 64 KB; motivos `vacia`, `tamano`, `formato`, `dimensiones`), `LADO_ESCUDO`, `TAMANO_MAXIMO_ESCUDO`, `CABECERA_ESCUDO`.

**2FA en Supabase local**: `supabase/config.toml` tiene `[auth.mfa.totp] enroll_enabled = true` y `verify_enabled = true` (`# Ticket 07`). Como toda la config de Auth, se lee al arrancar: después de traer este cambio, `npx supabase stop && npx supabase start`. En producción: *Authentication → Multi-Factor → TOTP* habilitado en el dashboard.

**Tests de RLS**: `crearAdminConDosFactores()` de `tests/rls/helpers.ts` crea un Admin descartable, enrola un factor TOTP (código calculado con RFC 6238 en `tests/rls/dos-factores.ts`) y devuelve un cliente con sesión AAL2. Devuelve `null` si Supabase local tiene TOTP apagado: los tests que lo necesitan se saltean con un aviso.

### Cómo se crea el primer Admin

Nunca desde la app (la API no permite cambiar el rol). En producción:

1. La persona se registra en la app como cualquier Hincha.
2. Alguien con acceso al proyecto de Supabase abre *SQL Editor* en el dashboard y corre:
   ```sql
   update public.perfil set rol = 'admin'
   where id = (select id from auth.users where email = 'persona@ejemplo.com');
   ```
   (para quitarlo, `rol = 'hincha'`).
3. La persona entra a `/admin`, escanea el QR con su app de autenticación y verifica el código. Desde ahí, cada sesión nueva pide el código antes de entrar al panel.

En local, el seed `supabase/seeds/07-backoffice.sql` crea un Admin de prueba: `admin@elegilosvos.local` / `admin-local-123` (solo local; los seeds no se aplican en producción).
## Armado de la Alineación (ticket 09)

**Pantalla** `src/app/(app)/page.tsx` + `src/app/(app)/_alineacion/`: Partido en pantalla (`votacionEnPantalla` de `@/domain/armado`), cuenta regresiva, selector de Esquema, cancha y banco con `@dnd-kit/core` (mouse, toque prolongado y teclado) más tocar-para-seleccionar. Toda mutación pasa por `@/domain/editor`. Guardado automático (debounce 800 ms, un guardado a la vez, reintentos) con la Server Action `guardarAlineacion` (`_alineacion/acciones.ts`), que valida con `desdeJson` + `validarAlineacion` contra el Plantel y hace upsert con el cliente del usuario (RLS).

**Base de datos** (`supabase/migrations/20261106200900_09_alineacion.sql`):

- `alineacion` (`hincha_id` default `auth.uid()` → `perfil` cascade, `partido_id` → `partido` cascade, `esquema`, `esquema_elegido_a_mano`, `esquema_modificado_en`, `puestos` jsonb con el formato de `aJson(...).puestos`; único por Hincha y Partido). Check de forma (`alineacion_puestos_validos`, `puestos_de_esquema`); trigger que exige Jugadores del Club del Partido y, para pedidos de la API, **sella las horas con la del servidor** (un Puesto que conserva al mismo Jugador conserva su hora). La service role puede escribir horas explícitas (herencia, ticket 10).
- Políticas: el Hincha lee la suya; INSERT/UPDATE solo propia, de su Club Favorito y con `votacion_abierta(partido_id)`. Sin DELETE. Columnas escribibles por la API: `partido_id, esquema, esquema_elegido_a_mano, esquema_modificado_en, puestos`. Upsert: `onConflict: "hincha_id,partido_id"` sin mandar `hincha_id`.
- `votacion_de_partido(partido, ahora default now())` → `(partido_id, estado, abre, cierra)` y `votacion_abierta(partido, ahora)`: la regla del Calendario en SQL (security invoker; un test la compara con el TS).
- `mi_club_favorito()` y lecturas del Hincha: `partido` y `jugador` de su Club; `rival` activos o referenciados por Partidos de su Club.

## Borrado de cuenta (ticket 13)

**Pantalla** `/cuenta` (`src/app/(app)/cuenta/`, link "Mi cuenta" en el header del layout de `(app)`): sección "Tus datos" (email y Club Favorito) y sección "Borrar cuenta". El ticket 15 agrega su sección "Notificaciones" entre las dos (hay un comentario marcando el lugar). Para borrar, el Hincha escribe su email (o `BORRAR` si la cuenta no tiene email): `confirmacionDeBorrado(email)` / `confirmaBorrado(escrito, email)` de `@/domain/cuenta`; la Server Action lo vuelve a validar.

**Server Action** `borrarMiCuenta` (`cuenta/acciones.ts`): `requerirSesion()` → confirmación → `borrarCuentaDeSesion(clienteDeSesion, crearClienteAdmin())` → `signOut({ scope: "local" })` → `/login?cuenta=borrada`. No recibe ningún id.

**`borrarCuentaDeSesion(sesion, admin)`** (`src/lib/cuenta/borrado.ts`): toma el id del usuario de la sesión validado contra Auth (`auth.getUser()`), nunca uno del cliente; rechaza a los Admin; y borra el usuario de Auth con la service role (`auth.admin.deleteUser`). Devuelve `{ ok: true, id }` o `{ ok: false, motivo: "sin-sesion" | "es-admin" | "error", mensaje }`. No importa `server-only` (para poder probarla desde `tests/rls`), pero solo se llama desde el servidor.

**Qué se borra.** Todo cuelga de `auth.users` con `on delete cascade`: `auth.users` → `perfil` → `alineacion` (también las tablas internas de Auth: sesiones, identidades, factores 2FA). Así, su Alineación de una Votación abierta desaparece y deja de contar en el Parcial y en el cierre. `evento_disponibilidad` no referencia al Hincha. Los 11 Elegidos congelados (ticket 12) no guardan datos de Hinchas, así que no cambian.

> **Regla para tablas nuevas:** toda tabla que guarde datos de un Hincha (p. ej. las suscripciones push del ticket 15) tiene que referenciar `perfil(id)` (o `auth.users(id)`) **con `on delete cascade`**; si no, el borrado de cuenta falla (FK) o deja datos personales. Para verificarlo:
> ```sql
> select conrelid::regclass, confdeltype from pg_constraint
> where contype = 'f' and confrelid in ('auth.users'::regclass, 'public.perfil'::regclass);
> -- confdeltype tiene que ser 'c' en todas las tablas propias
> ```

**Admin:** no puede borrar su cuenta desde la app (la página muestra un mensaje y la función devuelve `es-admin`), para que el sistema no quede sin Admin. Si hace falta, primero se le quita el rol por SQL (ver "Cómo se crea el primer Admin") y después borra su cuenta como cualquier Hincha.

**Tests** `tests/rls/13-borrado.test.ts` (usuarios propios, no los estándar): tras el borrado no queda usuario de Auth, perfil ni Alineaciones, y su Alineación ya no está entre las de la Votación abierta; otro Hincha no puede borrarlo por la API; la función solo borra al de la sesión (sin sesión o con la sesión de un usuario ya borrado no hace nada); un Admin no puede borrarse.

## Herencia de Alineación y avisos de no disponibles (ticket 10)

Al abrir la Votación de un Partido, cada Hincha del Club recibe una **Alineación heredada** en el Partido abierto a partir de su Alineación **más reciente** entre los Partidos anteriores **no cancelados** del Club (no solo la del inmediatamente anterior: si ese nunca abrió o el Hincha no votó ahí, hereda la última que guardó; ver corrección A): `heredar` del Editor contra el Plantel actual (sin no Disponibles ni bajas), con las **horas originales** y la marca de Esquema elegido a mano. Cuenta como voto aunque el Hincha no entre (ADR-0002), por eso se escribe en la base.

- **Lógica pura** (`@/domain/herencia`): `votacionAHeredar(partidos, ahora)` → `{ partidoId, anteriorId, partidosAnteriores } | null`; `alineacionesAHeredar({ club, partidosAnteriores, anteriores, yaTienen, plantel })` → `Herencia[]` (saltea a quien ya tiene Alineación para el Partido abierto, a quien hoy no es de ese Club —p. ej. el Admin le cambió el Club Favorito— y no crea Alineaciones vacías); `jugadoresNoDisponibles(alineacion, plantel)` para el aviso.
- **Servidor** (`src/lib/herencia/materializar.ts`): `materializarHerencias(clienteServiceRole, ahora, { club?, hinchaId? })` → `[{ club, partidoId, anteriorId, creadas }]`. Escribe con `insert … on conflict (hincha_id, partido_id) do nothing`: **idempotente**, nunca duplica ni pisa lo que hizo el Hincha. Usa la service role porque escribe Alineaciones de otros Hinchas con horas explícitas.
- **Cuándo corre**:
  1. Ruta de cron `GET /api/cron/herencia` (`Authorization: Bearer ${CRON_SECRET}`, 401 si falta o no coincide), la llama pg_cron cada minuto (ver [Procesos programados](#procesos-programados-pg_cron--pg_net)).
  2. Al entrar el Hincha a la pantalla de armado con la Votación abierta (`asegurarHerencia` de `src/lib/herencia/asegurar.ts`, solo para él). Si falla, la pantalla sigue andando y lo registra.
- **Aviso**: en la pantalla de armado, con la Votación abierta, `src/app/(app)/_herencia/aviso-no-disponibles.tsx` lista los Jugadores de la Alineación guardada que no están Disponibles o salieron del Plantel, con nombre, Puesto y motivo. Se calcula al cargar la página (no se actualiza en vivo mientras el Hincha edita).
- Sin migraciones: usa la tabla `alineacion` del ticket 09 (su trigger deja a la service role escribir horas explícitas).

Aunque el cron se atrase, el Hincha que entra a la app recibe su Alineación heredada en ese momento; el cron cubre a los que no entran (para que su voto cuente al cierre, conviene que corra al menos una vez entre la apertura y el cierre de cada Votación). **Para el cierre (ticket 12):** antes de calcular el 11 Elegido, llamar `materializarHerencias(cliente, ahora, { club })` con un `ahora` anterior al cierre, así ninguna heredada queda afuera aunque el cron no haya corrido.

## Parcial en vivo (ticket 11)

**Pantallas.** `/parcial` (`src/app/(app)/parcial/`, con un link desde la pantalla de armado mientras la Votación está abierta): el 11 que va ganando sobre la cancha en el Esquema ganador, el porcentaje de cada Esquema y los candidatos de cada Puesto. Backoffice: `/admin/votaciones` (link en el inicio del admin) con, por Votación de los últimos 30 días y futuras, el estado, las Alineaciones que cuentan y el Parcial (en las cerradas, el conteo con la Disponibilidad actual). El componente compartido es `src/app/_parcial/vista-parcial.tsx`.

**Cálculo** (sin migraciones: no hay vista ni función SQL; el agregado se arma en el servidor):

- `@/domain/votacion` (puro): `contarVotacion(filasAlineacion, filasJugador)` adapta las filas de `alineacion` (con `alineacionDesdeFila`) y de `jugador` y corre `contar`; `soloAgregados(resultado)` copia solo los campos agregados (lista blanca); `COLUMNAS_ALINEACION_PARA_CONTEO`, `COLUMNAS_JUGADOR_PARA_CONTEO`, `jugadorParaConteoDesdeFila`.
- `src/lib/votacion/conteo.ts` (recibe el cliente; pasarle la **service role**, porque RLS solo deja leer la Alineación propia): `leerAlineacionesDelPartido(cliente, partidoId, tamanoDePagina = 1000)` pagina por `id` (keyset) y nunca devuelve `hincha_id`; `leerJugadoresParaConteo(cliente, club)`; `contarPartido(cliente, partidoId) → { club, resultado } | null`. El cierre (ticket 12) puede usar `contarPartido(crearClienteAdmin(), partidoId)`.
- `src/lib/parcial/` (`server-only`): `obtenerParcial(partidoId)` llama a `requerirHincha()` y, con el cliente de la sesión (RLS), verifica que el Partido sea de su Club y que la Votación esté abierta (`votacion_de_partido`); devuelve `{ tipo: "ok", resultado } | { tipo: "prohibido" } | { tipo: "no_abierta" }` (la página responde 404 a `prohibido`). `calcularParcialCacheado(partidoId)` (sin control de acceso: solo backoffice, tras `requerirAdmin()`): `unstable_cache` por Partido con `revalidate` = `SEGUNDOS_DE_CACHE_DEL_PARCIAL` (30 s) y etiqueta `etiquetaDelParcial(partidoId)` (`parcial:<id>`, para `revalidateTag`).
- La respuesta nunca incluye ids de Hinchas ni de Alineaciones ni horas: solo cantidades, porcentajes e ids de Jugadores.

**Tests**: `src/domain/votacion`, `src/domain/parcial` (unitarios) y `tests/rls/11-parcial.test.ts`, que crea ~1000 Hinchas descartables (sin login) y 1008 Alineaciones en un Partido de 2035 para verificar que la lectura pagina más allá de 1000 filas, que el resultado no tiene datos identificables y que un Hincha no puede pedir el Parcial del otro Club ni el de una Votación que no está abierta.

## Backoffice: Rivales y Partidos (ticket 08)

**Rutas** (dentro de `admin/(panel)/`, Admin con 2FA): `/admin/rivales` (catálogo + alta), `/admin/rivales/[id]` (datos, escudo, baja lógica, borrado si no tiene Partidos), `/admin/partidos/[club]` (Partidos con el estado de su Votación, abre y cierra, y marca "nunca abre"), `/admin/partidos/[club]/nuevo` y `/admin/partidos/[club]/[id]` (postergar/cambiar horario o Rival, cancelar, reactivar, borrar). Código en `admin/(panel)/_partidos/` (acciones, formularios, lecturas, textos). Toda Server Action llama a `requerirAdminEnAccion()`.

**Avisos con confirmación**: alta, postergación, cancelación, reactivación y borrado calculan el Calendario antes y después (`analizarCambio`) y, si una Votación abierta cambia, una Votación nunca abriría (abre >= cierra) o una cerrada se reabriría, muestran los avisos y piden "Entiendo, guardar igual" antes de guardar.

**Reglas** (`@/domain/partidos`): `validarRival`, `validarPartido` (inicio en hora de Montevideo con `desdeHoraUy`, guardado en UTC; Rival activo y que no sea el propio Club), `rivalesParaPartido`, `validarInicio`, `validarAccion` (reprogramar / cancelar / reactivar / borrar), `analizarCambio`, `ventanaVacia`. El escudo se valida con `validarEscudo` de `@/domain/planteles`.

- **Cancelar** pone `estado = 'cancelado'`: la Votación queda anulada y las Alineaciones se conservan.
- **Reactivar** (des-cancelar) se permite solo con un inicio cuya Votación todavía no cerró: sirve para corregir una cancelación por error o reprogramar un Partido suspendido sin perder las Alineaciones, y nunca deja una Votación "cerrada" que no pasó por el cierre (sin 11 Elegido).
- **Borrar** solo sin Alineaciones (si tiene, se cancela).
- Con **11 Elegido** (resultado congelado, ticket 12) el Partido **se puede postergar, cancelar o reactivar** (p. ej. se suspendió en la última hora), pero el 11 Elegido queda congelado y la Votación **no se reabre**; lo que no se puede es **borrarlo** (`tieneOnceElegido`, motivo `once_elegido`). La ficha lo avisa ("El 11 Elegido ya quedó congelado; la votación no se reabre") y `analizarCambio(antes, despues, ahora, conOnceElegido)` no avisa nada sobre esa Votación (sí sobre las demás).

**Base de datos** (`supabase/migrations/20261106200800_08_rivales_partidos.sql`), todo con `es_admin()`:

- `rival.club_id` (nueva, única, nula): el Club que representa el Rival (Clásico). El seed `supabase/seeds/08-rivales-partidos.sql` marca las filas "Peñarol" y "Nacional"; en producción lo marca el Admin en la ficha del Rival.
- `rival`: el Admin lee todos, da de alta, edita (baja lógica con `activo = false`) y borra (la FK de `partido` lo impide si tiene Partidos).
- `partido`: el Admin lee todos, da de alta, edita y borra. Columnas escribibles por la API: insert `(club_id, rival_id, inicio, estado)`, update `(rival_id, inicio, estado)`: el Club y `creado_en` (apertura de la Votación) no se cambian.
- Trigger `partido_validar` (pedidos de la API): Rival activo al cargarlo o cambiarlo y distinto del propio Club (`23514`). Trigger `partido_impedir_borrado_con_alineaciones` (`EV080`): la FK de `alineacion` es en cascada. La service role no pasa por estas validaciones.
- `partido_tiene_alineaciones(partido)`: solo Admin con 2FA (`42501`).
- Storage: bucket público `escudos`; escritura solo el Admin. Desde el ticket 07 del diseño pixel art (migración `*_pixel07_escudos_48.sql`) acepta solo PNG de hasta 64 KB y la app exige 48x48. Rutas `<rival>/<uuid>.png` y `clubes/<club>/<uuid>.png`. El escudo de cada Club (`club.escudo_path`) lo sube el Admin en `/admin/clubes` (`grant update (escudo_path)` + política `"club: el Admin cambia el escudo"`). Donde falta un escudo se ve el hueco "falta escudo".

## Cierre de Votación y 11 Elegido (ticket 12)

**Pantallas.** `/resultados` (`src/app/(app)/resultados/`, link desde la pantalla de armado): el 11 Elegido del último Partido del Club cuya Votación cerró (cancha con el Esquema, Jugador y votos por Puesto), la Coincidencia del Hincha ("Coincidiste en X de 11": Jugadores en común entre su Alineación y el 11 Elegido, sin importar el Puesto) y el historial de resultados del Club (Rival, fecha) con link a `/resultados/<partidoId>`. Sin 11 Elegido se muestra el motivo (anulada, sin Alineaciones, no abrió).

**Base de datos** (`supabase/migrations/20261106201200_12_cierre_resultado.sql`):

- `resultado_votacion` (`partido_id` PK → `partido` cascade, `estado` `con_once | sin_alineaciones | anulada | nunca_abrio`, `esquema`, `once` jsonb `[{puesto, jugadorId, origen, votos}]`, `detalle` jsonb = salida de `contar` pasada por `soloAgregados` (sin votantes), `alineaciones_que_cuentan`, `cierre` (hora de cierre usada), `calculado_en`).
- **Inmutable para todos**: trigger que rechaza todo UPDATE, DELETE y TRUNCATE (también a la service role); solo se borra en cascada al borrar el Partido, y la API (anon/authenticated, Admin incluido) no puede borrar un Partido con resultado (trigger `partido_proteger_resultado`). Un trigger de INSERT rechaza congelar una Votación que, según `now()` de la base, todavía no cerró, o un estado `anulada` que no coincide con el Partido.
- Lectura: Hinchas del Club del Partido y Admin con 2FA. Escritura: solo la service role (INSERT).
- `tiene_resultado(partido)` y **`votacion_abierta` reemplazada**: además exige que no haya resultado. Así, si el Admin posterga un Partido ya cerrado, el Calendario lo vería abierto pero las políticas de `alineacion` siguen bloqueando. `votacion_de_partido` sigue siendo la regla pura del Calendario; la pantalla de armado (`votacionEnPantalla(partidos, ahora, conOnceElegido)`), el backoffice y las notificaciones consultan los resultados y la muestran cerrada.
- `partido_validar` (del ticket 08): el Admin **sí** puede cambiar `inicio` o `estado` de un Partido con resultado (migración `20261106210200_partido_postergar_con_resultado.sql`; antes estaba prohibido). El resultado no cambia y la Votación no se reabre (`votacion_abierta`). Borrarlo sigue prohibido (`partido_proteger_resultado`). En `/resultados` el Partido se muestra con su fecha nueva (y "Partido cancelado" si se canceló) y su 11 Elegido igual.
- `votaciones_por_cerrar(ahora)` (solo service role): Partidos con la hora de cierre pasada y sin resultado.

**Proceso** (`src/lib/cierre/proceso.ts`, recibe el cliente service role y `ahora`): `cerrarVotacionesVencidas(cliente, ahora) → { cerrados, errores }` y `cerrarVotacion(cliente, partidoId, ahora) → { partidoId, estado, creado }`. Cancelado con la hora de cierre pasada → `anulada`; ventana vacía (`abre >= cierra`) → `nunca_abrio`; si no, materializa las herencias pendientes (`materializarHerencias` con `ahora = cierre − 1 ms`), lee todas las Alineaciones (`leerAlineacionesDelPartido`, paginado) y cuenta con la **Disponibilidad a la hora de cierre**, reconstruida deshaciendo los `evento_disponibilidad` posteriores (`disponibilidadAlCierre` de `@/domain/cierre`). Inserta con `ON CONFLICT DO NOTHING`: idempotente y seguro en paralelo. Lógica pura en `@/domain/cierre`: `decidirCierre`, `disponibilidadAlCierre`, `resultadoDelConteo`, `coincidencia`, `onceDesdeJson`.

**Límites:** se cuentan las Alineaciones que existen cuando corre el proceso (después del cierre nadie puede escribirlas por la API, pero si un Hincha borra su cuenta antes de que corra, su voto no cuenta); la pertenencia al Plantel, el número y la posición natural se toman **al momento de correr el cierre** (solo la Disponibilidad tiene historial); con el cron cada minuto la diferencia con la hora de cierre es despreciable.

**Cron.** `GET /api/cron/cierre` con `Authorization: Bearer ${CRON_SECRET}` (401 si falta o no coincide; helper compartido `cronAutorizado` en `src/lib/cron/autorizar.ts`, también lo usan `/api/cron/herencia` y `/api/cron/notificaciones`). Revalida la caché del Parcial de los Partidos cerrados. Lo llama pg_cron cada minuto (ver [Procesos programados](#procesos-programados-pg_cron--pg_net)), así el 11 Elegido sale al minuto del cierre. Además hay **cierre a pedido**: al abrir `/resultados` (o el detalle de un Partido), si la Votación cerró y no hay resultado, el servidor cierra ese Partido en el momento (idempotente).

**Partidos cancelados:** quedan registrados como `anulada` recién cuando pasa su hora de cierre, y eso es definitivo (si el Admin lo "des-cancela" después, no se recalcula).

**Tests**: `src/domain/cierre` (unitarios) y `tests/rls/12-cierre.test.ts` (escenario en 2001: proceso con `ahora` explícito, idempotencia secuencial y en paralelo, herencia antes del cierre, Disponibilidad al cierre, `anulada`/`nunca_abrio`/`sin_alineaciones`, inmutabilidad para Hincha, Admin AAL2 y service role, lectura solo del propio Club, Alineación bloqueada tras resultado aunque se postergue, y la ruta de cron 401).

## 11 Real (ticket 14)

- Tabla `once_real` (migración `20261106201400_14_once_real.sql`): `partido_id` (PK, cascada al borrar el Partido), `jugadores uuid[]`, `cargado_en`, `actualizado_en`. Sin Esquema.
- Reglas (trigger `once_real_validar`, para todos los roles, y `validarOnceReal` de `@/domain/once-real` en la Server Action): exactamente 11 Jugadores distintos del Club del Partido (pueden estar fuera del Plantel hoy); Partido no cancelado y **ya empezado** (`now() >= inicio`: el DT da la formación antes de empezar); `partido_id` no se cambia.
- Acceso: leen los Hinchas del Club del Partido y el Admin con 2FA; carga, corrige y borra solo el Admin con 2FA (`es_admin()`).
- Backoffice: `/admin/partidos/[club]/[id]/once-real` (link desde la ficha del Partido).
- Hincha: en `/resultados` y `/resultados/[partidoId]`, con 11 Real cargado y 11 Elegido, "La hinchada acertó X de 11" (`coincidencia` de `@/domain/cierre`) y el listado de los 11; el historial muestra la misma Coincidencia.

## Compartir en redes (ticket 16)

**Imágenes** (PNG 1080×1350, generadas en el servidor con `ImageResponse` de `next/og`; diseño provisorio en `src/lib/compartir/imagen.tsx`):

- `GET /api/imagen/mi-alineacion/<partidoId>`: la Alineación del Hincha **de la sesión** (401 sin sesión, 404 si no tiene). El Hincha sale de la sesión, nunca del pedido, y se lee con el cliente del usuario (RLS: solo la propia). `Cache-Control: private, no-store`.
- `GET /api/imagen/once-elegido/<partidoId>`: pública. Con la service role lee **solo** `resultado_votacion` con estado `con_once`, el Partido, el Rival y los Jugadores del 11 (nada de Hinchas ni de Alineaciones). 404 si el id no es un uuid, no hay resultado o el estado no es `con_once`. Cacheable públicamente (5 min; 1 h en CDN).
- Ambas mandan `Content-Disposition` con el nombre del archivo (`mi-11-…png`, `11-elegido-…png`), que usa el botón al descargar o compartir.

**Página pública** `/compartir/once-elegido/<partidoId>` (sin sesión: `/compartir` está en las rutas libres de `src/lib/auth/rutas.ts`): es el link que se comparte, con metadata Open Graph/Twitter que apunta a la imagen (URL absoluta con `NEXT_PUBLIC_SITE_URL`).

**Botón "Compartir"** (`src/app/_compartir/boton-compartir.tsx`, cliente) en la pantalla de armado, en la vista del 11 Elegido (`/resultados`, `/resultados/[partidoId]`) y en la página pública: pide la imagen y usa la Web Share API con archivo (`navigator.canShare({ files })`); si no está disponible, la descarga y, para el 11 Elegido, copia el link público al portapapeles.

**Código**: modelo puro en `@/domain/compartir` (`modeloDeImagen(entrada)`: título, Club, Rival, fecha en hora de Montevideo, Esquema, los 11 Puestos con las coordenadas del Esquema y el arco propio abajo, nombres acortados a `LARGO_MAXIMO_NOMBRE` —completo; si no entra, el apellido; si tampoco, cortado con "…"—, nombre de archivo y texto alternativo). Lecturas en `src/lib/compartir/datos.ts` (`server-only`): `modeloMiAlineacion(cliente, hinchaId, partidoId)` y `modeloOnceElegido(clienteServicio, partidoId)`. Sin migraciones.

**Tests**: `src/domain/compartir` (unitarios) y `tests/rls/16-compartir.test.ts` (otro Hincha del mismo Club, uno del otro Club y un invitado no obtienen la Alineación ajena aunque pasen el id del dueño; el 11 Elegido solo sale de un resultado `con_once` y sin datos de Hinchas).

## Notificaciones push y PWA (ticket 15)

**PWA.** `src/app/manifest.ts` (servido en `/manifest.webmanifest`), íconos placeholder en `public/icons/` (se rediseñan en la etapa de diseño; el `apple-touch-icon` lo declara el layout raíz) y service worker `public/sw.js` (sin caché offline: solo recibe el push, muestra la notificación y al tocarla abre o enfoca la app en la `url` del mensaje, siempre una ruta interna). Lo registra `src/app/_pwa/registrar-service-worker.tsx` desde el layout raíz; `next.config.ts` lo sirve sin caché.

**Suscripción** (sección "Notificaciones" de `/cuenta`, `src/app/(app)/cuenta/_notificaciones/`): activar y desactivar en **este** navegador, el estado actual (activadas, desactivadas, bloqueadas en el navegador, no soportado) y cuántos dispositivos tiene activados. En iPhone/iPad fuera del modo app explica cómo "Agregar a pantalla de inicio" (iOS 16.4+ solo permite push en la web instalada). Server Actions (`acciones.ts`, todas con `requerirHincha()` y el cliente de la sesión): `activarNotificaciones(subscription.toJSON(), userAgent)`, `desactivarNotificaciones(endpoint)`, `suscripcionGuardada(endpoint)`. La suscripción se valida con `validarSuscripcion` de `@/domain/notificaciones` (endpoint `https` de hasta 2048 caracteres, `p256dh` de 65 bytes y `auth` de 16 en base64url).

**Base de datos** (`supabase/migrations/20261106201500_15_notificaciones_push.sql`):

- `suscripcion_push` (`hincha_id` → `perfil` cascade, `endpoint` único, `p256dh`, `auth`, `user_agent`, `creado_en`). RLS: el Hincha lee, crea y borra **solo las suyas** (sin UPDATE). La base repite las validaciones de formato.
- `registrar_suscripcion_push(endpoint, p256dh, auth, user_agent)` (SECURITY DEFINER, solo `authenticated`): alta idempotente por endpoint; si ese navegador estaba suscripto con otra cuenta (cambio de sesión en el mismo dispositivo), la suscripción pasa a la cuenta de la sesión. Al cerrar sesión, el botón "Cerrar sesión" desuscribe este navegador y borra su fila (ticket 17), así que el dispositivo deja de recibir los avisos de esa cuenta.
- `notificacion_enviada` (`hincha_id` → `perfil` cascade, `tipo`, `referencia` uuid = Partido o `evento_disponibilidad.id`, `enviado_en`; PK `(hincha_id, tipo, referencia)`). Sin acceso por la API.

**Qué se avisa** (lógica pura en `@/domain/notificaciones`: `avisosPendientes({ ahora, hinchas, clubes, yaEnviadas })` → `Aviso[]` con `{ hinchaId, tipo, referencia, mensaje: { titulo, cuerpo, url, etiqueta } }`). Solo a Hinchas con suscripción y solo de su Club Favorito actual:

| Tipo | Cuándo | Referencia | Abre |
|---|---|---|---|
| `votacion_abierta` | La Votación del Club está abierta. | Partido | `/` |
| `cierra_pronto` | Faltan 3 horas o menos para el cierre (si al detectar la apertura ya cierra pronto, se manda solo este). | Partido | `/` |
| `once_elegido` | Hay `resultado_votacion` `con_once` con cierre en las últimas 48 horas (los demás estados no avisan). | Partido | `/resultados/<id>` |
| `jugador_no_disponible` | Un `evento_disponibilidad` desde la apertura de la Votación abierta dejó no Disponible a un Jugador que está en la Alineación del Hincha para esa Votación, y hoy sigue sin estarlo (`jugadoresNoDisponibles` del ticket 10). Si cambió varias veces, cuenta el último cambio. | evento | `/` |

**Proceso** (`src/lib/notificaciones/proceso.ts`): `enviarNotificaciones(clienteServiceRole, ahora, enviar) → { avisos, enviados, fallidos, suscripcionesBorradas }`. Lee la foto del estado, calcula los avisos, los **inserta en `notificacion_enviada` con `ON CONFLICT DO NOTHING` antes de enviar** y solo envía los que insertó esa corrida: nunca hay duplicados aunque dos corridas se pisen (a lo sumo una vez; un envío fallido no se reintenta). Cada aviso va a todos los dispositivos del Hincha. Si el servicio push responde 404/410, la suscripción se borra. La función `enviar` se inyecta: en producción `crearEnvioWebPush()` de `src/lib/notificaciones/web-push.ts` (`server-only`, librería `web-push`), que devuelve `null` si falta alguna variable VAPID.

**Claves VAPID.** Generalas una vez por entorno con:

```bash
npx web-push generate-vapid-keys
```

`Public Key` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (llega al navegador: está bien) y `Private Key` → `VAPID_PRIVATE_KEY` (**secreta**, solo servidor; nunca con prefijo `NEXT_PUBLIC_`). `VAPID_SUBJECT` = `mailto:` de contacto o URL `https:`. Si cambiás las claves, las suscripciones existentes dejan de servir (el servicio push responde 401/403/410) y los Hinchas tienen que volver a activarlas. Sin las variables la sección de `/cuenta` dice que no están disponibles y el cron no envía nada (lo registra en el log). `src/lib/notificaciones/secretos.test.ts` verifica que solo `web-push.ts` lee la clave privada y que ningún componente cliente lo importa.

**Cron.** `GET /api/cron/notificaciones` con `Authorization: Bearer ${CRON_SECRET}` (`cronAutorizado`; 401 si falta o no coincide). Lo llama pg_cron **cada minuto** (ver [Procesos programados](#procesos-programados-pg_cron--pg_net)): "jugador no disponible" sale como mucho 1 minuto después del cambio del Admin y "cierra pronto" sale a las 3 horas del cierre. La deduplicación por `(hincha, tipo, referencia)` hace que las corridas frecuentes no repitan avisos (test de simulación minuto a minuto en `src/domain/notificaciones`). Si el Partido de la Votación que el Calendario ve abierta ya tiene resultado (se postergó después del cierre), no se avisa nada de esa Votación (`partidosConResultado`, `votacionAbiertaDelClub`).

**Tests**: `src/domain/notificaciones` (selección de avisos, deduplicación y validación de la suscripción), `src/lib/notificaciones/web-push.test.ts` (sin VAPID → null; 404/410 → vencida) y `tests/rls/15-push.test.ts`: RLS de `suscripcion_push` (otro Hincha no la lee ni la borra, no se crea a nombre ajeno, sin UPDATE), `notificacion_enviada` inaccesible, cascada al borrar la cuenta, el proceso con un envío falso en un escenario en 2001 (los cuatro eventos solo al Club correcto, sin duplicados en corridas sucesivas ni en paralelo, borrado de la suscripción con 410) y la ruta de cron (401; sin VAPID responde `salteado`).

## Seguridad y deploy (ticket 17)

### Qué se revisó y cómo se verifica

| Área | Estado | Cómo se verifica |
|---|---|---|
| Secretos en el árbol y en el historial | Sin hallazgos (solo claves **falsas** de suscripción push en tests, permitidas en `.gitleaks.toml`). | `gitleaks git . --config .gitleaks.toml` (o con Docker: `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest git /repo --config /repo/.gitleaks.toml`). |
| RLS en todas las tablas de `public`, políticas, grants a `anon`/`authenticated`, funciones SECURITY DEFINER | Todas con RLS; toda función con `search_path` vacío; `anon` no ejecuta **ninguna** función; las SECURITY DEFINER que puede llamar un usuario con sesión son 8, revisadas (chequean `auth.uid()` o `es_admin()`). | `tests/rls/17-seguridad.test.ts` consulta el catálogo (con `pg`, URL de `supabase status` o `SUPABASE_TEST_DB_URL`) y falla ante una tabla sin RLS, una vista sin `security_invoker`, una función sin `search_path`, una función ejecutable por `anon` o cualquier privilegio fuera de la lista esperada. **Si agregás una tabla, una función o un permiso a propósito, actualizá esa lista**: así alguien lo revisa. |
| Mínimo privilegio | Migración `20261106201700_17_seguridad.sql`: sin TRUNCATE/TRIGGER/REFERENCES/MAINTAIN para la API, sin escritura sobre `club`, sin EXECUTE de PUBLIC/`anon`, y los mismos cambios en los privilegios por defecto. | Mismo test. |
| Storage (`escudos`) | Público solo para leer por URL; PNG de hasta 64 KB; listar, subir, reemplazar y borrar solo el Admin con 2FA. (El bucket `jugadores` se borró en el ticket 08 del diseño pixel art.) | Mismo test + tests 08, pixel-07 y pixel-08. |
| Service role y VAPID privada | Solo en módulos `server-only` (`src/lib/supabase/admin.ts`, `src/lib/notificaciones/web-push.ts`). | `npm run build` y `grep -r "<valor de la clave>" .next/static` → nada (verificado con las claves locales). |
| Server Actions y Route Handlers | Toda acción verifica la sesión en el servidor (`requerirHincha`/`requerirSesion`/`obtenerHincha`) o `requerirAdminEnAccion()` (pregunta `es_admin()` a Postgres); los crons usan `cronAutorizado`; las imágenes validan el uuid. | Revisión manual (ver el reporte del ticket). |
| Redirecciones (`next`) | `rutaSegura` rechaza además espacios, caracteres de control y `\` (el parser de URL borraba el tab de `/\t/malo.com` y quedaba `//malo.com`). | `src/lib/auth/rutas.test.ts`. |
| Cabeceras | CSP (`src/lib/seguridad/cabeceras.ts`, aplicada en `next.config.ts`), `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS en producción, sin `X-Powered-By`. | `src/lib/seguridad/cabeceras.test.ts`; `npm run build && npx next start` + `curl -I`. |
| Push al cerrar sesión | El botón "Cerrar sesión" (`src/app/_sesion/`) desuscribe este navegador y borra su fila antes de cerrar la sesión. Al borrar la cuenta, las filas se borran en cascada. | Manual. |
| Dependencias | `npm audit --omit=dev`: 0 vulnerabilidades. | `npm audit --omit=dev`. |

La CSP no usa nonces: `script-src` lleva `'unsafe-inline'` porque Next inyecta scripts inline para hidratar (variante "Without Nonces" de la guía de Next). Lo demás queda cerrado a la app y al origen de `NEXT_PUBLIC_SUPABASE_URL` (Auth/REST e imágenes de Storage). **Las cabeceras se calculan en el build**: `NEXT_PUBLIC_SUPABASE_URL` tiene que estar definida al construir (en Vercel lo está). Si se agrega un servicio externo (analytics, fuentes, etc.), sumalo en `cabeceras.ts`.

### Variables de entorno

Valores nunca en el repo (ver [`.env.example`](../.env.example)).

| Variable | Dónde se configura | ¿Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (Production y Preview) | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | No (es pública por diseño; la protección es RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel, **sin** `NEXT_PUBLIC_` | **Sí** |
| `CRON_SECRET` | Vercel y Vault de Supabase (secreto `cron_secret`, lo manda pg_cron) | **Sí** (32+ caracteres aleatorios: `openssl rand -hex 32`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel | No |
| `VAPID_PRIVATE_KEY` | Vercel, **sin** `NEXT_PUBLIC_` | **Sí** |
| `VAPID_SUBJECT` | Vercel (`mailto:` o `https:`) | No |
| `NEXT_PUBLIC_SITE_URL` | Vercel (`https://<dominio>`) | No |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` | Solo Supabase **local** (`supabase/.env`). En producción van en el dashboard de Supabase (*Authentication → Providers → Google*), no en Vercel | El secret sí |
| `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY`, `SUPABASE_TEST_DB_URL` | Opcionales, solo para correr `test:rls` contra otra instancia (por defecto se leen de `supabase status`) | Nunca apuntarlas a producción |

En Vercel marcá las secretas como *Sensitive*. Usá claves distintas para Preview y Production si Preview apunta a otro proyecto de Supabase.

### Deploy

1. **Supabase**: crear el proyecto; `npx supabase link --project-ref <ref>` y `npx supabase db push` (aplica las migraciones; los seeds **no** se aplican). Después, las migraciones nuevas las aplica solo el workflow `.github/workflows/migraciones.yml` en cada push a `main` que toque `supabase/migrations/` (necesita el secreto `SUPABASE_ACCESS_TOKEN` en GitHub; también se puede correr a mano desde *Actions*). El deploy de Vercel no aplica migraciones y corre en paralelo: las migraciones tienen que ser compatibles con el código anterior (agregar antes que quitar). Revisar en *Database → Extensions* que `pg_graphql` no haga falta (la app no usa GraphQL: se puede deshabilitar).
2. **Auth**: lo que difiere de local está en `[remotes.produccion]` de `supabase/config.toml` (Site URL, redirect, SMTP de Resend, rate limit de emails). Google usa las mismas variables que local (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y `_SECRET`, en `supabase/.env`). Los valores salen de `supabase/.env` (no se commitea): `PROD_SITE_URL`, `PROD_AUTH_CALLBACK_URL`, `RESEND_API_KEY`, `EMAIL_FROM`. Se aplica con `npx supabase config diff` (revisar) y `npx supabase config push`. Lo que no maneja `config push` va en el dashboard. Referencia de lo que tiene que quedar:
   - *Sign In / Providers → Email*: **Confirm email** activado, largo mínimo de contraseña 8, *Secure password change* activado.
   - *Google*: activarlo con Client ID y secret (ver ticket 04).
   - *Multi-Factor*: **TOTP** habilitado (lo exige el backoffice).
   - *URL Configuration*: `Site URL = https://<dominio>`, redirect `https://<dominio>/auth/callback`.
   - *Emails*: plantillas de `supabase/templates/` y un SMTP propio.
   - *Rate Limits* (valores sugeridos, por hora salvo indicación): emails enviados 30 (con SMTP propio), verificaciones de token 30 cada 5 min por IP, *sign-ups and sign-ins* 30 cada 5 min por IP, refresh de token 150 cada 5 min por IP, usuarios anónimos 0 (están deshabilitados). En local están en `[auth.rate_limit]` de `supabase/config.toml` (`email_sent = 2` por hora, el valor por defecto de la CLI; los tests de RLS lo usan para probar el 429).
   - Si el plan lo permite, activar *Leaked password protection*.
3. **Vercel**: importar el repo, cargar las variables de arriba y deployar. No hay crons de Vercel: los procesos los dispara la base (paso 5).
4. **Primer Admin**: registrarse en la app y, desde el *SQL Editor* de Supabase, `update public.perfil set rol = 'admin' where id = (select id from auth.users where email = '...');` (ver ticket 07). Entrar a `/admin` y enrolar el TOTP.
5. **Procesos programados**: crear los secretos en Vault y llamar `programar_crons()` (ver [Procesos programados](#procesos-programados-pg_cron--pg_net)).

### Checklist antes de publicar el repo o deployar

- [ ] `npm run typecheck && npm run lint && npm test && npm run test:rls && npm run build` en verde.
- [ ] `gitleaks git . --config .gitleaks.toml` sin hallazgos (historial completo, todas las ramas que se publiquen).
- [ ] Ningún `.env*` real trackeado (`git ls-files | grep -i env` → solo `.env.example`).
- [ ] Ninguna variable secreta con prefijo `NEXT_PUBLIC_`; `grep -r` de la service role key en `.next/static` vacío.
- [ ] Migraciones nuevas: RLS habilitado, `revoke`/`grant` explícitos, `set search_path = ''` en toda función y chequeo de sesión/Admin dentro de toda SECURITY DEFINER expuesta (el test `17-seguridad` lo hace cumplir).
- [ ] En el dashboard de Supabase: confirmación de email, TOTP, Google, URLs, SMTP y rate limits configurados.
- [ ] `CRON_SECRET` y claves VAPID generadas para producción (no reusar las locales); `cron_secret` en Vault igual al `CRON_SECRET` de Vercel y `select jobname from cron.job` muestra los tres jobs.
- [ ] `curl -I https://<dominio>/login` muestra la CSP y HSTS.

## Correcciones post code-review (A)

- **Herencia sin cortes** (ADR-0002): cada Hincha hereda su Alineación más reciente del Club entre **todos** los Partidos anteriores no cancelados, en el orden del Calendario. Antes, si el Partido anterior terminaba como `nunca_abrio` (ventana vacía) o el Hincha no tenía Alineación ahí, perdía su voto. `materializarHerencias` busca solo a los Hinchas del Club que todavía no tienen la del Partido abierto (pendientes), en tandas de 100 y paginando por `id`; sigue siendo idempotente, conserva horas y excluye no Disponibles, bajas y Hinchas de otro Club. Las Alineaciones de Partidos cancelados no se heredan.
- **Votos del Club anterior**: (a) el conteo (`leerAlineacionesDelPartido` / `contarPartido`, usados por el Parcial y el cierre) solo cuenta Alineaciones de Hinchas cuyo Club Favorito de **hoy** es el Club del Partido (join a `perfil` en la base; la salida sigue sin `hincha_id`). (b) `cambiar_club_favorito` (migración `20261106210100_fix_a_cambio_de_club.sql`) además **borra** las Alineaciones del Hincha en Partidos del Club anterior con la Votación **abierta**; las de Votaciones cerradas quedan (historia, y alimentan la Herencia si vuelve). Los resultados ya congelados no cambian. Si el Club no cambia, no borra nada. El Parcial cacheado puede mostrar el voto viejo hasta que expire su caché (30 s).
- **Plantel en el cierre**: la pertenencia al Plantel, el número y la posición natural se toman al correr el cierre (ver "Límites" del ticket 12); no se cambió código.
- Tests: `src/domain/herencia/herencia.test.ts` y `tests/rls/fix-a.test.ts`. `tests/rls/11-parcial.test.ts` ahora asigna Peñarol a sus Hinchas descartables (antes no tenían Club y no contarían).

## Correcciones post code-review (C): un solo lugar para cada cosa

Refactor sin cambios de comportamiento. Antes de escribir algo de esto, usá lo que ya existe:

- **`@/domain/comun`**: `esUuid` (`ids.ts`), `esClubId` y `clubIdDeLaBase` (`tipos.ts`; el segundo lanza si una columna FK a `club` trae otra cosa), `NOMBRE_CLUB`, `NOMBRE_DISPONIBILIDAD` y `NOMBRE_RIVAL_DESCONOCIDO` (`textos.ts`). `@/domain/cierre`: `esEstadoResultado` / `estadoResultadoDeLaBase`. No castees strings de la base (`as ClubId`, `as EstadoResultado`).
- **Nombre corto del Jugador**: `nombreCorto(nombre, largoMaximo?)` de `@/domain/planteles` (la cancha del armado y la imagen para compartir).
- **Cancha**: la disposición (orientación, tamaño, dibujo, Puestos y banco sin choques) la calcula `disponer()` de `@/domain/cancha`; `CanchaPixel` (`@/app/_cancha/cancha-pixel`) la mide y la dibuja, y `CanchaDeLectura` es la versión de solo lectura (Parcial, 11 Elegido, link compartido). Cada vista pone el contenido de sus Puestos.
- **Lecturas de la base**: `leerPlantel` / `leerPartidos` (`@/lib/club/lecturas`, reciben el cliente), `COLUMNAS_ALINEACION` (`@/domain/armado`) para leer una Alineación, y `leerPorId` (`@/lib/supabase/paginar`) para paginar por `id` (keyset).
- **Escudos del backoffice**: `archivoElegido`, `leerEscudo`, `subirEscudo`, `MENSAJE_ESCUDO` (`@/lib/imagenes/subida`, server-only). En pantalla, `Escudo` de `@/app/_pixel/escudo` (o el hueco `faltaEscudo` de `@/domain/escudos`).
- **Compartir**: la fecha en hora de Montevideo la arma `fechaDeImagen` (`@/lib/compartir/fecha`); el dominio la recibe ya formateada.
- **Tests de RLS**: `tests/rls/datos.ts` (`creadorDePartidos`, `partidoAbierto`, `jugadoresDisponibles`, `once433`, `puestos433`, `guardarConServicio`).

## Procesos programados (pg_cron + pg_net)

Los procesos los dispara **la base**, no Vercel (no hay `vercel.json`: el plan Hobby solo permite crons diarios). Cada minuto, `pg_cron` hace con `pg_net` un `GET` a:

| Job (`cron.job.jobname`) | Ruta | Qué hace |
|---|---|---|
| `elegilos-vos-cierre` | `/api/cron/cierre` | Congela el 11 Elegido de las Votaciones cerradas (ticket 12). |
| `elegilos-vos-herencia` | `/api/cron/herencia` | Materializa las Alineaciones heredadas (ticket 10). |
| `elegilos-vos-notificaciones` | `/api/cron/notificaciones` | Manda los avisos push pendientes (ticket 15). |

con `Authorization: Bearer <CRON_SECRET>`. Las tres rutas son idempotentes, así que correrlas seguido (o dos a la vez) no duplica nada.

**Migración** `20261106210201_crons_desde_la_base.sql`: habilita `pg_cron` y `pg_net` y crea `public.programar_crons()` y `public.desprogramar_crons()` (SECURITY DEFINER, `search_path = ''`, solo `postgres` y la service role; ni anon ni authenticated). `programar_crons()` lee de **Supabase Vault** la URL de la app (`app_url`) y el secreto (`cron_secret`) y agenda los tres jobs de forma idempotente (si ya existen, los vuelve a crear). Si falta alguno de los dos secretos no agenda nada y deja un `NOTICE`; por eso la migración (que la llama al final) no falla en una base nueva. **La migración no contiene ni la URL ni el secreto.** Los jobs leen Vault en cada corrida: el secreto nunca queda escrito en `cron.job`, y cambiar un secreto no obliga a volver a agendar.

### Producción (una sola vez por proyecto)

1. Deployar la app en Vercel con `CRON_SECRET` (32+ caracteres aleatorios: `openssl rand -hex 32`) y aplicar las migraciones (`npx supabase db push`): crea las extensiones y la función. En *Database → Extensions* deberían figurar `pg_cron` y `pg_net` habilitadas.
2. En el *SQL Editor* de Supabase, guardar los secretos en Vault (el mismo `CRON_SECRET` que en Vercel; la URL sin barra final):

   ```sql
   select vault.create_secret('https://<dominio>', 'app_url');
   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
   ```

   (Si ya existen: `select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<nuevo>');`.)
3. Agendar los jobs:

   ```sql
   select public.programar_crons();
   -- {elegilos-vos-cierre,elegilos-vos-herencia,elegilos-vos-notificaciones}
   ```

4. Verificar al minuto:

   ```sql
   select jobname, schedule, active from cron.job;
   select j.jobname, d.status, d.return_message, d.start_time
   from cron.job_run_details d join cron.job j using (jobid)
   order by d.start_time desc limit 10;
   -- Respuestas HTTP (se guardan unas horas): 200 = bien; 401 = el secreto no coincide con el de Vercel.
   select status_code, content::text, created from net._http_response order by created desc limit 10;
   ```

Para pausarlos: `select public.desprogramar_crons();`. Si cambia el dominio o el secreto, alcanza con actualizar Vault. `CRON_SECRET` rotado: actualizar Vercel (y redeployar) y Vault a la vez.

### Local

`npm run db:reset` deja las extensiones y la función, pero sin secretos (no agenda nada). Para verlo funcionar:

1. `npm run dev` con `CRON_SECRET` definido en `.env.local`.
2. En Supabase Studio (*SQL Editor*, <http://127.0.0.1:54323>) o con `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`. La base corre en Docker, así que la app se alcanza en `host.docker.internal`:

   ```sql
   select vault.create_secret('http://host.docker.internal:3000', 'app_url');
   select vault.create_secret('<el CRON_SECRET de .env.local>', 'cron_secret');
   select public.programar_crons();
   ```

3. Al minuto, las consultas del paso 4 de producción muestran las corridas y `npm run dev` registra los `GET /api/cron/...` con 200.
4. Para apagarlos: `select public.desprogramar_crons();` (o `npm run db:reset`, que borra los secretos y los jobs).

**Tests**: `tests/rls/18-crons.test.ts` (extensiones habilitadas; sin secretos no agenda y avisa; con secretos agenda los tres jobs cada minuto sin escribir el secreto ni la URL en `cron.job` y arma URL y cabecera desde Vault; idempotente; un Hincha no puede llamar las funciones). Corren en transacciones que se deshacen.

**Seguridad:** al crear `pg_net`, Supabase les da a `anon` y `authenticated` permiso de ejecutar `net.http_get`/`http_post`, y `postgres` no puede revocarlo (los otorga `supabase_admin`). No es explotable desde la app: el esquema `net` no está expuesto por la API y ninguna función de `public` lo usa.

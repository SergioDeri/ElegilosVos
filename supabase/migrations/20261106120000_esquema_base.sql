-- =============================================================================
-- Esquema base de Elegilos Vos (ticket 01)
--
-- Tablas del dominio: club, rival, partido, jugador, perfil (Hincha).
-- Seguridad: RLS habilitado en TODAS las tablas y deny-by-default. La única
-- política abierta es la lectura de `club` (ver justificación abajo). Cada
-- ticket abre lo que necesita en SU PROPIA migración, sin editar esta.
--
-- Horas: todas las columnas de tiempo son timestamptz y se guardan en UTC.
-- La UI las muestra y las carga en America/Montevideo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- Posición natural del Jugador (no confundir con Puesto, que es del Esquema).
create type public.posicion_natural as enum ('ARQ', 'DEF', 'MED', 'DEL');

-- Disponibilidad actual del Jugador. Solo 'disponible' puede elegirse y contar.
create type public.disponibilidad as enum ('disponible', 'lesionado', 'suspendido', 'no_disponible');

-- Estado del Partido cargado por el Admin. El estado de la Votación
-- (pendiente/abierta/cerrada/anulada) NO se guarda: se calcula con el
-- Calendario de Votación a partir de los Partidos y la hora actual.
create type public.estado_partido as enum ('programado', 'cancelado');

-- Rol del usuario.
create type public.rol as enum ('hincha', 'admin');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- Mantiene `actualizado_en` al día en cada UPDATE.
create function public.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Club: valores fijos (Peñarol y Nacional). Se cargan en esta migración porque
-- son datos del dominio, no datos de ejemplo.
-- -----------------------------------------------------------------------------
create table public.club (
  id text primary key check (id in ('penarol', 'nacional')),
  nombre text not null unique,
  -- Ruta del escudo en Storage (o en /public). Nulo hasta que se cargue.
  escudo_path text
);

insert into public.club (id, nombre) values
  ('penarol', 'Peñarol'),
  ('nacional', 'Nacional');

-- -----------------------------------------------------------------------------
-- Rival: catálogo reutilizable de oponentes. En el Clásico, el otro Club
-- figura como Rival (hay una fila "Peñarol" y otra "Nacional" en el catálogo).
-- -----------------------------------------------------------------------------
create table public.rival (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) > 0),
  -- Ruta del escudo en el bucket de Storage (ticket 08).
  escudo_path text,
  -- Baja lógica: un Rival inactivo no se ofrece para Partidos nuevos.
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger rival_actualizado_en
  before update on public.rival
  for each row execute function public.tocar_actualizado_en();

-- -----------------------------------------------------------------------------
-- Partido: un Club contra un Rival. El Clásico son dos Partidos, uno por Club.
-- -----------------------------------------------------------------------------
create table public.partido (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.club (id),
  rival_id uuid not null references public.rival (id),
  -- Hora de inicio, en UTC.
  inicio timestamptz not null,
  estado public.estado_partido not null default 'programado',
  -- Momento en que se cargó: si no hay Partido anterior, la Votación abre acá.
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index partido_club_inicio_idx on public.partido (club_id, inicio);

create trigger partido_actualizado_en
  before update on public.partido
  for each row execute function public.tocar_actualizado_en();

-- -----------------------------------------------------------------------------
-- Jugador: integrante del Plantel de un Club. La baja es lógica
-- (en_plantel = false) para conservar el historial.
-- -----------------------------------------------------------------------------
create table public.jugador (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.club (id),
  nombre text not null check (length(trim(nombre)) > 0),
  numero smallint not null check (numero between 1 and 99),
  posicion_natural public.posicion_natural not null,
  -- Ruta de la foto en Storage (opcional, ticket 07).
  foto_path text,
  en_plantel boolean not null default true,
  disponibilidad public.disponibilidad not null default 'disponible',
  -- Motivo visible para el Hincha cuando no está Disponible.
  motivo_disponibilidad text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index jugador_club_idx on public.jugador (club_id) where en_plantel;

create trigger jugador_actualizado_en
  before update on public.jugador
  for each row execute function public.tocar_actualizado_en();

-- -----------------------------------------------------------------------------
-- Perfil del Hincha: 1 a 1 con auth.users. Se crea solo con un trigger.
-- -----------------------------------------------------------------------------
create table public.perfil (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Nulo hasta que el Hincha lo elige. Después solo lo cambia el Admin.
  club_favorito_id text references public.club (id),
  rol public.rol not null default 'hincha',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger perfil_actualizado_en
  before update on public.perfil
  for each row execute function public.tocar_actualizado_en();

-- Crea el perfil al crear el usuario de Auth. SECURITY DEFINER porque corre
-- en el contexto de GoTrue (rol supabase_auth_admin) y escribe en public.
create function public.crear_perfil_para_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfil (id) values (new.id);
  return new;
end;
$$;

-- Nadie tiene que poder llamarla vía la API.
revoke execute on function public.crear_perfil_para_usuario_nuevo() from public, anon, authenticated;

create trigger al_crear_usuario_crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_para_usuario_nuevo();

-- -----------------------------------------------------------------------------
-- Helper de autorización para las políticas de Admin (tickets 07, 08, 14...).
-- Devuelve true solo si el usuario tiene rol 'admin' Y la sesión está en AAL2
-- (2FA verificado). Es SECURITY DEFINER para poder leer `perfil` sin depender
-- de sus políticas (y evitar recursión de RLS). No expone datos: solo un bool
-- sobre el propio usuario.
-- -----------------------------------------------------------------------------
create function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
     and exists (
       select 1 from public.perfil p
       where p.id = auth.uid() and p.rol = 'admin'
     );
$$;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security: habilitado en todas, sin políticas abiertas.
-- -----------------------------------------------------------------------------
alter table public.club    enable row level security;
alter table public.rival   enable row level security;
alter table public.partido enable row level security;
alter table public.jugador enable row level security;
alter table public.perfil  enable row level security;

-- Única excepción: los Clubes son datos fijos y públicos (nombre y escudo),
-- necesarios antes del login (elegir Club Favorito, portada). No contienen
-- información sensible. Nadie puede escribirlos vía la API.
create policy "club: lectura pública"
  on public.club for select
  to anon, authenticated
  using (true);

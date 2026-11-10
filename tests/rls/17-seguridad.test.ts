// Ticket 17: auditoría del catálogo de Postgres. Falla si aparece una tabla
// sin RLS, una vista que no respete RLS, una función SECURITY DEFINER sin
// search_path fijo o expuesta sin revisión, una función ejecutable por `anon`,
// un privilegio de la API fuera de lo esperado o una política de Storage que
// deje escribir a alguien que no sea el Admin con 2FA.
//
// Si agregás una tabla, función o permiso a propósito, actualizá la lista
// esperada de este archivo: es la forma de que alguien lo revise.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clienteAnonimo } from "./helpers";

/** URL de Postgres local: SUPABASE_TEST_DB_URL o `supabase status`. */
function urlDeLaBase(): string {
  if (process.env.SUPABASE_TEST_DB_URL) return process.env.SUPABASE_TEST_DB_URL;
  const salida = execFileSync(path.resolve("node_modules/.bin/supabase"), ["status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const m = /^DB_URL="?(.*?)"?$/m.exec(salida);
  if (!m) throw new Error("`supabase status` no devolvió DB_URL");
  return m[1];
}

let db: Client;

beforeAll(async () => {
  db = new Client({ connectionString: urlDeLaBase() });
  await db.connect();
});

afterAll(async () => {
  await db?.end();
});

async function filas<T>(sql: string): Promise<T[]> {
  return (await db.query(sql)).rows as T[];
}

describe("tablas y vistas de public", () => {
  it("todas las tablas tienen RLS habilitado", async () => {
    const sinRls = await filas<{ tabla: string }>(`
      select c.relname as tabla
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
    `);
    expect(sinRls).toEqual([]);
  });

  it("no hay vistas que salteen RLS (sin security_invoker) ni tablas foráneas", async () => {
    const peligrosas = await filas<{ nombre: string }>(`
      select c.relname as nombre
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and (c.relkind in ('m', 'f')
             or (c.relkind = 'v' and not coalesce('security_invoker=true' = any (c.reloptions), false)))
    `);
    expect(peligrosas).toEqual([]);
  });

  it("anon y authenticated tienen exactamente los privilegios de tabla esperados", async () => {
    const grants = await filas<{ rol: string; tabla: string; privilegios: string }>(`
      select a.grantee::regrole::text as rol, c.relname as tabla,
             string_agg(a.privilege_type, ',' order by a.privilege_type) as privilegios
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
        and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
      group by 1, 2
      order by 1, 2
    `);
    // SELECT de anon sin políticas: RLS devuelve [] (contrato de los tests de RLS).
    expect(grants).toEqual([
      { rol: "anon", tabla: "club", privilegios: "SELECT" },
      { rol: "anon", tabla: "jugador", privilegios: "SELECT" },
      { rol: "anon", tabla: "partido", privilegios: "SELECT" },
      { rol: "anon", tabla: "perfil", privilegios: "SELECT" },
      { rol: "anon", tabla: "rival", privilegios: "SELECT" },
      { rol: "authenticated", tabla: "alineacion", privilegios: "SELECT" },
      { rol: "authenticated", tabla: "club", privilegios: "SELECT" },
      { rol: "authenticated", tabla: "jugador", privilegios: "INSERT,SELECT,UPDATE" },
      { rol: "authenticated", tabla: "once_real", privilegios: "DELETE,INSERT,SELECT" },
      { rol: "authenticated", tabla: "partido", privilegios: "DELETE,SELECT" },
      { rol: "authenticated", tabla: "perfil", privilegios: "SELECT" },
      // Interruptores "mi club" y "Selección" (Selección, ticket 13).
      { rol: "authenticated", tabla: "preferencia_notificacion", privilegios: "SELECT" },
      { rol: "authenticated", tabla: "resultado_votacion", privilegios: "SELECT" },
      { rol: "authenticated", tabla: "rival", privilegios: "DELETE,INSERT,SELECT,UPDATE" },
      { rol: "authenticated", tabla: "suscripcion_push", privilegios: "DELETE,SELECT" },
    ]);
  });

  it("los privilegios por columna son solo los de escritura acotada de authenticated", async () => {
    const grants = await filas<{ rol: string; tabla: string; privilegio: string; columnas: string }>(`
      select a.grantee::regrole::text as rol, c.relname as tabla, a.privilege_type as privilegio,
             string_agg(att.attname, ',' order by att.attname) as columnas
      from pg_attribute att
      join pg_class c on c.oid = att.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(att.attacl) a
      where n.nspname = 'public' and att.attnum > 0 and not att.attisdropped
        and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
      group by 1, 2, 3
      order by 1, 2, 3
    `);
    expect(grants).toEqual([
      {
        rol: "authenticated",
        tabla: "alineacion",
        privilegio: "INSERT",
        columnas: "esquema,esquema_elegido_a_mano,esquema_modificado_en,partido_id,puestos",
      },
      {
        rol: "authenticated",
        tabla: "alineacion",
        privilegio: "UPDATE",
        columnas: "esquema,esquema_elegido_a_mano,esquema_modificado_en,partido_id,puestos",
      },
      // El Admin cambia el escudo del Club (diseño pixel art, ticket 07).
      { rol: "authenticated", tabla: "club", privilegio: "UPDATE", columnas: "escudo_path" },
      { rol: "authenticated", tabla: "once_real", privilegio: "UPDATE", columnas: "jugadores" },
      { rol: "authenticated", tabla: "partido", privilegio: "INSERT", columnas: "club_id,estado,inicio,rival_id" },
      { rol: "authenticated", tabla: "partido", privilegio: "UPDATE", columnas: "estado,inicio,rival_id" },
      {
        rol: "authenticated",
        tabla: "preferencia_notificacion",
        privilegio: "INSERT",
        columnas: "hincha_id,mi_club,seleccion",
      },
      { rol: "authenticated", tabla: "preferencia_notificacion", privilegio: "UPDATE", columnas: "mi_club,seleccion" },
      {
        rol: "authenticated",
        tabla: "suscripcion_push",
        privilegio: "INSERT",
        columnas: "auth,endpoint,hincha_id,p256dh,user_agent",
      },
    ]);
  });

  it("las políticas son para anon o authenticated (nunca PUBLIC) y anon solo lee club", async () => {
    const politicas = await filas<{ tabla: string; politica: string; comando: string; roles: string[] }>(`
      select tablename as tabla, policyname as politica, cmd as comando, roles::text[] as roles
      from pg_policies where schemaname = 'public'
    `);
    expect(politicas.filter((p) => p.roles.includes("public"))).toEqual([]);
    expect(politicas.filter((p) => p.roles.includes("anon")).map((p) => [p.tabla, p.comando])).toEqual([
      ["club", "SELECT"],
    ]);
  });

  it("las tablas nuevas no nacen con TRUNCATE, TRIGGER, REFERENCES ni MAINTAIN para la API", async () => {
    await db.query("begin");
    try {
      await db.query("create table public.auditoria_17_tmp (id int)");
      const { rows } = await db.query(`
        select has_table_privilege('anon', 'public.auditoria_17_tmp', 'truncate') as anon_truncate,
               has_table_privilege('authenticated', 'public.auditoria_17_tmp', 'truncate') as auth_truncate,
               has_table_privilege('authenticated', 'public.auditoria_17_tmp', 'trigger') as auth_trigger,
               has_table_privilege('anon', 'public.auditoria_17_tmp', 'maintain') as anon_maintain
      `);
      expect(rows[0]).toEqual({ anon_truncate: false, auth_truncate: false, auth_trigger: false, anon_maintain: false });
    } finally {
      await db.query("rollback");
    }
  });
});

describe("funciones de public", () => {
  type Funcion = { funcion: string; definer: boolean; search_path: string | null; anon: boolean; authenticated: boolean };

  async function funciones(): Promise<Funcion[]> {
    return filas<Funcion>(`
      select p.oid::regprocedure::text as funcion,
             p.prosecdef as definer,
             (select c from unnest(p.proconfig) c where c like 'search_path=%') as search_path,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
      order by 1
    `);
  }

  it("todas tienen search_path fijo (vacío)", async () => {
    const sinSearchPath = (await funciones()).filter((f) => f.search_path !== 'search_path=""');
    expect(sinSearchPath).toEqual([]);
  });

  it("anon no puede ejecutar ninguna", async () => {
    expect((await funciones()).filter((f) => f.anon).map((f) => f.funcion)).toEqual([]);
  });

  it("las SECURITY DEFINER que puede llamar un usuario con sesión son las revisadas", async () => {
    // Cada una chequea la sesión o es_admin() adentro y solo devuelve datos
    // del propio usuario o lo que el Admin con 2FA puede ver.
    const expuestas = (await funciones()).filter((f) => f.definer && f.authenticated).map((f) => f.funcion);
    expect(expuestas.sort()).toEqual(
      [
        "buscar_hinchas(text)", // es_admin()
        "cambiar_club_favorito(uuid,text)", // es_admin()
        "elegir_club_favorito(text)", // auth.uid(), solo el propio perfil
        "elegir_solo_seleccion()", // auth.uid(), solo el propio perfil (Selección, ticket 06)
        "es_admin()", // bool del propio usuario
        "mi_club_favorito()", // Club del propio usuario
        "partido_tiene_alineaciones(uuid)", // es_admin()
        "registrar_suscripcion_push(text,text,text,text)", // auth.uid(), endpoint secreto del navegador
        "tengo_perfil()", // bool del propio usuario (Selección, ticket 05)
        "tiene_resultado(uuid)", // solo si existe el resultado (lo ve cualquier Hincha del Club)
      ].sort(),
    );
  });

  it("las SECURITY DEFINER de trigger no se pueden llamar por la API", async () => {
    const triggers = await filas<{ funcion: string }>(`
      select p.oid::regprocedure::text as funcion
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
        and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
    `);
    expect(triggers).toEqual([]);
  });

  it("las funciones nuevas no nacen ejecutables por PUBLIC ni anon", async () => {
    await db.query("begin");
    try {
      await db.query("create function public.auditoria_17_tmp() returns int language sql as 'select 1'");
      const { rows } = await db.query(
        "select has_function_privilege('anon', 'public.auditoria_17_tmp()', 'execute') as anon",
      );
      expect(rows[0]).toEqual({ anon: false });
    } finally {
      await db.query("rollback");
    }
  });

  it("por la API, anon recibe error al llamar funciones que antes podía ejecutar", async () => {
    const anon = clienteAnonimo();
    const puestos = await anon.rpc("puestos_de_esquema", { esquema: "4-3-3" });
    expect(puestos.error).not.toBeNull();
    const validos = await anon.rpc("alineacion_puestos_validos", { esquema: "4-3-3", puestos: {} });
    expect(validos.error).not.toBeNull();
  });
});

describe("Storage", () => {
  it("los buckets son de imágenes chicas y públicas solo para leer por URL", async () => {
    const buckets = await filas<{ id: string; public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      "select id, public, file_size_limit::text, allowed_mime_types from storage.buckets order by id",
    );
    expect(buckets).toEqual([
      // Escudos: solo PNG de hasta 64 KB (diseño pixel art, ticket 07).
      { id: "escudos", public: true, file_size_limit: "65536", allowed_mime_types: ["image/png"] },
    ]);
  });

  it("toda política de storage.objects es solo para el Admin con 2FA", async () => {
    const politicas = await filas<{ politica: string; roles: string[]; qual: string | null; with_check: string | null }>(`
      select policyname as politica, roles::text[] as roles, qual, with_check
      from pg_policies where schemaname = 'storage' and tablename = 'objects'
    `);
    expect(politicas.length).toBeGreaterThan(0);
    for (const p of politicas) {
      expect(p.roles, p.politica).toEqual(["authenticated"]);
      for (const expresion of [p.qual, p.with_check]) {
        if (expresion !== null) expect(expresion, p.politica).toMatch(/es_admin\(\)/);
      }
    }
  });

  it("anon no lista los archivos de los buckets", async () => {
    const anon = clienteAnonimo();
    for (const bucket of ["escudos"]) {
      const { data } = await anon.storage.from(bucket).list();
      expect(data ?? []).toEqual([]);
    }
  });
});

// Procesos programados desde la base (pg_cron + pg_net): `programar_crons()`
// agenda las tres rutas de cron leyendo la URL y el secreto de Vault.
//
// Los casos con secretos corren dentro de una transacción que se deshace:
// no dejan secretos ni jobs en la base local compartida.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clienteComo, clienteServicio } from "./helpers";

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

const SECRETO = "secreto-de-prueba-18-no-real";

type Job = { jobname: string; schedule: string; command: string; active: boolean };

async function jobs(): Promise<Job[]> {
  const { rows } = await db.query<Job>(
    "select jobname, schedule, command, active from cron.job where jobname like 'elegilos-vos-%' order by jobname",
  );
  return rows;
}

/** Corre `fn` en una transacción que se deshace al final. */
async function enTransaccion(fn: () => Promise<void>) {
  await db.query("begin");
  try {
    await fn();
  } finally {
    await db.query("rollback");
  }
}

async function guardarSecretos(appUrl: string, secreto: string) {
  // Si ya existen en la base local (alguien siguió el README), se pisan dentro de la transacción.
  await db.query("delete from vault.secrets where name in ('app_url', 'cron_secret')");
  await db.query("select vault.create_secret($1, 'app_url'), vault.create_secret($2, 'cron_secret')", [appUrl, secreto]);
}

describe("programar_crons", () => {
  it("las extensiones pg_cron y pg_net están habilitadas", async () => {
    const { rows } = await db.query("select extname from pg_extension where extname in ('pg_cron', 'pg_net') order by 1");
    expect(rows.map((r) => r.extname)).toEqual(["pg_cron", "pg_net"]);
  });

  it("sin los secretos en Vault no agenda nada y avisa con un NOTICE", async () => {
    await enTransaccion(async () => {
      await db.query("delete from vault.secrets where name in ('app_url', 'cron_secret')");
      await db.query("select public.desprogramar_crons()");
      const avisos: string[] = [];
      const escuchar = (n: { message?: string }) => avisos.push(n.message ?? "");
      db.on("notice", escuchar);
      try {
        const { rows } = await db.query("select public.programar_crons() as agendados");
        expect(rows[0].agendados).toEqual([]);
      } finally {
        db.off("notice", escuchar);
      }
      expect(avisos.join("\n")).toContain("faltan los secretos");
      expect(await jobs()).toEqual([]);
    });
  });

  it("con los secretos agenda las tres rutas cada minuto, sin escribir el secreto en cron.job", async () => {
    await enTransaccion(async () => {
      await guardarSecretos("https://app.ejemplo.test/", SECRETO);
      const { rows } = await db.query("select public.programar_crons() as agendados");
      expect(rows[0].agendados).toEqual(["elegilos-vos-cierre", "elegilos-vos-herencia", "elegilos-vos-notificaciones"]);

      const agendados = await jobs();
      expect(agendados.map((j) => [j.jobname, j.schedule, j.active])).toEqual([
        ["elegilos-vos-cierre", "* * * * *", true],
        ["elegilos-vos-herencia", "* * * * *", true],
        ["elegilos-vos-notificaciones", "* * * * *", true],
      ]);
      for (const j of agendados) {
        expect(j.command).toContain(`/api/cron/${j.jobname.replace("elegilos-vos-", "")}`);
        expect(j.command).toContain("vault.decrypted_secrets");
        expect(j.command).not.toContain(SECRETO);
        expect(j.command).not.toContain("app.ejemplo.test");
      }
    });
  });

  it("el comando de cada job arma la URL y la cabecera desde Vault", async () => {
    await enTransaccion(async () => {
      await guardarSecretos("https://app.ejemplo.test/", SECRETO);
      await db.query("select public.programar_crons()");
      const { rows } = await db.query<{ command: string }>(
        "select command from cron.job where jobname = 'elegilos-vos-cierre'",
      );
      // Evalúa las mismas expresiones que usa el comando, sin hacer el pedido.
      const expresion = rows[0]!.command.match(/url := ([\s\S]*?),\s*headers := ([\s\S]*?),\s*timeout_milliseconds/);
      expect(expresion).not.toBeNull();
      const { rows: evaluado } = await db.query(`select ${expresion![1]} as url, ${expresion![2]} as headers`);
      expect(evaluado[0]).toEqual({
        url: "https://app.ejemplo.test/api/cron/cierre",
        headers: { Authorization: `Bearer ${SECRETO}` },
      });
    });
  });

  it("es idempotente: llamarla otra vez no duplica los jobs", async () => {
    await enTransaccion(async () => {
      await guardarSecretos("https://app.ejemplo.test", SECRETO);
      await db.query("select public.programar_crons()");
      await db.query("select public.programar_crons()");
      expect((await jobs()).map((j) => j.jobname)).toEqual([
        "elegilos-vos-cierre",
        "elegilos-vos-herencia",
        "elegilos-vos-notificaciones",
      ]);
      const { rows } = await db.query("select public.desprogramar_crons() as sacados");
      expect(rows[0].sacados).toHaveLength(3);
      expect(await jobs()).toEqual([]);
    });
  });

  it("un Hincha no la puede llamar por la API; la service role sí", async () => {
    const hincha = clienteComo("hinchaPenarol");
    expect((await hincha.rpc("programar_crons")).error).not.toBeNull();
    expect((await hincha.rpc("desprogramar_crons")).error).not.toBeNull();
    // La service role puede (sin secretos en la base local de tests no agenda nada,
    // o re-agenda lo mismo si alguien siguió el README).
    const { error } = await clienteServicio().rpc("programar_crons");
    expect(error).toBeNull();
  });
});

// La ruta de cron solo corre con el secreto. La materialización en sí se
// prueba contra Supabase local en tests/rls/10-herencia.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const materializarHerencias = vi.fn(async () => [{ club: "penarol", partidoId: "p", anteriorId: "a", creadas: 2 }]);
vi.mock("@/lib/herencia/materializar", () => ({ materializarHerencias }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: () => ({}) }));

const { GET } = await import("./route");

const pedido = (authorization?: string) =>
  new Request("http://localhost/api/cron/herencia", authorization ? { headers: { authorization } } : undefined);

describe("GET /api/cron/herencia", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "secreto-de-prueba");
    materializarHerencias.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("responde 401 sin secreto y no materializa", async () => {
    const respuesta = await GET(pedido());
    expect(respuesta.status).toBe(401);
    expect(materializarHerencias).not.toHaveBeenCalled();
  });

  it("responde 401 con un secreto incorrecto", async () => {
    expect((await GET(pedido("Bearer otro"))).status).toBe(401);
    expect((await GET(pedido("secreto-de-prueba"))).status).toBe(401);
    expect(materializarHerencias).not.toHaveBeenCalled();
  });

  it("responde 401 si el servidor no tiene CRON_SECRET configurado", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(pedido("Bearer "))).status).toBe(401);
    expect(materializarHerencias).not.toHaveBeenCalled();
  });

  it("con el secreto, materializa y devuelve el resumen", async () => {
    const respuesta = await GET(pedido("Bearer secreto-de-prueba"));
    expect(respuesta.status).toBe(200);
    expect(materializarHerencias).toHaveBeenCalledOnce();
    expect(await respuesta.json()).toEqual({
      ok: true,
      resultados: [{ club: "penarol", partidoId: "p", anteriorId: "a", creadas: 2 }],
    });
  });
});

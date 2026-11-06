import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...args: unknown[]) => sendNotification(...args) } }));

const { crearEnvioWebPush } = await import("./web-push");

const env = {
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "publica",
  VAPID_PRIVATE_KEY: "privada",
  VAPID_SUBJECT: "mailto:test@example.com",
};
const suscripcion = { endpoint: "https://push.example.com/x", p256dh: "p", auth: "a" };
const mensaje = { titulo: "t", cuerpo: "c", url: "/", etiqueta: "e" };

beforeEach(() => sendNotification.mockReset());

describe("crearEnvioWebPush", () => {
  it("sin alguna variable VAPID devuelve null (el envío se saltea)", () => {
    for (const falta of Object.keys(env)) {
      expect(crearEnvioWebPush({ ...env, [falta]: "" })).toBeNull();
    }
  });

  it("envía el mensaje como JSON con las claves VAPID", async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });
    expect(await crearEnvioWebPush(env)!(suscripcion, mensaje)).toBe("ok");
    const [sub, cuerpo, opciones] = sendNotification.mock.calls[0]!;
    expect(sub).toEqual({ endpoint: suscripcion.endpoint, keys: { p256dh: "p", auth: "a" } });
    expect(JSON.parse(cuerpo)).toEqual(mensaje);
    expect(opciones.vapidDetails).toEqual({ subject: env.VAPID_SUBJECT, publicKey: "publica", privateKey: "privada" });
  });

  it("404 y 410 son suscripciones vencidas; otros errores, error", async () => {
    const enviar = crearEnvioWebPush(env)!;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [statusCode, esperado] of [[404, "vencida"], [410, "vencida"], [500, "error"], [undefined, "error"]] as const) {
      sendNotification.mockRejectedValueOnce(Object.assign(new Error("x"), { statusCode }));
      expect(await enviar(suscripcion, mensaje)).toBe(esperado);
    }
  });
});

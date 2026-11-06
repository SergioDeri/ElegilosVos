import { describe, expect, it } from "vitest";
import { validarSuscripcion } from "./index";

const P256DH = "BLlKA3Z0rjh4r1zf9dh0XU7iSiNfRr0KqQSlDWMNASyEcHKazYILP-fa3_o6lOzTbscjdNWJmoyUcBdAlvhGZH8";
const AUTH = "dGqD8bRY8VSDmHmb6-boAQ";
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";

const valida = { endpoint: ENDPOINT, expirationTime: null, keys: { p256dh: P256DH, auth: AUTH } };

describe("validarSuscripcion", () => {
  it("acepta un PushSubscription serializado (toJSON) y devuelve lo que se guarda", () => {
    expect(validarSuscripcion(valida)).toEqual({ ok: true, suscripcion: { endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH } });
  });

  it("acepta las claves con padding base64", () => {
    const r = validarSuscripcion({ ...valida, keys: { p256dh: `${P256DH}=`, auth: `${AUTH}==` } });
    expect(r.ok).toBe(true);
  });

  it("rechaza lo que no es un objeto o le faltan campos", () => {
    for (const malo of [null, "x", 1, {}, { endpoint: ENDPOINT }, { endpoint: ENDPOINT, keys: { p256dh: P256DH } }]) {
      expect(validarSuscripcion(malo)).toEqual({ ok: false });
    }
  });

  it("exige endpoint https y de largo razonable", () => {
    for (const endpoint of ["http://fcm.googleapis.com/x", "javascript:alert(1)", "no es url", `https://a.com/${"x".repeat(2100)}`]) {
      expect(validarSuscripcion({ ...valida, endpoint })).toEqual({ ok: false });
    }
  });

  it("exige claves base64url del largo de P-256 (65 bytes) y auth (16 bytes)", () => {
    for (const keys of [
      { p256dh: P256DH.slice(1), auth: AUTH },
      { p256dh: P256DH, auth: `${AUTH}AAAA` },
      { p256dh: `${P256DH.slice(0, -1)}!`, auth: AUTH },
      { p256dh: P256DH, auth: 123 },
    ]) {
      expect(validarSuscripcion({ ...valida, keys })).toEqual({ ok: false });
    }
  });
});

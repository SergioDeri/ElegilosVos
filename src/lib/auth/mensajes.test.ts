import { describe, expect, it } from "vitest";
import { mensajeDeErrorAuth } from "./mensajes";

describe("mensajeDeErrorAuth", () => {
  it("credenciales inválidas no dicen si el email existe", () => {
    expect(mensajeDeErrorAuth({ code: "invalid_credentials", status: 400 })).toBe("Email o contraseña incorrectos.");
  });

  it("los límites de frecuencia piden esperar", () => {
    expect(mensajeDeErrorAuth({ code: "over_email_send_rate_limit", status: 429 })).toMatch(/esperá/i);
    expect(mensajeDeErrorAuth({ code: "over_request_rate_limit", status: 429 })).toMatch(/demasiados intentos/i);
    expect(mensajeDeErrorAuth({ code: undefined, status: 429 })).toMatch(/demasiados intentos/i);
  });

  it("un código vencido o incorrecto se explica igual", () => {
    expect(mensajeDeErrorAuth({ code: "otp_expired", status: 403 })).toBe("El código es incorrecto o venció.");
  });

  it("la contraseña débil explica el mínimo", () => {
    expect(mensajeDeErrorAuth({ code: "weak_password", status: 422 })).toMatch(/8 caracteres/);
  });

  it("un error desconocido da un mensaje genérico", () => {
    expect(mensajeDeErrorAuth({ code: "algo_raro", status: 500 })).toBe("Algo salió mal. Probá de nuevo.");
  });
});

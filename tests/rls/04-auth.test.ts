// Tests de RLS del ticket 04: perfil del Hincha y Club Favorito.
// Todo se prueba con llamadas directas a la API (PostgREST / Auth), que es lo
// mismo que podría hacer un Hincha malicioso con su token.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  borrarUsuario,
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  crearUsuario,
  entorno,
  usuario,
  type Cliente,
} from "./helpers";

async function perfilSegunServicio(id: string) {
  const { data, error } = await clienteServicio()
    .from("perfil")
    .select("club_favorito_id, rol")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

describe("perfil: lectura", () => {
  it("el Hincha lee su propio perfil", async () => {
    const { data, error } = await clienteComo("hinchaPenarol").from("perfil").select("id, club_favorito_id, rol");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: usuario("hinchaPenarol").id, club_favorito_id: "penarol", rol: "hincha" }]);
  });

  it("el Hincha no lee perfiles ajenos", async () => {
    const { data } = await clienteComo("hinchaPenarol")
      .from("perfil")
      .select("id")
      .eq("id", usuario("hinchaNacional").id);
    expect(data).toEqual([]);
  });

  it("el Admin sin 2FA tampoco lee perfiles ajenos", async () => {
    const { data } = await clienteComo("admin").from("perfil").select("id").neq("id", usuario("admin").id);
    expect(data).toEqual([]);
  });

  it("un anónimo no lee perfiles", async () => {
    const { data } = await clienteAnonimo().from("perfil").select("id");
    expect(data).toEqual([]);
  });
});

describe("perfil: escrituras directas por la API", () => {
  const penarol = () => clienteComo("hinchaPenarol");
  const idPenarol = () => usuario("hinchaPenarol").id;

  it("el Hincha no puede cambiar su Club Favorito con un UPDATE", async () => {
    const { data, error } = await penarol()
      .from("perfil")
      .update({ club_favorito_id: "nacional" })
      .eq("id", idPenarol())
      .select();
    expect(error).not.toBeNull();
    expect(data).toBeNull();
    expect((await perfilSegunServicio(idPenarol())).club_favorito_id).toBe("penarol");
  });

  it("el Hincha no puede ascenderse a Admin", async () => {
    const { error } = await penarol().from("perfil").update({ rol: "admin" }).eq("id", idPenarol()).select();
    expect(error).not.toBeNull();
    expect((await perfilSegunServicio(idPenarol())).rol).toBe("hincha");
  });

  it("el Hincha no puede cambiar el perfil de otro", async () => {
    const idNacional = usuario("hinchaNacional").id;
    const { error } = await penarol()
      .from("perfil")
      .update({ club_favorito_id: "penarol" })
      .eq("id", idNacional)
      .select();
    expect(error).not.toBeNull();
    expect((await perfilSegunServicio(idNacional)).club_favorito_id).toBe("nacional");
  });

  it("el Hincha no puede crear ni borrar perfiles (ni con upsert)", async () => {
    const insert = await penarol().from("perfil").insert({ id: crypto.randomUUID(), rol: "admin" });
    expect(insert.error).not.toBeNull();

    const upsert = await penarol()
      .from("perfil")
      .upsert({ id: idPenarol(), club_favorito_id: "nacional", rol: "admin" });
    expect(upsert.error).not.toBeNull();

    const borrado = await penarol().from("perfil").delete().eq("id", idPenarol()).select();
    expect(borrado.error).not.toBeNull();
    expect(await perfilSegunServicio(idPenarol())).toEqual({ club_favorito_id: "penarol", rol: "hincha" });
  });

  it("el Admin sin 2FA tampoco puede cambiar perfiles", async () => {
    const { error } = await clienteComo("admin")
      .from("perfil")
      .update({ club_favorito_id: "nacional" })
      .eq("id", usuario("hinchaPenarol").id)
      .select();
    expect(error).not.toBeNull();
    expect((await perfilSegunServicio(idPenarol())).club_favorito_id).toBe("penarol");
  });
});

describe("elegir_club_favorito()", () => {
  let nuevo: { id: string; cliente: Cliente };

  beforeAll(async () => {
    nuevo = await crearUsuario({ club: null });
  });

  afterAll(async () => {
    if (nuevo) await borrarUsuario(nuevo.id);
  });

  it("un anónimo no la puede llamar", async () => {
    const { error } = await clienteAnonimo().rpc("elegir_club_favorito", { club: "penarol" });
    expect(error).not.toBeNull();
  });

  it("rechaza un club inexistente", async () => {
    const { error } = await nuevo.cliente.rpc("elegir_club_favorito", { club: "defensor" });
    expect(error?.code).toBe("22023");
    expect((await perfilSegunServicio(nuevo.id)).club_favorito_id).toBeNull();
  });

  it("un Hincha sin Club Favorito lo elige una vez", async () => {
    const { data, error } = await nuevo.cliente.rpc("elegir_club_favorito", { club: "nacional" });
    expect(error).toBeNull();
    expect(data).toBe("nacional");
    expect(await perfilSegunServicio(nuevo.id)).toEqual({ club_favorito_id: "nacional", rol: "hincha" });
  });

  it("después no lo puede cambiar, ni por la función ni con un UPDATE", async () => {
    const porFuncion = await nuevo.cliente.rpc("elegir_club_favorito", { club: "penarol" });
    expect(porFuncion.error?.code).toBe("EV001");

    const porUpdate = await nuevo.cliente.from("perfil").update({ club_favorito_id: "penarol" }).eq("id", nuevo.id).select();
    expect(porUpdate.error).not.toBeNull();

    expect((await perfilSegunServicio(nuevo.id)).club_favorito_id).toBe("nacional");
  });

  it("un Hincha estándar (que ya eligió) tampoco lo puede cambiar", async () => {
    const { error } = await clienteComo("hinchaNacional").rpc("elegir_club_favorito", { club: "penarol" });
    expect(error?.code).toBe("EV001");
    expect((await perfilSegunServicio(usuario("hinchaNacional").id)).club_favorito_id).toBe("nacional");
  });
});

// -----------------------------------------------------------------------------
// Registro con email + código OTP. Requiere que Auth tenga la confirmación de
// email activada (supabase/config.toml del ticket 04). Si el Supabase local se
// levantó con una config vieja (autoconfirm), se saltea: reiniciá Supabase
// (`npx supabase stop && npx supabase start`) para que tome la config nueva.
// -----------------------------------------------------------------------------
const MAILPIT_URL = process.env.SUPABASE_TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";

async function confirmacionActivada(): Promise<boolean> {
  const { url, anonKey } = entorno();
  const respuesta = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
  const ajustes = (await respuesta.json()) as { mailer_autoconfirm?: boolean };
  return ajustes.mailer_autoconfirm === false;
}

async function codigoEnviadoA(email: string): Promise<string> {
  for (let intento = 0; intento < 20; intento++) {
    const busqueda = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = (await busqueda.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const mensaje = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`);
      const { Text, HTML } = (await mensaje.json()) as { Text: string; HTML: string };
      const codigo = /\b(\d{6})\b/.exec(Text || HTML)?.[1];
      if (codigo) return codigo;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No llegó el código a ${email}`);
}

describe("registro con email y código", async () => {
  const activada = await confirmacionActivada();
  const email = `registro.${crypto.randomUUID()}@rls.test`;
  const contrasena = "contrasena-segura-123";
  let idCreado: string | undefined;

  afterAll(async () => {
    if (idCreado) await borrarUsuario(idCreado);
  });

  it.skipIf(!activada)("sin verificar el código no hay sesión; con el código, sí; el reenvío está limitado", async () => {
    const auth = clienteAnonimo().auth;

    const registro = await auth.signUp({ email, password: contrasena });
    expect(registro.error).toBeNull();
    expect(registro.data.session).toBeNull();
    idCreado = registro.data.user?.id;

    const login = await auth.signInWithPassword({ email, password: contrasena });
    expect(login.error?.code).toBe("email_not_confirmed");

    // Reenviar enseguida está limitado (max_frequency = 60 s).
    const reenvio = await auth.resend({ type: "signup", email });
    expect(reenvio.error?.status).toBe(429);

    const codigoMalo = await auth.verifyOtp({ email, token: "000000", type: "signup" });
    expect(codigoMalo.error).not.toBeNull();

    const codigo = await codigoEnviadoA(email);
    const verificacion = await auth.verifyOtp({ email, token: codigo, type: "signup" });
    expect(verificacion.error).toBeNull();
    expect(verificacion.data.session).not.toBeNull();

    // El perfil nace sin Club Favorito.
    expect(await perfilSegunServicio(idCreado!)).toEqual({ club_favorito_id: null, rol: "hincha" });
  });
});

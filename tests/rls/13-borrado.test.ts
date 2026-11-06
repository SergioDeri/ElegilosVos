// Tests del ticket 13: borrado de cuenta.
//
// Prueba `borrarCuentaDeSesion` (la función de servidor que usa la Server
// Action) con usuarios creados acá: nunca con los usuarios estándar del setup
// global. Cada usuario inicia sesión una vez con un cliente propio, para que
// `auth.getUser()` tenga una sesión real como en la app.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ClubId, Rol } from "@/domain/comun/tipos";
import { borrarCuentaDeSesion } from "@/lib/cuenta/borrado";
import { partidoAbierto } from "./datos";
import { borrarUsuario, clienteAnonimo, clienteServicio, type Cliente } from "./helpers";
import { CONTRASENA_DE_PRUEBA } from "./usuarios";

type UsuarioConSesion = { id: string; cliente: Cliente };

const creados: string[] = [];

/** Crea un usuario con la service role e inicia sesión con un cliente propio (un login). */
async function crearConSesion(club: ClubId, rol: Rol = "hincha"): Promise<UsuarioConSesion> {
  const servicio = clienteServicio();
  const email = `borrado.${crypto.randomUUID()}@rls.test`;
  const { data, error } = await servicio.auth.admin.createUser({ email, password: CONTRASENA_DE_PRUEBA, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  creados.push(id);
  const { error: errorPerfil } = await servicio.from("perfil").update({ club_favorito_id: club, rol }).eq("id", id);
  if (errorPerfil) throw errorPerfil;

  const cliente = clienteAnonimo();
  const { error: errorLogin } = await cliente.auth.signInWithPassword({ email, password: CONTRASENA_DE_PRUEBA });
  if (errorLogin) throw errorLogin;
  return { id, cliente };
}

async function arqueroDisponible(): Promise<string> {
  const { data, error } = await clienteServicio()
    .from("jugador")
    .select("id")
    .eq("club_id", "penarol")
    .eq("en_plantel", true)
    .eq("disponibilidad", "disponible")
    .eq("posicion_natural", "ARQ")
    .limit(1)
    .single();
  if (error) throw error;
  return data.id;
}

async function guardarAlineacion(hincha: UsuarioConSesion, partidoId: string, arquero: string) {
  const { error } = await hincha.cliente.from("alineacion").upsert(
    {
      partido_id: partidoId,
      esquema: "4-3-3",
      esquema_elegido_a_mano: true,
      puestos: { ARQ: { jugadorId: arquero, modificadoEn: new Date().toISOString() } },
    },
    { onConflict: "hincha_id,partido_id" },
  );
  if (error) throw error;
}

async function hinchasConAlineacion(partidoId: string): Promise<string[]> {
  const { data, error } = await clienteServicio().from("alineacion").select("hincha_id").eq("partido_id", partidoId);
  if (error) throw error;
  return data.map((a) => a.hincha_id);
}

async function existePerfil(id: string): Promise<boolean> {
  const { data, error } = await clienteServicio().from("perfil").select("id").eq("id", id);
  if (error) throw error;
  return data.length > 0;
}

afterAll(async () => {
  for (const id of creados) await borrarUsuario(id);
});

describe("borrado de cuenta", () => {
  let borrado: UsuarioConSesion;
  let otro: UsuarioConSesion;
  let partido: string;

  beforeAll(async () => {
    partido = await partidoAbierto("penarol");
    const arquero = await arqueroDisponible();
    borrado = await crearConSesion("penarol");
    otro = await crearConSesion("penarol");
    await guardarAlineacion(borrado, partido, arquero);
    await guardarAlineacion(otro, partido, arquero);
  });

  it("un Hincha no puede borrar a otro por la API", async () => {
    // Sin service role, la API de administración de Auth no responde.
    const { error } = await otro.cliente.auth.admin.deleteUser(borrado.id);
    expect(error).not.toBeNull();
    // Y RLS no deja borrar perfiles ni Alineaciones ajenas (ni propias).
    const { data: perfiles } = await otro.cliente.from("perfil").delete().eq("id", borrado.id).select();
    expect(perfiles ?? []).toEqual([]);
    const { data: alineaciones } = await otro.cliente.from("alineacion").delete().eq("hincha_id", borrado.id).select();
    expect(alineaciones ?? []).toEqual([]);

    expect(await existePerfil(borrado.id)).toBe(true);
    expect(await hinchasConAlineacion(partido)).toContain(borrado.id);
  });

  it("borra al usuario de la sesión: Auth, perfil y Alineaciones", async () => {
    expect(await hinchasConAlineacion(partido)).toContain(borrado.id);

    const resultado = await borrarCuentaDeSesion(borrado.cliente, clienteServicio());
    expect(resultado).toEqual({ ok: true, id: borrado.id });

    const servicio = clienteServicio();
    const { error } = await servicio.auth.admin.getUserById(borrado.id);
    expect(error?.status).toBe(404);
    expect(await existePerfil(borrado.id)).toBe(false);
    const { data: alineaciones } = await servicio.from("alineacion").select("id").eq("hincha_id", borrado.id);
    expect(alineaciones).toEqual([]);
    // Su Alineación ya no está entre las de la Votación abierta (no cuenta en el Parcial ni en el cierre).
    expect(await hinchasConAlineacion(partido)).not.toContain(borrado.id);
  });

  it("solo borra al de la sesión: el otro Hincha y su Alineación siguen", async () => {
    expect(await existePerfil(otro.id)).toBe(true);
    expect(await hinchasConAlineacion(partido)).toContain(otro.id);
    const { error } = await clienteServicio().auth.admin.getUserById(otro.id);
    expect(error).toBeNull();
  });

  it("con la sesión de un usuario ya borrado no borra nada", async () => {
    const resultado = await borrarCuentaDeSesion(borrado.cliente, clienteServicio());
    expect(resultado).toMatchObject({ ok: false, motivo: "sin-sesion" });
    expect(await existePerfil(otro.id)).toBe(true);
  });

  it("sin sesión no borra nada", async () => {
    const resultado = await borrarCuentaDeSesion(clienteAnonimo(), clienteServicio());
    expect(resultado).toMatchObject({ ok: false, motivo: "sin-sesion" });
  });

  it("un Admin no puede borrar su cuenta desde la app", async () => {
    const admin = await crearConSesion("penarol", "admin");
    const resultado = await borrarCuentaDeSesion(admin.cliente, clienteServicio());
    expect(resultado).toMatchObject({ ok: false, motivo: "es-admin" });
    expect(await existePerfil(admin.id)).toBe(true);
  });
});

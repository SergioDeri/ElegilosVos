// Diseño pixel art, ticket 08: las fotos de Jugador ya no existen. La
// migración borró la columna `jugador.foto_path`, las políticas y el bucket
// `jugadores` con sus archivos.
import { describe, expect, it } from "vitest";
import { clienteAnonimo, clienteComo, clienteServicio, type Cliente } from "./helpers";

describe("sin fotos de Jugador", () => {
  it("la tabla jugador no tiene columna de foto", async () => {
    const { error } = await clienteServicio().from("jugador").select("foto_path").limit(1);
    expect(error?.message).toMatch(/foto_path/);
    const { data, error: errorTodo } = await clienteServicio().from("jugador").select().limit(1).single();
    expect(errorTodo).toBeNull();
    expect(data).not.toHaveProperty("foto_path");
  });

  it("el bucket de fotos ya no existe", async () => {
    const { data, error } = await clienteServicio().storage.getBucket("jugadores");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    const { data: buckets } = await clienteServicio().storage.listBuckets();
    expect((buckets ?? []).map((b) => b.id)).not.toContain("jugadores");
  });

  it.each<[string, () => Cliente]>([
    ["un anónimo", () => clienteAnonimo()],
    ["un Hincha", () => clienteComo("hinchaPenarol")],
  ])("%s no puede subir al bucket de fotos", async (_, cliente) => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const { error } = await cliente()
      .storage.from("jugadores")
      .upload(`pruebas/${crypto.randomUUID()}.png`, png, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });
});

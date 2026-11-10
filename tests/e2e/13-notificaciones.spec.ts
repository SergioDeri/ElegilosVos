// Selección, ticket 13: interruptores "mi club" y "Selección" en Mi cuenta.
// Prendidos por defecto; el cambio queda guardado en la base.
import { expect, iniciarSesion, test } from "./fixtures";
import { clienteServicio } from "./usuarios";

test('un Hincha con Club ve "mi club" y "Selección" prendidos y apaga la Selección', async ({ page, crearHincha }) => {
  const hincha = await crearHincha({ club: "penarol" });
  await iniciarSesion(page, hincha);
  await page.goto("/cuenta");

  const miClub = page.getByRole("checkbox", { name: "Avisos de mi club" });
  const seleccion = page.getByRole("checkbox", { name: "Avisos de la Selección" });
  await expect(miClub).toBeChecked();
  await expect(seleccion).toBeChecked();

  await seleccion.uncheck();
  await expect(seleccion).not.toBeChecked();
  await expect(seleccion).toBeEnabled();
  await expect
    .poll(async () => {
      const { data } = await clienteServicio()
        .from("preferencia_notificacion")
        .select("mi_club, seleccion")
        .eq("hincha_id", hincha.id)
        .maybeSingle();
      return data;
    })
    .toEqual({ mi_club: true, seleccion: false });

  await page.reload();
  await expect(seleccion).not.toBeChecked();
  await expect(miClub).toBeChecked();
});

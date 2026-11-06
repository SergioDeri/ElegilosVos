// Búsqueda de Hinchas por email para cambiarles el Club Favorito.
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { esClubId } from "@/domain/comun/tipos";
import { FormularioClubHincha } from "../_componentes/formularios";

export default async function PaginaHinchas({ searchParams }: PageProps<"/admin/hinchas">) {
  await requerirAdmin();
  const { email } = await searchParams;
  const texto = typeof email === "string" ? email.trim() : "";

  let hinchas: { id: string; email: string; club_favorito_id: string | null; rol: string }[] = [];
  if (texto.length >= 3) {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.rpc("buscar_hinchas", { texto });
    if (error) throw error;
    hinchas = data;
  }

  return (
    <main>
      <h1>Hinchas</h1>
      <form method="get">
        <label>
          Email (o parte) <input name="email" defaultValue={texto} minLength={3} required />
        </label>{" "}
        <button type="submit">Buscar</button>
      </form>

      {texto.length >= 3 && hinchas.length === 0 && <p>No hay Hinchas con ese email.</p>}
      {hinchas.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Club Favorito</th>
              <th>Cambiar</th>
            </tr>
          </thead>
          <tbody>
            {hinchas.map((h) => {
              const club = esClubId(h.club_favorito_id) ? h.club_favorito_id : null;
              return (
                <tr key={h.id}>
                  <td>
                    {h.email}
                    {h.rol === "admin" ? " (Admin)" : ""}
                  </td>
                  <td>{club ? NOMBRE_CLUB[club] : "Sin elegir"}</td>
                  <td>
                    <FormularioClubHincha hinchaId={h.id} clubActual={club} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {hinchas.length === 50 && <p>Se muestran los primeros 50. Afiná la búsqueda.</p>}
    </main>
  );
}

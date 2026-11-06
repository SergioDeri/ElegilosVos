# Next.js + Supabase con la seguridad en la base de datos

El repo es público, así que ninguna regla de acceso puede depender de que el código sea secreto. Se usa Next.js (web responsive, deploy en Vercel) con Supabase. Toda la autorización vive en Postgres mediante Row Level Security: cada Hincha solo lee y escribe su propia Alineación, el Parcial y el 11 Elegido se exponen solo agregados, y las escrituras del backoffice requieren el rol de Admin (con 2FA). Los secretos van solo en variables de entorno, y la service key nunca llega al cliente.

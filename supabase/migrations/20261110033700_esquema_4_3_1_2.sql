-- Esquema 4-3-1-2: se agrega al catálogo SQL de Esquemas. Tiene que coincidir
-- con src/domain/esquemas/catalogo.ts (lo verifica tests/rls/09-alineacion).
-- Mismo cuerpo que en 20261106200900_09_alineacion.sql más la fila nueva; la
-- firma no cambia, así que los grants y los check que la usan siguen valiendo.
create or replace function public.puestos_de_esquema(esquema text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case esquema
    when '4-3-3'   then array['ARQ','LI','ZAG_I','ZAG_D','LD','CINCO','INT_I','INT_D','EXT_I','DEL','EXT_D']
    when '4-4-2'   then array['ARQ','LI','ZAG_I','ZAG_D','LD','VOL_I','MC_I','MC_D','VOL_D','DEL_I','DEL_D']
    when '4-2-3-1' then array['ARQ','LI','ZAG_I','ZAG_D','LD','MC_I','MC_D','EXT_I','ENG','EXT_D','DEL']
    when '3-5-2'   then array['ARQ','ZAG_I','ZAG_C','ZAG_D','CAR_I','INT_I','CINCO','INT_D','CAR_D','DEL_I','DEL_D']
    when '5-3-2'   then array['ARQ','CAR_I','ZAG_I','ZAG_C','ZAG_D','CAR_D','INT_I','CINCO','INT_D','DEL_I','DEL_D']
    when '4-1-4-1' then array['ARQ','LI','ZAG_I','ZAG_D','LD','CINCO','VOL_I','INT_I','INT_D','VOL_D','DEL']
    when '4-3-1-2' then array['ARQ','LI','ZAG_I','ZAG_D','LD','CINCO','INT_I','INT_D','ENG','DEL_I','DEL_D']
  end;
$$;

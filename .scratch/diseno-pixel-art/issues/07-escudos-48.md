# 07: Escudos pixel 48x48: validación, sección Clubes y hueco "falta escudo"

**What to build:** Todo escudo, de Club o de Rival, tiene que ser un PNG pixel art de exactamente 48x48. El backoffice rechaza cualquier otro archivo con un mensaje claro. Se suma una sección "Clubes" donde el Admin sube o reemplaza el escudo de Peñarol y el de Nacional, guardado en el bucket público de escudos y en la columna de escudo del Club, que ya existe. Los escudos se muestran sin suavizado, más grandes que las Camisetas. Donde falta uno aparece un hueco pixelado de 48x48 de "falta escudo": en la tarjeta del Partido y en el backoffice.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Hay una validación de dominio, al lado de la validación de imágenes que ya existe: el archivo tiene que ser PNG por su firma y declarar 48x48 en su cabecera. Devuelve los motivos `vacia`, `tamano`, `formato` y `dimensiones`, y cada uno tiene tests
- [ ] La subida de escudo de los Rivales usa la validación nueva
- [ ] La sección "Clubes" del backoffice permite subir y reemplazar el escudo de cada Club, y borra el escudo anterior al reemplazarlo
- [ ] Una migración nueva (sin tocar las existentes) permite que solo el Admin actualice el escudo del Club y suba o reemplace archivos en el bucket de escudos, siguiendo las convenciones de RLS
- [ ] Tests de RLS en un archivo nuevo: el Admin puede; un Hincha y un anónimo no pueden; cualquiera puede leer el escudo
- [ ] El hueco "falta escudo" aparece cuando no hay escudo, para Clubes y para Rivales
- [ ] Los escudos se ven nítidos (`image-rendering: pixelated`) y en múltiplos enteros de `--px`
- [ ] `npm run typecheck && npm run lint && npm test && npm run test:rls` pasan

# 06: Registro "solo Selección" y aviso

**What to build:** En el selector de Club del registro aparece "Quiero votar solo por la Selección". Quien la elige queda sin Club Favorito pero con la elección hecha (el perfil lo registra), así que entra directo a la Selección y no vuelve a la pantalla de elegir Club. No ve ni puede abrir pantallas de un Club. Después de guardar su primera Alineación de la Selección se le invita a elegir Club; puede descartarlo y elegirlo más tarde desde su cuenta, una sola vez y para siempre. Los Hinchas que ya tenían Club ven una sola vez (por dispositivo) un aviso de que ahora pueden votar a la Selección, que los lleva ahí.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] El selector de Club del registro ofrece "Quiero votar solo por la Selección" y explica que el Club se puede elegir después
- [ ] Un Hincha sin Club entra directo a la Selección y no ve pantallas de Clubes
- [ ] Invitación a elegir Club después de la primera Alineación de la Selección guardada, descartable
- [ ] Elegir Club desde la cuenta funciona una sola vez y queda fijo
- [ ] Aviso único de la Selección para Hinchas con Club
- [ ] Tests de RLS: un Hincha sin Club guarda Alineaciones de la Selección y no de un Club; "solo Selección" y después un Club funciona una sola vez
- [ ] E2E: registro con "solo Selección" → arma y guarda → aparece la invitación a elegir Club
- [ ] E2E: Hincha con Club ve el aviso una sola vez y cambia con el selector
- [ ] Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls` && npm run test:e2e

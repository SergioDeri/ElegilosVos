# 04: Parcial, resultados y link compartido en la cancha pixel

**What to build:** El Parcial, el 11 Elegido, el 11 Real, la Coincidencia y el link público del 11 Elegido se muestran en la cancha pixel adaptable, con Camisetas, número y apellido. Los porcentajes por Esquema y por Puesto, la Coincidencia y los demás números usan la fuente pixel. Así, quien abre el link compartido ve la misma estética.

Spec: `.scratch/diseno-pixel-art/spec.md`. ADR 0004 (pixel art en DOM con `--px` entero). Prototipo de referencia: rama `prototype/camisetas`, `/prototipo-camisetas?variant=D`.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] El Parcial se ve en la cancha pixel, con la misma disposición sin choques
- [ ] El 11 Elegido y el 11 Real se ven en la cancha pixel (el 11 Real no tiene Esquema: se muestra como hoy, con el estilo nuevo)
- [ ] Los porcentajes y la Coincidencia usan la fuente pixel y respetan la grilla
- [ ] La página pública del 11 Elegido tiene el estilo pixel y funciona sin sesión
- [ ] Revisado a ojo en celu vertical, celu acostado y desktop
- [ ] `npm run typecheck && npm run lint && npm test` pasan

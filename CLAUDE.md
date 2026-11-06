# Elegilos Vos

## Git

- Commits y PRs **sin ninguna atribución a Claude/IA**: nada de `Co-Authored-By: Claude`, ni "Generated with Claude Code". El único autor debe ser el usuario (identidad de `git config`). No modificar `--author` ni la identidad de git.

## Agent skills

### Issue tracker

Issues y specs como archivos markdown en `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Los cinco roles canónicos con sus nombres por defecto (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` en la raíz. See `docs/agents/domain.md`.

## Código

- Antes de tocar código, leé el `README.md`: estructura, comandos y **convenciones para el trabajo en paralelo** (migraciones nuevas con timestamp, lógica pura en `src/domain/`, RLS deny-by-default, horas en UTC).
- Next.js 16: ver `AGENTS.md` (las APIs pueden diferir de lo que conocés; la doc está en `node_modules/next/dist/docs/`).
- Antes de terminar: `npm run typecheck && npm run lint && npm test && npm run test:rls`.

# Implementation Plan: Vinculo Automatico de PRs por Git Local

**Branch**: `002-multi-author-commit-import` | **Date**: 2026-05-10 | **Spec**: `specs/003-link-prs-metadata/spec.md`
**Input**: Feature specification from `specs/003-link-prs-metadata/spec.md`

## Summary

Adicionar fluxo de descoberta automatica de PRs para metadados ja cadastrados, com filtros por repositorio, frente, branchs de ambiente selecionadas e janela temporal opcional. A deteccao de PR usara apenas historico Git local, seguindo heuristicas ordenadas (merge commit e fallback por mensagem de commit), com deduplicacao por metadata+PR e bloqueio automatico para casos de conflito.

## Technical Context

**Language/Version**: JavaScript (Node.js com `--experimental-sqlite`)  
**Primary Dependencies**: Express 4, `node:sqlite`, `child_process` para comandos git, frontend vanilla JS  
**Storage**: SQLite local (`release.db`) + repositorio git local para historico de commits/merges  
**Testing**: Node test runner (`node --test`) com testes de API e regressao em `tests/*.test.js`  
**Target Platform**: Windows local (localhost) com suporte a ambientes de desenvolvimento equivalentes
**Project Type**: Aplicacao web monolitica (backend Express + frontend estatico)  
**Performance Goals**: Concluir descoberta em ate 120s para lotes de ate 500 metadados; manter resposta clara de progresso/resultado  
**Constraints**: Sem retrieve da org Salesforce; sem API externa do GitHub; processar apenas metadados cadastrados; validar branchs alvo antes da varredura  
**Scale/Scope**: Ate 500 metadados por execucao, com 1..N branchs alvo de ambiente (ex.: `forno/staging`, `main`) e frente obrigatoria

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate Assessment

- `Code Quality`: PASS. Mudanca encapsulada em endpoint de descoberta + componente de UI de filtro/resultado, sem alterar contratos legados existentes.
- `Testing`: PASS. Plano inclui testes automatizados para heuristica por prioridade, deduplicacao, conflito e erros de branch/remote.
- `UX Consistency`: PASS. Fluxo define estados de loading, sem match, conflito, sucesso parcial e erro bloqueante com mensagens orientativas.
- `Performance`: PASS. NFR explicito de ate 120s para 500 metadados e estrategia de cache local durante a run.

### Post-Phase 1 Re-Assessment

- `Code Quality`: PASS. Artefatos de design separam entidades de request, evidencias, decisao por metadata e resumo da run.
- `Testing`: PASS. Quickstart e contrato cobrem cenarios de fluxo feliz, sem match, conflito e falhas de configuracao.
- `UX Consistency`: PASS. Modelo de resultado padroniza status por item (`matched`, `no_match`, `conflict`, `error`) e feedback global.
- `Performance`: PASS. Contrato e pesquisa mantem escopo filtrado e evitam processamento fora do lote selecionado.

## Project Structure

### Documentation (this feature)

```text
specs/003-link-prs-metadata/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── discover-pr-links.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
server.js
public/
├── index.html
├── app.js
└── styles.css
lib/
└── commit-metadata.js
tests/
├── metadata-from-commits.api.test.js
├── scan-commits-multi-author.api.test.js
├── scan-to-import.integration.test.js
└── *.test.js
```

**Structure Decision**: Manter arquitetura monolitica existente. A feature sera implementada no backend em `server.js` (descoberta e persistencia de links) e no frontend em `public/app.js` + `public/index.html` (filtros por frente/branch e revisao dos resultados), com cobertura de regressao em `tests/`.

## Complexity Tracking

Nenhuma violacao constitucional identificada. Nenhuma excecao requerida.

## Validation Notes (2026-05-10)

- Regression suite: `node --test tests/*.test.js` -> PASS.
- Discovery pipeline validated with scoped filters (`front_id`, `target_branches`, `since/until`) and status outcomes (`matched`, `no_match`, `conflict`, `error`).
- Performance smoke-check (local): discovery path kept under operational budget for typical release-sized datasets; no blocking regressions observed.

# Implementation Plan: Busca Multi-Pessoas e Importacao de Commits

**Branch**: `002-multi-author-commit-import` | **Date**: 2026-05-08 | **Spec**: `specs/002-multi-author-commit-import/spec.md`
**Input**: Feature specification from `specs/002-multi-author-commit-import/spec.md`

## Summary

Expandir a aba de busca por commit para suportar pesquisa consolidada de multiplas pessoas e permitir duas acoes de importacao para metadados: usar todos os commits retornados ou usar apenas commits selecionados. A abordagem preserva compatibilidade com busca por uma pessoa e reutiliza o pipeline de importacao ja existente para reduzir regressao e complexidade.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: JavaScript (Node.js com `--experimental-sqlite`)  
**Primary Dependencies**: Express 4, `node:sqlite`, `child_process` para git, frontend vanilla JS  
**Storage**: SQLite local (`release.db`) + repositorio git local para leitura de historico  
**Testing**: Node test runner (`node --test`) + validacao manual orientada por quickstart  
**Target Platform**: Windows local (aplicacao web localhost)
**Project Type**: Aplicacao web monolitica (backend Express + frontend estatico)  
**Performance Goals**: Busca multipessoas com resposta percebida como imediata no uso operacional diario  
**Constraints**: Preservar compatibilidade com busca por pessoa unica; evitar duplicacao de commits por hash; manter UX consistente com fluxo atual  
**Scale/Scope**: Dezenas de autores/commits por ciclo de release, com selecao parcial ou total para inclusao de metadados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate Assessment

- `Code Quality`: PASS. Planejado reaproveitamento de pipeline existente de importacao e separacao clara entre parsing de autores, consolidacao de resultados e acoes de selecao.
- `Testing`: PASS. Plano inclui testes automatizados para parsing multipessoas, dedup por hash e regressao do fluxo de pessoa unica.
- `UX Consistency`: PASS. Estados de sem resultado, sem selecao, sucesso e erro permanecem com mensagens orientativas no mesmo padrao do sistema atual.
- `Performance`: PASS. Escopo local e consolidacao unica de resultado evita chamadas repetidas no frontend.

### Post-Phase 1 Re-Assessment

- `Code Quality`: PASS. Artefatos definem fronteiras de responsabilidade entre request de busca, resultado consolidado e estado de selecao.
- `Testing`: PASS. Quickstart e modelo de dados cobrem cenarios de todos, selecionados e compatibilidade legada.
- `UX Consistency`: PASS. Contrato e quickstart exigem feedback explicito para estados vazios e operacoes invalidas.
- `Performance`: PASS. Estrategia de consolidacao com deduplicacao por hash reduz ruido e processamento redundante.

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-author-commit-import/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── scan-commits-multi-author.openapi.yaml
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
├── commit-metadata.test.js
└── *.test.js
```

**Structure Decision**: Manter estrutura monolitica existente e aplicar mudancas de busca multipessoas no endpoint `scan-commits` em `server.js` e nos controles/estado da aba de busca em `public/app.js` e `public/index.html`, com suporte de testes em `tests/`.

## Complexity Tracking

Nenhuma violacao constitucional identificada. Nenhuma excecao requerida.

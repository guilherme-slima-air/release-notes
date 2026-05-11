# Tasks: Busca Multi-Pessoas e Importacao de Commits

**Input**: Design documents from [specs/002-multi-author-commit-import](specs/002-multi-author-commit-import)
**Prerequisites**: [specs/002-multi-author-commit-import/plan.md](specs/002-multi-author-commit-import/plan.md), [specs/002-multi-author-commit-import/spec.md](specs/002-multi-author-commit-import/spec.md), [specs/002-multi-author-commit-import/research.md](specs/002-multi-author-commit-import/research.md), [specs/002-multi-author-commit-import/data-model.md](specs/002-multi-author-commit-import/data-model.md), [specs/002-multi-author-commit-import/contracts/scan-commits-multi-author.openapi.yaml](specs/002-multi-author-commit-import/contracts/scan-commits-multi-author.openapi.yaml)

**Tests**: Automated tests are mandatory for each user story.
**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare planning artifacts and implementation baseline for the multi-person search flow.

- [X] T001 Confirm feature scope, plan references, and file layout in specs/002-multi-author-commit-import/plan.md and specs/002-multi-author-commit-import/spec.md
- [X] T002 [P] Align quickstart validation steps with multi-person search and commit selection scenarios in specs/002-multi-author-commit-import/quickstart.md
- [X] T003 [P] Verify contract and data-model terminology consistency for author_emails, ConsolidatedCommitResult, and CommitSelectionSet in specs/002-multi-author-commit-import/contracts/scan-commits-multi-author.openapi.yaml and specs/002-multi-author-commit-import/data-model.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared frontend/backend behavior that all user stories depend on.

- [X] T004 Implement request normalization and dedup helpers for multi-author scan input in server.js
- [X] T005 [P] Add shared utilities for consolidating commit results by hash in server.js or lib/commit-metadata.js
- [X] T006 [P] Add scan selection state, selection helpers, and import handoff scaffolding in public/app.js
- [X] T007 Define multi-author scan response feedback patterns for empty results, invalid input, and legacy single-author compatibility in public/app.js

**Checkpoint**: Multi-author scan input, result consolidation, and UI selection scaffolding are ready for story-level work.

---

## Phase 3: User Story 1 - Buscar commits de varias pessoas ao mesmo tempo (Priority: P1) 🎯 MVP

**Goal**: Permitir buscar commits de duas ou mais pessoas em uma unica operacao e consolidar o resultado em uma lista unica.

**Independent Test**: Informar mais de uma pessoa na busca e validar que a resposta retorna commits de todos os autores informados, sem duplicacao por hash.

### Tests for User Story 1 (MANDATORY)

- [X] T008 [P] [US1] Add API contract coverage for multi-author scan payload and consolidated response in tests/scan-commits-multi-author.api.test.js
- [X] T009 [P] [US1] Add dedup unit tests for consolidated commit results in tests/scan-commits-dedup.test.js
- [X] T010 [US1] Add regression test for legacy single-author scan compatibility in tests/scan-commits-legacy.test.js

### Implementation for User Story 1

- [X] T011 [US1] Extend POST /api/scan-commits to accept author_emails and normalize repeated authors in server.js
- [X] T012 [US1] Consolidate scan results across multiple authors and deduplicate commits by hash in server.js
- [X] T013 [US1] Preserve legacy author_email scan path and response shape in server.js
- [X] T014 [US1] Update search form to allow multiple person selection in public/index.html
- [X] T015 [US1] Update scan request assembly to send multi-author payloads in public/app.js
- [X] T016 [US1] Render consolidated scan results with author identity clearly displayed in public/app.js and public/styles.css

**Checkpoint**: US1 should be fully functional and independently demoable from the Busca por commit tab.

---

## Phase 4: User Story 2 - Incluir todos os commits encontrados (Priority: P2)

**Goal**: Permitir importar todos os commits retornados na busca multipessoas para o fluxo de Incluir metadados com uma unica acao.

**Independent Test**: Executar uma busca multipessoas com resultados e acionar a importacao de todos os commits, validando que o fluxo de metadados recebe a lista completa.

### Tests for User Story 2 (MANDATORY)

- [X] T017 [P] [US2] Add UI flow regression test for include-all action in tests/include-all-commits.regression.test.js
- [X] T018 [P] [US2] Add request summary test for full batch handoff in tests/include-all-commits.summary.test.js

### Implementation for User Story 2

- [X] T019 [US2] Add Usar todos action control and empty-state guard in public/index.html
- [X] T020 [US2] Implement include-all commit handoff from scan results to metadata import in public/app.js
- [X] T021 [US2] Reuse existing metadata import pipeline for include-all actions in public/app.js
- [X] T022 [US2] Display success and empty-result feedback for include-all actions in public/app.js

**Checkpoint**: US2 can be demonstrated independently by including every commit returned from the consolidated search.

---

## Phase 5: User Story 3 - Incluir apenas commits selecionados (Priority: P3)

**Goal**: Permitir selecionar um subconjunto de commits da busca multipessoas e importar apenas os itens marcados.

**Independent Test**: Marcar parte dos commits retornados na busca, acionar a importacao de selecionados e confirmar que apenas os hashes marcados seguem para o fluxo de metadados.

### Tests for User Story 3 (MANDATORY)

- [X] T023 [P] [US3] Add selection state and toggle behavior coverage in tests/scan-selection-state.test.js
- [X] T024 [P] [US3] Add selected-commit handoff regression test in tests/include-selected-commits.integration.test.js
- [X] T025 [US3] Add empty-selection validation regression test in tests/include-selected-commits.empty-state.test.js

### Implementation for User Story 3

- [X] T026 [US3] Render selection checkboxes and selected-count state in public/app.js and public/index.html
- [X] T027 [US3] Implement select-all and clear-selection actions in public/app.js
- [X] T028 [US3] Implement include-selected handoff to metadata import with empty-selection guard in public/app.js
- [X] T029 [US3] Add selection action styling and checkbox alignment in public/styles.css

**Checkpoint**: US3 should be independently usable to import only the commits explicitly selected in the search results.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening and documentation updates across all stories.

- [X] T030 [P] Update README.md usage notes for multi-person search and include-all/include-selected flows
- [X] T031 [P] Record end-to-end validation evidence and manual test outcomes in specs/002-multi-author-commit-import/quickstart.md
- [X] T032 Run full automated test suite and record final verification status in specs/002-multi-author-commit-import/quickstart.md
- [X] T033 [P] Review error messaging, labels, and terminology for consistency across public/app.js and public/index.html

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational phase completion.
- **Polish (Phase 6)**: Depends on the selected user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational and delivers the MVP search flow.
- **User Story 2 (P2)**: Depends on US1 search results being available; can still be developed once foundational scan output is stable.
- **User Story 3 (P3)**: Depends on US1 result rendering and US2 import handoff patterns to reuse the same selection pipeline.

### Within Each User Story

- Tests MUST be written and fail before implementation.
- Backend request/response shape before UI wiring where applicable.
- Core behavior before polish and visual adjustments.
- Story complete before moving to the next priority.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001.
- T005 and T006 can run in parallel after T004 starts.
- T008 and T009 can run in parallel once foundational scaffolding is ready.
- T017 and T018 can run in parallel.
- T023 and T024 can run in parallel.
- T030 and T033 can run in parallel during polish.

---

## Parallel Example: User Story 1

```bash
# Run the API contract and dedup tests together:
Task: "Add API contract coverage for multi-author scan payload and consolidated response in tests/scan-commits-multi-author.api.test.js"
Task: "Add dedup unit tests for consolidated commit results in tests/scan-commits-dedup.test.js"

# After backend is stable, update UI presentation in parallel:
Task: "Update search form to allow multiple person selection in public/index.html"
Task: "Render consolidated scan results with author identity clearly displayed in public/app.js and public/styles.css"
```

## Parallel Example: User Story 2

```bash
Task: "Add UI flow regression test for include-all action in tests/include-all-commits.regression.test.js"
Task: "Add request summary test for full batch handoff in tests/include-all-commits.summary.test.js"
```

## Parallel Example: User Story 3

```bash
Task: "Add selection state and toggle behavior coverage in tests/scan-selection-state.test.js"
Task: "Add selected-commit handoff regression test in tests/include-selected-commits.integration.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Deliver Phase 3: User Story 1.
4. Stop and validate consolidated multi-author search independently.

### Incremental Delivery

1. Deliver US1 and validate the consolidated search flow.
2. Deliver US2 and validate include-all handoff.
3. Deliver US3 and validate selection-based import.
4. Finish with polish, documentation, and final test evidence.

### Team Parallelization

1. Engineer A: backend scan request and dedup work (T004, T005, T011-T013).
2. Engineer B: search UI and selection controls (T006, T014-T016, T019-T029).
3. Engineer C: tests and validation evidence (T008-T010, T017-T018, T023-T025, T031-T032).

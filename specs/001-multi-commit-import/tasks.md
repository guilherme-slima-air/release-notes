# Tasks: Multi-Commit Metadata Import

**Input**: Design documents from [specs/001-multi-commit-import](specs/001-multi-commit-import)
**Prerequisites**: [specs/001-multi-commit-import/plan.md](specs/001-multi-commit-import/plan.md), [specs/001-multi-commit-import/spec.md](specs/001-multi-commit-import/spec.md), [specs/001-multi-commit-import/research.md](specs/001-multi-commit-import/research.md), [specs/001-multi-commit-import/data-model.md](specs/001-multi-commit-import/data-model.md), [specs/001-multi-commit-import/contracts/metadata-from-commits.openapi.yaml](specs/001-multi-commit-import/contracts/metadata-from-commits.openapi.yaml)

**Tests**: Automated tests are mandatory for each user story.
**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare project baseline and planning artifacts for implementation.

- [X] T001 Confirm test command and local execution baseline in package.json
- [X] T002 Validate feature documentation set and references in specs/001-multi-commit-import/plan.md
- [X] T003 [P] Prepare manual validation checklist updates in specs/001-multi-commit-import/quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared feature infrastructure that blocks all user stories until complete.

- [X] T004 Implement shared commit metadata dedup/merge utility in lib/commit-metadata.js
- [X] T005 [P] Create foundational utility unit test coverage scaffold in tests/commit-metadata.test.js
- [X] T006 Implement shared backend helpers for commit hash validation and batch read orchestration in server.js
- [X] T007 [P] Implement shared frontend helpers for parsing multi-hash input and dedup keys in public/app.js
- [X] T008 Define consistent commit import success/error feedback patterns in public/app.js

**Checkpoint**: Foundational utilities and shared behavior are in place; user stories can proceed.

---

## Phase 3: User Story 1 - Importar multiplos commits em lote (Priority: P1) 🎯 MVP

**Goal**: Permitir importacao de metadados a partir de 2 a 50 commits em uma unica acao no modulo Incluir metadados.

**Independent Test**: Informar multiplos hashes validos no campo de commit e confirmar importacao unica com deduplicacao e resumo de processamento.

### Tests for User Story 1 (MANDATORY)

- [X] T009 [P] [US1] Expand dedup/count unit tests for multi-commit merge in tests/commit-metadata.test.js
- [X] T010 [US1] Add API contract test for POST /api/metadata-from-commits in tests/metadata-from-commits.api.test.js

### Implementation for User Story 1

- [X] T011 [US1] Implement POST /api/metadata-from-commits endpoint with payload validation and max-50 guard in server.js
- [X] T012 [US1] Reuse shared merge/read helper flow for single and multi import paths in server.js
- [X] T013 [US1] Implement manual multi-hash input parsing and request branching in loadMetadataFromCommit in public/app.js
- [X] T014 [US1] Update commit import field hint and placeholder to describe multi-hash usage in public/index.html
- [X] T015 [US1] Implement commit import summary message with counts (commits/files/duplicates) in public/app.js

**Checkpoint**: US1 can be demoed independently from Incluir metadados using manual hash list input.

---

## Phase 4: User Story 2 - Selecionar varios commits da busca por autor (Priority: P2)

**Goal**: Permitir selecao multipla na tabela de busca por commit e importacao conjunta para o lote.

**Independent Test**: Buscar commits por autor, selecionar varios resultados na tabela e importar todos para Incluir metadados via acao unica.

### Tests for User Story 2 (MANDATORY)

- [X] T016 [P] [US2] Add selection state behavior test for scanSelectedCommits in tests/scan-commits-selection.test.js
- [X] T017 [US2] Add integration test for selected commits handoff to metadata import flow in tests/scan-to-import.integration.test.js

### Implementation for User Story 2

- [X] T018 [US2] Add multi-select action controls and selection column markup in public/index.html
- [X] T019 [US2] Implement checkbox rendering and selection sync in renderScanResults in public/app.js
- [X] T020 [US2] Implement bulk actions selecionar todos and limpar selecao in public/app.js
- [X] T021 [US2] Implement usar selecionados flow with empty-selection guard in public/app.js
- [X] T022 [P] [US2] Add scan action bar and checkbox column styling in public/styles.css

**Checkpoint**: US2 can be demoed independently from Busca por commit using table multi-selection and import action.

---

## Phase 5: User Story 3 - Preservar atalho de commit unico (Priority: P3)

**Goal**: Garantir que o atalho existente de um commit continue funcionando sem regressao.

**Independent Test**: Clicar em Usar commit em uma linha e confirmar que a importacao unica continua equivalente ao comportamento anterior.

### Tests for User Story 3 (MANDATORY)

- [X] T023 [P] [US3] Add regression test for single-row Usar commit shortcut in tests/scan-single-commit.regression.test.js
- [X] T024 [US3] Add regression test for single-hash manual import path in tests/manual-single-hash.regression.test.js

### Implementation for User Story 3

- [X] T025 [US3] Preserve useCommit single-action behavior while reusing new import pipeline in public/app.js
- [X] T026 [US3] Ensure single-commit API response compatibility is preserved in server.js

**Checkpoint**: US3 can be validated independently by executing the legacy one-commit shortcut flow.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening and cross-story validation.

- [X] T027 [P] Update user-facing workflow notes for multi-commit import in README.md
- [X] T028 Run quickstart end-to-end validation scenarios and record outcomes in specs/001-multi-commit-import/quickstart.md
- [X] T029 Execute performance smoke validation for 50-commit import and record timing notes in specs/001-multi-commit-import/quickstart.md
- [X] T030 [P] Run full automated tests and capture final verification evidence in specs/001-multi-commit-import/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): no dependencies.
- Foundational (Phase 2): depends on Setup; blocks all user stories.
- User Story phases (Phase 3 onward): depend on Foundational completion.
- Polish (Phase 6): depends on completion of all target user stories.

### User Story Dependencies

- US1 (P1): starts immediately after Foundational and delivers MVP.
- US2 (P2): starts after Foundational; can be developed in parallel with US1 if shared helper contracts are stable.
- US3 (P3): depends on stabilized import flows from US1/US2 to validate regression behavior.

### Within Each User Story

- Write tests first and ensure they fail before implementation.
- Implement core logic before UI wiring where applicable.
- Validate independent acceptance scenario before moving to next story.

### Parallel Opportunities

- T003 can run in parallel with T001-T002.
- T005 and T007 can run in parallel after T004 starts.
- US1 test tasks T009 and T010 can run in parallel.
- US2 test task T016 can run in parallel with markup task T018.
- US2 style task T022 can run in parallel with T019-T021.
- US3 regression tests T023 and T024 can run in parallel.
- Polish tasks T027 and T030 can run in parallel.

---

## Parallel Example: User Story 1

- Execute T009 and T010 together once foundational code is available.
- Execute T013 and T014 together after backend endpoint task T011 is complete.

## Parallel Example: User Story 2

- Execute T016 and T018 together.
- Execute T022 in parallel with T019/T020/T021.

## Parallel Example: User Story 3

- Execute T023 and T024 together before applying T025/T026.

---

## Implementation Strategy

### MVP First (US1 only)

1. Finish Phase 1 and Phase 2.
2. Deliver Phase 3 (US1).
3. Validate manual multi-hash import end-to-end.
4. Demo MVP behavior.

### Incremental Delivery

1. Deliver US1 and validate.
2. Deliver US2 and validate table multi-selection import.
3. Deliver US3 and validate no-regression single shortcut.
4. Run polish and final verification.

### Team Parallelization

1. Engineer A: backend endpoint and helper work (T006, T011, T012, T026).
2. Engineer B: frontend selection and UX work (T007, T018-T022, T025).
3. Engineer C: testing and validation (T005, T009, T010, T016, T017, T023, T024, T030).

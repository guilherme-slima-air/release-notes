# Tasks: Vinculo Automatico de PRs por Git Local

**Input**: Design documents from `/specs/003-link-prs-metadata/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/discover-pr-links.openapi.yaml

**Tests**: Automated tests are REQUIRED by constitution; each user story includes API/UI regression coverage.

**Organization**: Tasks grouped by user story for independent implementation and validation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature skeleton, fixtures, and test entry points

- [X] T001 Create PR discovery fixtures folder in tests/fixtures/pr-discovery/
- [X] T002 Create API test scaffold for discovery flow in tests/discover-pr-links.api.test.js
- [X] T003 [P] Create API test scaffold for filters in tests/discover-pr-links.filters.api.test.js
- [X] T004 [P] Create API test scaffold for errors/conflicts in tests/discover-pr-links.errors.api.test.js
- [X] T005 Create feature section placeholders in public/index.html

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared backend/frontend foundations required by all stories

**CRITICAL**: No user story implementation should start before this phase is done.

- [X] T006 Add shared PR-regex and heuristic constants in lib/pr-discovery.js
- [X] T007 [P] Add branch/date/filter validation helpers in lib/pr-discovery.js
- [X] T008 [P] Add metadata candidate query helper by front in lib/pr-discovery.js
- [X] T009 Wire new helper module into server startup in server.js
- [X] T010 Add route-level request parsing and normalization helpers in server.js
- [X] T011 [P] Add frontend state model for discovery run and decisions in public/app.js
- [X] T012 [P] Add reusable UI render helpers for status chips and counters in public/app.js

**Checkpoint**: Foundation ready for user story implementation.

---

## Phase 3: User Story 1 - Descobrir PRs para metadados ja cadastrados (Priority: P1) 🎯 MVP

**Goal**: Discover and present PR candidates from local git history for already-registered metadata.

**Independent Test**: Run discovery with valid repo/front/branches and verify matched metadata receive PR candidates with recorded heuristic.

### Tests for User Story 1 (MANDATORY)

- [X] T013 [P] [US1] Add contract response coverage for POST /api/repos/{id}/discover-pr-links in tests/discover-pr-links.api.test.js
- [X] T014 [P] [US1] Add heuristic-order regression tests (merge commit before commit message fallback) in tests/discover-pr-links.api.test.js
- [X] T015 [US1] Add UI render test for matched/no-match rows in tests/scan-multi-author.ui.test.js

### Implementation for User Story 1

- [X] T016 [P] [US1] Implement merge-commit evidence extraction in lib/pr-discovery.js
- [X] T017 [P] [US1] Implement commit-message fallback extraction ((#123) and PR #123) in lib/pr-discovery.js
- [X] T018 [US1] Implement evidence prioritization and decision builder in lib/pr-discovery.js
- [X] T019 [US1] Implement POST /api/repos/:id/discover-pr-links endpoint using decision builder in server.js
- [X] T020 [US1] Implement discovery run summary payload assembly in server.js
- [X] T021 [US1] Implement discovery form submit and result binding in public/app.js
- [X] T022 [US1] Add discovery panel fields/buttons in public/index.html

**Checkpoint**: US1 is functional and independently testable.

---

## Phase 4: User Story 2 - Refinar descoberta com filtros funcionais (Priority: P2)

**Goal**: Apply repository/front/target-branches/time-window filters so only relevant metadata are evaluated.

**Independent Test**: Execute discovery with different front/branch/date combinations and confirm scoped totals and item list vary correctly.

### Tests for User Story 2 (MANDATORY)

- [X] T023 [P] [US2] Add filter behavior tests for front and target_branches in tests/discover-pr-links.filters.api.test.js
- [X] T024 [P] [US2] Add date-window filter tests (since/until) in tests/discover-pr-links.filters.api.test.js
- [X] T025 [US2] Add UI test for multi-branch selection payload and summary counters in tests/scan-multi-author.ui.test.js

### Implementation for User Story 2

- [X] T026 [P] [US2] Implement target branch existence validation against local git refs in lib/pr-discovery.js
- [X] T027 [P] [US2] Implement metadata candidate scoping by front and include_already_linked flag in server.js
- [X] T028 [US2] Apply since/until filtering in discovery execution pipeline in server.js
- [X] T029 [US2] Add branch multiselect and date range controls in public/index.html
- [X] T030 [US2] Implement front/branch/date payload mapping and validation messages in public/app.js

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Tratar resultados ambiguos e falhas de matching (Priority: P3)

**Goal**: Handle conflicts and operational failures with explicit statuses and safe persistence behavior.

**Independent Test**: Trigger missing remote, invalid branch, multi-PR conflict, and no-match scenarios and verify stable response + no unsafe auto-linking.

### Tests for User Story 3 (MANDATORY)

- [X] T031 [P] [US3] Add error-path tests for missing remote origin and invalid branch in tests/discover-pr-links.errors.api.test.js
- [X] T032 [P] [US3] Add conflict dedup tests (same metadata with multiple PR candidates) in tests/discover-pr-links.errors.api.test.js
- [X] T033 [US3] Add persistence safety tests for POST /api/repos/{id}/apply-pr-links in tests/discover-pr-links.errors.api.test.js

### Implementation for User Story 3

- [X] T034 [P] [US3] Implement remote-origin check and explicit error mapping in server.js
- [X] T035 [P] [US3] Implement conflict classification and reason messaging in lib/pr-discovery.js
- [X] T036 [US3] Update POST /api/repos/:id/apply-pr-links to reject ambiguous links and keep dedup in server.js
- [X] T037 [US3] Render conflict/error/no-match states and guidance messages in public/app.js
- [X] T038 [US3] Add status legend and conflict resolution hints in public/index.html

**Checkpoint**: All stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality, documentation, and performance validation

- [X] T039 [P] Update quickstart validation evidence for discovery flow in specs/003-link-prs-metadata/quickstart.md
- [X] T040 [P] Align API examples with implemented payload/response in specs/003-link-prs-metadata/contracts/discover-pr-links.openapi.yaml
- [X] T041 Run full regression suite and record outcomes for discovery tests in tests/discover-pr-links.api.test.js
- [X] T042 Validate performance target (<=120s for up to 500 metadata) and document notes in specs/003-link-prs-metadata/plan.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies.
- Phase 2 (Foundational): depends on Phase 1 and blocks all user stories.
- Phase 3 (US1): depends on Phase 2.
- Phase 4 (US2): depends on Phase 2; can start after US1 API skeleton exists.
- Phase 5 (US3): depends on Phase 2; should run after US1 decision pipeline exists.
- Phase 6 (Polish): depends on completion of desired user stories.

### User Story Dependencies

- US1 (P1): baseline MVP; no dependency on other stories.
- US2 (P2): depends on US1 endpoint and UI flow being present.
- US3 (P3): depends on US1 decision output model; extends error/conflict behavior.

### Within Each User Story

- Tests first and must fail before implementation.
- Heuristic/data logic before endpoint wiring.
- Endpoint wiring before UI binding.
- UI rendering before polish documentation updates.

## Parallel Opportunities

- Phase 1: T003 and T004 can run in parallel after T002.
- Phase 2: T007, T008, T011, and T012 can run in parallel after T006.
- US1: T013 and T014 in parallel; T016 and T017 in parallel.
- US2: T023 and T024 in parallel; T026 and T027 in parallel.
- US3: T031 and T032 in parallel; T034 and T035 in parallel.
- Polish: T039 and T040 can run in parallel.

## Parallel Example: User Story 1

```bash
# Tests in parallel
Task: T013 tests/discover-pr-links.api.test.js
Task: T014 tests/discover-pr-links.api.test.js

# Core heuristics in parallel
Task: T016 lib/pr-discovery.js
Task: T017 lib/pr-discovery.js
```

## Parallel Example: User Story 2

```bash
# Filter tests in parallel
Task: T023 tests/discover-pr-links.filters.api.test.js
Task: T024 tests/discover-pr-links.filters.api.test.js

# Filter implementation in parallel
Task: T026 lib/pr-discovery.js
Task: T027 server.js
```

## Parallel Example: User Story 3

```bash
# Error/conflict tests in parallel
Task: T031 tests/discover-pr-links.errors.api.test.js
Task: T032 tests/discover-pr-links.errors.api.test.js

# Error/conflict implementation in parallel
Task: T034 server.js
Task: T035 lib/pr-discovery.js
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) end-to-end.
3. Validate independent test for US1.
4. Demo/disponibilizar MVP para uso operacional.

### Incremental Delivery

1. Setup + Foundational.
2. Add US1 and validate.
3. Add US2 filters and validate scoped behavior.
4. Add US3 conflict/error handling and validate safety.
5. Finish with polish + performance evidence.

### Parallel Team Strategy

1. Team completes Phase 1 and Phase 2 together.
2. After foundation:
   - Dev A: backend heuristics and endpoint (US1/US3)
   - Dev B: frontend filters/results (US1/US2/US3)
   - Dev C: automated tests and contract alignment (US1/US2/US3)


# Implementation Plan: Multi-Commit Metadata Import

**Branch**: `main` | **Date**: 2026-05-08 | **Spec**: `specs/001-multi-commit-import/spec.md`
**Input**: Feature specification from `specs/001-multi-commit-import/spec.md`

## Summary

Enable importing metadata from multiple commits in one action inside the
"Incluir metadados" workflow, with deduplication across commits, multi-selection
from "Busca por commit", and backward-compatible single-commit quick action.
Approach uses a batch backend endpoint, shared merge utility, and UI controls
for selection management with clear processing feedback.

## Technical Context

**Language/Version**: JavaScript (Node.js with `--experimental-sqlite`)  
**Primary Dependencies**: Express 4, `node:sqlite`, native `child_process` git execution  
**Storage**: SQLite (`release.db`) for persisted release metadata  
**Testing**: Node test runner (`node --test`) + manual integration checks in browser  
**Target Platform**: Windows local development (localhost web app)
**Project Type**: Monolithic web application (Express backend + static frontend)  
**Performance Goals**: Process import batches up to 50 commits and return summary within 5s on local repo usage  
**Constraints**: Local git repository required, hash format validation (`7-40` hex), maximum 50 commits/request, preserve single-commit behavior  
**Scale/Scope**: Dozens of commits per release cycle and tens to low hundreds of metadata rows per batch operation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate Assessment

- `Code Quality`: PASS. Plan uses a shared utility layer for commit metadata
  merge logic to avoid duplication between endpoints.
- `Testing`: PASS. Plan requires automated unit coverage for dedup logic and
  regression checks for single-commit compatibility.
- `UX Consistency`: PASS. Plan preserves existing `Usar commit` path and adds
  multi-select controls with existing visual language and feedback patterns.
- `Performance`: PASS. Plan sets explicit 50-commit limit and aggregated summary
  response with bounded workload.

### Post-Phase 1 Re-Assessment

- `Code Quality`: PASS. Data model and contract enforce explicit boundaries:
  request validation, commit read, merge, and UI selection state.
- `Testing`: PASS. Quickstart defines repeatable validation for US1/US2/US3 and
  automated test command (`npm test`).
- `UX Consistency`: PASS. Contract + quickstart require clear success/error
  states for empty selection, invalid hash, no metadata, and successful import.
- `Performance`: PASS. Contract codifies max 50 commits and summary metrics
  (`commits_read`, `duplicate_metadata`, totals) for runtime monitoring.

## Project Structure

### Documentation (this feature)

```text
specs/001-multi-commit-import/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── metadata-from-commits.openapi.yaml
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
└── commit-metadata.test.js
```

**Structure Decision**: Keep the existing single-project web app layout and add
feature logic in-place: backend route orchestration in `server.js`, reusable
merge utility in `lib/`, UI state/actions in `public/app.js`, and targeted unit
tests in `tests/`.

## Complexity Tracking

No constitution violations identified. No exceptions required.

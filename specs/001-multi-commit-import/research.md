# Phase 0 Research - Multi-Commit Metadata Import

## Decision 1: Batch API contract for commit metadata import
- Decision: Adopt a dedicated batch endpoint `POST /api/metadata-from-commits` with `repo_path` and `commit_hashes[]` (max 50), returning aggregate and per-commit summary.
- Rationale: JSON array input is explicit, easier to validate, and supports actionable feedback (`commits_read`, `duplicate_metadata`, per-commit totals). The hard limit protects local execution from abuse and runaway processing.
- Alternatives considered:
  - Repeated single endpoint calls from frontend: simpler server-side but slower and noisier on network/UI flow.
  - Delimited string of hashes in one field: error-prone parsing and weaker validation reporting.
  - Streaming protocol (WebSocket/SSE): unnecessary complexity for local synchronous use.

## Decision 2: Dedup strategy across commits
- Decision: Deduplicate using normalized key `lower(type) + '::' + lower(name)` while merging metadata items from all commits.
- Rationale: The pair `(type, name)` is stable for Salesforce metadata identity in this app context and avoids duplicate rows in the import batch. Case-insensitive matching reduces false duplicates caused by casing differences.
- Alternatives considered:
  - Dedup by full file content hash: higher cost and unnecessary for import intent.
  - Dedup by name only: may collide across different metadata types.
  - Persist duplicates and dedup only at DB insert time: poorer UX and less transparent summaries.

## Decision 3: UX pattern for multi-select + single-commit compatibility
- Decision: Keep existing `Usar commit` quick action for single commit and add multi-selection controls (`Selecionar todos`, `Limpar selecao`, `Usar selecionados`) in the commit search table.
- Rationale: Preserves current muscle memory while enabling high-throughput import. This satisfies compatibility and improves efficiency without introducing new navigation.
- Alternatives considered:
  - Replace single action entirely with multi-select only: regression risk for quick fixes.
  - Move selection to modal flow: more clicks and context switching.

## Decision 4: Performance approach for up to 50 commits
- Decision: Process commit reads in parallel (`Promise.all`) with bounded input (max 50) and aggregate once.
- Rationale: Local git access benefits from parallel I/O and keeps response time within target for common usage. The bound controls process and memory pressure.
- Alternatives considered:
  - Sequential processing: predictable but slower for batches.
  - Unlimited batch size: unacceptable risk for latency spikes and local resource exhaustion.

## Decision 5: Testing strategy aligned to constitution
- Decision: Add unit tests for merge/dedup utility and verify API + UI paths manually in quickstart acceptance checks; include regression checks for single-commit path.
- Rationale: Utility logic is high-risk and deterministic, ideal for unit tests. Manual integration checks cover browser interactions and endpoint behavior in current project setup.
- Alternatives considered:
  - UI automation immediately: useful later but not required for initial feature planning.
  - Manual-only testing: insufficient for regression prevention under constitution rules.

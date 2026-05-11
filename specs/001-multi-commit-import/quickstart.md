# Quickstart - Multi-Commit Metadata Import

## Prerequisites
- Node.js compatible with `node --experimental-sqlite`.
- Git installed and available in PATH.
- Local repository path accessible from this machine.

## Run
1. Install dependencies:
   - `npm install`
2. Start server:
   - `npm start`
3. Open app:
   - `http://localhost:3030`

## Validate User Story 1 (manual hash list import)
1. Open tab `Incluir metadados`.
2. Fill local `repo_path`.
3. In commit hash input, provide multiple hashes separated by comma or space.
4. Click `Buscar no commit`.
5. Expected:
   - Success info shows number of commits read and metadata added.
   - Duplicated metadata is ignored and reported in summary.
   - Metadata rows are appended into batch area.

## Validate User Story 2 (multi-select from commit search)
1. Open tab `Busca por commit`.
2. Search commits by email and repository.
3. Select two or more rows using checkboxes.
4. Click `Usar selecionados`.
5. Expected:
   - App returns to `Incluir metadados`.
   - Metadata from selected commits is imported into batch.
   - If nothing is selected, user receives a guidance message and no data changes.

## Validate User Story 3 (single-commit shortcut)
1. In `Busca por commit`, click `Usar commit` in one row.
2. Expected:
   - Single commit import behavior remains unchanged.
   - Metadata is imported without requiring multi-select actions.

## API Contract Spot Check
- Endpoint: `POST /api/metadata-from-commits`
- Request:
```json
{
  "repo_path": "C:/repos/my-repo",
  "commit_hashes": ["a1b2c3d", "d4e5f6a"]
}
```
- Expected response fields:
  - `commits_read`
  - `total_files`
  - `total_metadata`
  - `duplicate_metadata`
  - `metadata_items[]`

## Automated Tests
1. Run test suite:
   - `npm test`
2. Expected:
   - Unit tests for commit metadata dedup utility pass.
   - No regressions in existing test set.

## Performance Check (local)
1. Trigger import with 50 valid commit hashes in one request.
2. Expected:
   - Request completes without server error.
   - UX remains responsive and summary is displayed.

## Validation Evidence (2026-05-08)

### End-to-End Result
- US1: PASS - importacao por lista manual de hashes usa endpoint em lote e mostra resumo com contagem.
- US2: PASS - selecao multipla na grade envia apenas commits selecionados e protege fluxo vazio com mensagem.
- US3: PASS - atalho `Usar commit` continua funcional com pipeline unificado.

### Automated Test Result
- Command executed: `node --test`
- Result: PASS

### Performance Smoke Note
- Scenario: requisicao com lote de ate 50 commits.
- Outcome: comportamento dentro da meta local definida, sem erro de servidor e com resumo apresentado ao usuario.

# Data Model - Vinculo Automatico de PRs por Git Local

## Entity: PrDiscoveryRequest
- Description: Requisicao para executar descoberta de PRs para metadados ja cadastrados.
- Fields:
  - `repo_id` (number, required): repositorio cadastrado no sistema.
  - `front_id` (number, required): frente usada para delimitar metadados.
  - `target_branches` (string[], required): branchs alvo de ambiente (ex.: `forno/staging`, `main`).
  - `since` (string, optional, format date): data inicial da janela temporal.
  - `until` (string, optional, format date): data final da janela temporal.
  - `include_already_linked` (boolean, optional, default false): inclui metadados que ja possuem PR vinculado.
- Validation:
  - `repo_id`, `front_id` devem existir.
  - `target_branches` deve ter ao menos 1 item unico e nao vazio.
  - se ambos informados, `since <= until`.

## Entity: MetadataCandidate
- Description: Metadata elegivel para matching de PR no escopo da run.
- Fields:
  - `metadata_id` (number)
  - `metadata_name` (string)
  - `metadata_type` (string)
  - `front_id` (number)
  - `has_pr_link` (boolean)
- Validation:
  - `metadata_name` normalizado em formato de caminho de repo.

## Entity: PullRequestEvidence
- Description: Evidencia de PR extraida do historico git para um metadata candidato.
- Fields:
  - `metadata_id` (number)
  - `commit_sha` (string)
  - `pr_number` (string)
  - `source_branch` (string)
  - `heuristic` (enum: `merge_commit`, `commit_message`)
  - `subject` (string)
  - `author_name` (string)
  - `author_email` (string)
  - `pr_url` (string, nullable)
- Validation:
  - `pr_number` deve conter apenas digitos.
  - `heuristic` obrigatorio quando houver evidencia.

## Entity: MetadataPrDecision
- Description: Resultado final por metadata ao aplicar heuristicas + regras de deduplicacao/conflito.
- Fields:
  - `metadata_id` (number)
  - `status` (enum: `matched`, `no_match`, `conflict`, `error`)
  - `heuristic_used` (enum: `merge_commit`, `commit_message`, null)
  - `matched_pr` (object, nullable)
  - `candidate_prs` (array)
  - `reason` (string, optional)
- Validation:
  - `matched_pr` existe somente quando `status = matched`.
  - `candidate_prs.length > 1` com mesma prioridade implica `status = conflict`.

## Entity: DiscoveryRunSummary
- Description: Consolidado da execucao de descoberta.
- Fields:
  - `run_id` (string)
  - `repo_id` (number)
  - `front_id` (number)
  - `target_branches` (string[])
  - `since_utc` (string, nullable)
  - `until_utc` (string, nullable)
  - `total_candidates` (number)
  - `total_matched` (number)
  - `total_no_match` (number)
  - `total_conflict` (number)
  - `total_error` (number)
  - `duration_ms` (number)
- Validation:
  - `total_candidates = total_matched + total_no_match + total_conflict + total_error`.

## Relationship Overview
- `PrDiscoveryRequest` 1:N `MetadataCandidate`
- `MetadataCandidate` 1:N `PullRequestEvidence`
- `MetadataCandidate` 1:1 `MetadataPrDecision`
- `DiscoveryRunSummary` agrega todas `MetadataPrDecision` da run

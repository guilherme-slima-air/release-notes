# Data Model - Busca Multi-Pessoas e Importacao de Commits

## Entity: MultiPersonSearchRequest
- Description: Requisicao de busca por commits para uma ou mais pessoas.
- Fields:
  - `repo_path` (string, required): caminho local do repositorio git.
  - `author_emails` (string[], optional): lista de emails para busca consolidada.
  - `author_email` (string, optional): campo legado para compatibilidade com busca unica.
  - `since` (string, optional): data inicial (YYYY-MM-DD).
  - `until` (string, optional): data final (YYYY-MM-DD).
  - `branch` (string, optional): branch alvo para varredura.
- Validation:
  - deve existir ao menos um autor valido entre `author_emails` ou `author_email`.
  - emails sao normalizados para lowercase e deduplicados antes da consulta.
  - `repo_path` deve existir e conter repositorio git valido.

## Entity: ConsolidatedCommitResult
- Description: Commit retornado pela busca consolidada de multiplos autores.
- Fields:
  - `hash` (string)
  - `author_name` (string)
  - `author_email` (string)
  - `subject` (string)
  - `authored_at` (string)
  - `metadata_items` (DetectedMetadataItem[])
- Validation:
  - `hash` e obrigatorio e unico no resultado final consolidado.
  - `metadata_items` e lista deduplicada por `type+name`.

## Entity: DetectedMetadataItem
- Description: Metadata detectado a partir dos arquivos alterados no commit.
- Fields:
  - `name` (string)
  - `type` (string)
- Validation:
  - `name` e `type` nao vazios.
  - chave canonica de identidade: `lower(type) + '::' + lower(name)`.

## Entity: CommitSelectionSet
- Description: Estado de selecao de commits na grade de resultados da busca.
- Fields:
  - `selected_hashes` (string[])
  - `total_results` (number)
- Validation:
  - hashes selecionados devem existir no conjunto atual de resultados.
  - selecao vazia bloqueia acao "usar selecionados".

## Entity: CommitImportActionSummary
- Description: Resultado da acao de importacao disparada pela busca.
- Fields:
  - `action` (enum: `all`, `selected`, `single`)
  - `commits_sent` (number)
  - `metadata_added` (number)
  - `duplicates_ignored` (number)
- Validation:
  - `commits_sent` > 0 para sucesso.
  - `duplicates_ignored` >= 0.

## Relationships
- `MultiPersonSearchRequest` 1:N `ConsolidatedCommitResult`
- `ConsolidatedCommitResult` 1:N `DetectedMetadataItem`
- `CommitSelectionSet` filtra `ConsolidatedCommitResult` para acao de importacao
- Acao de importacao produz `CommitImportActionSummary`

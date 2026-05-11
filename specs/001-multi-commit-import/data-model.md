# Data Model - Multi-Commit Metadata Import

## Entity: CommitImportRequest
- Description: Input payload for importing metadata from one or more commits.
- Fields:
  - `repo_path` (string, required): Local repository path containing `.git`.
  - `commit_hashes` (string[], required): Unique commit hashes requested for import.
- Validation:
  - `repo_path` must exist and be a git repository.
  - `commit_hashes.length` must be between 1 and 50.
  - each hash must match `^[0-9a-f]{7,40}$`.
  - duplicated hashes in request are normalized to unique values before processing.
- State transitions:
  - `received` -> `validated` -> `processing` -> (`completed` | `failed`).

## Entity: CommitMetadataRead
- Description: Read result per commit hash.
- Fields:
  - `commit_hash` (string)
  - `total_files` (number)
  - `total_metadata` (number)
  - `metadata_items` (DetectedMetadataItem[])
- Validation:
  - `commit_hash` must echo requested validated hash.
  - counts must be non-negative integers.

## Entity: DetectedMetadataItem
- Description: Metadata item extracted from changed files in commits.
- Fields:
  - `name` (string): normalized metadata path/name.
  - `type` (string): normalized metadata type label.
- Validation:
  - `name` must be non-empty after normalization.
  - `type` must be non-empty and mapped by existing normalization rules.
- Identity rule:
  - canonical key is `lower(type) + '::' + lower(name)`.

## Entity: CommitSelectionSet
- Description: Frontend state for selected rows in commit scan table.
- Fields:
  - `selected_hashes` (string[])
  - `last_scan_repo_path` (string)
- Validation:
  - selected hashes must exist in current scan result set.
  - empty selection is invalid for multi-import action.

## Entity: ImportSummary
- Description: Consolidated output returned by batch endpoint and shown to user.
- Fields:
  - `commit_hashes` (string[])
  - `commits_read` (number)
  - `total_files` (number)
  - `total_metadata` (number)
  - `duplicate_metadata` (number)
  - `metadata_items` (DetectedMetadataItem[])
  - `commits` (array of per-commit summary)
- Validation:
  - `commits_read` equals distinct validated hashes processed.
  - `duplicate_metadata` reflects dropped items during merge.
  - `metadata_items` contains only unique canonical keys.

## Relationships
- `CommitImportRequest` 1:N `CommitMetadataRead`
- `CommitMetadataRead` 1:N `DetectedMetadataItem`
- `CommitImportRequest` 1:1 `ImportSummary`
- `CommitSelectionSet` maps UI selections to `CommitImportRequest.commit_hashes`

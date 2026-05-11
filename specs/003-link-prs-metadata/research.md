# Phase 0 Research - Vinculo Automatico de PRs por Git Local

## Decision 1: Estrategia de descoberta com git local apenas
- Decision: Executar descoberta usando somente comandos git locais (`git log`, `git show`, `git branch --all`) sem chamadas API GitHub.
- Rationale: Atende a restricao de operar sem dependencias externas e sem variacao de permissao/token.
- Alternatives considered:
  - GitHub REST/GraphQL API: descartado por exigir integracao externa e credenciais.
  - Persistir cache remoto de PRs: aumenta complexidade sem necessidade inicial.

## Decision 2: Ordem de heuristicas para identificar PR
- Decision: Aplicar heuristicas por metadata nesta ordem: (1) merge commit com padrao `Merge pull request #<n> from ...`; (2) fallback por assunto do commit com `(#<n>)` ou `PR #<n>`; (3) sem match.
- Rationale: Prioriza evidencias mais confiaveis e mantém rastreabilidade da origem do match.
- Alternatives considered:
  - Usar apenas merge commit: cobre menos historicos (squash/rebase).
  - Misturar heuristicas sem prioridade: aumenta conflitos e reduz previsibilidade.

## Decision 3: Escopo de busca por ambiente/branch selecionado
- Decision: Tratar ambientes como branchs alvo selecionados explicitamente pelo usuario (ex.: `forno/staging`, `main`) e validar existencia antes da execucao.
- Rationale: Controle operacional claro e comportamento reproduzivel para release.
- Alternatives considered:
  - Inferir branch por convencao de nome: ambiguidade alta.
  - Buscar em todas as branchs: ruido excessivo e custo maior.

## Decision 4: Escopo por frente e metadados ja cadastrados
- Decision: Selecionar metadados candidatos a partir do cadastro existente filtrado por `front_id`, processando apenas itens sem retrieve.
- Rationale: Resolve o problema real do usuario (preencher PRs faltantes) preservando governanca dos dados ja cadastrados.
- Alternatives considered:
  - Reprocessar todos os metadados do banco: pode incluir itens fora do release alvo.
  - Ler metadados direto do repo: contraria o requisito de usar base ja cadastrada.

## Decision 5: Regra de deduplicacao e conflito
- Decision: Deduplicar por (`metadata_id`, `pr_number`) e bloquear vinculacao automatica quando houver multiplos `pr_number` candidatos para o mesmo metadata na mesma prioridade.
- Rationale: Evita links incorretos e mantem seguranca operacional.
- Alternatives considered:
  - Escolher PR mais recente automaticamente: pode mascarar erro de correspondencia.
  - Criar todos os vinculos candidatos: gera ruido e baixa confianca.

## Decision 6: Estrutura de resposta para operacao
- Decision: Retornar sumario consolidado da execucao + lista por metadata com status (`matched`, `no_match`, `conflict`, `error`) e heuristica aplicada.
- Rationale: Permite revisao rapida e acao manual nos casos ambiguos.
- Alternatives considered:
  - Retornar apenas totais: insuficiente para auditoria.
  - Persistir direto sem preview: reduz controle do usuario.

## Decision 7: Performance operacional
- Decision: Limitar execucao para lotes ate 500 metadados e concluir em ate 120s em ambiente local, com cache de consultas por arquivo/branch durante a run.
- Rationale: Alinha NFR de performance com volume esperado por release.
- Alternatives considered:
  - Sem limites: risco de timeout imprevisivel.
  - Otimizacao prematura complexa (indexacao externa): custo maior sem evidencias iniciais.

## Decision 8: Estrategia de testes
- Decision: Cobrir com testes automatizados de API para filtro por frente/branch, heuristicas em ordem, deduplicacao, conflito e erros de branch/remote.
- Rationale: Cumpre constituicao e reduz regressao em fluxo critico de release.
- Alternatives considered:
  - Testes manuais apenas: nao protege regressao futura.
  - Apenas teste unitario de regex: cobertura insuficiente do fluxo completo.

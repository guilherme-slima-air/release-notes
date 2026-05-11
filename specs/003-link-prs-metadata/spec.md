# Feature Specification: Vinculo Automatico de PRs por Git Local

**Feature Branch**: `[003-link-prs-metadata]`  
**Created**: 2026-05-10  
**Status**: Draft  
**Input**: User description: "Integracao com Git local para descobrir PRs automaticamente e preencher vinculos PR <-> metadata ja existente, com filtros por repositorio, frente, ambientes/branchs alvo e janela temporal opcional"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descobrir PRs para metadados ja cadastrados (Priority: P1)

Como analista de release, eu quero descobrir PRs a partir do historico Git local para vincular automaticamente PRs aos metadados que ja estao cadastrados.

**Why this priority**: Esta historia resolve o bloqueio principal do usuario, que nao conseguiu cadastrar PRs manualmente para metadados existentes.

**Independent Test**: Pode ser validada selecionando um repositorio e branchs alvo com metadados existentes e verificando que o sistema encontra PRs no historico local e cria vinculos metadata <-> PR sem consultar API externa.

**Acceptance Scenarios**:

1. **Given** que existem metadados cadastrados sem PR vinculado, **When** o usuario executa a descoberta automatica para um repositorio e branch alvo validos, **Then** o sistema processa somente os metadados ja cadastrados e cria os vinculos metadata <-> PR encontrados.
2. **Given** que o historico contem merge commits com padrao de PR, **When** a descoberta e executada, **Then** o sistema identifica o numero do PR pelo merge commit e registra o match correspondente no metadata.

---

### User Story 2 - Refinar descoberta com filtros funcionais (Priority: P2)

Como analista de release, eu quero filtrar por repositorio, frente, branchs de ambiente e janela temporal opcional para obter apenas matches relevantes para a entrega em analise.

**Why this priority**: Os filtros reduzem ruido operacional e aumentam a precisao dos vinculos.

**Independent Test**: Pode ser validada executando a descoberta com combinacoes distintas de filtros e confirmando que somente os metadados no escopo filtrado sao considerados para matching.

**Acceptance Scenarios**:

1. **Given** que o usuario selecionou repositorio, frente e branchs alvo, **When** executa a descoberta, **Then** apenas metadados aderentes aos filtros sao processados.
2. **Given** que o usuario informou janela temporal, **When** executa a descoberta, **Then** o sistema limita a analise ao intervalo informado e mantem os demais filtros aplicados.

---

### User Story 3 - Tratar resultados ambiguos e falhas de matching (Priority: P3)

Como analista de release, eu quero receber resultado claro quando nao houver match, quando houver conflito de multiplos PRs para o mesmo metadata ou quando o repositorio estiver mal configurado.

**Why this priority**: Transparencia de falhas evita vinculos incorretos e permite acao corretiva rapida.

**Independent Test**: Pode ser validada forçando cenarios de erro e conflito e verificando que o sistema nao cria vinculos ambiguos automaticamente e retorna classificacao de resultado por metadata.

**Acceptance Scenarios**:

1. **Given** que nao existe remote origin configurado, **When** o usuario inicia a descoberta, **Then** o sistema encerra o processo com erro explicito e instrucao de correcao.
2. **Given** que um metadata encontra mais de um PR candidato com mesma prioridade de heuristica, **When** a descoberta finaliza, **Then** o sistema marca conflito e nao cria vinculo automatico para esse metadata.
3. **Given** que nenhum padrao de PR foi encontrado para um metadata, **When** a descoberta finaliza, **Then** o metadata e marcado como sem match e permanece sem vinculo.

### Edge Cases

- Repositorio selecionado sem remote origin configurado.
- Branch alvo inexistente localmente no repositorio informado.
- Historico de commits sem padrao de merge commit e sem referencia de PR em mensagem de commit.
- Nenhum metadata no escopo dos filtros selecionados.
- Nenhum match de PR encontrado para os metadados processados.
- Mesmo PR detectado por mais de uma heuristica para o mesmo metadata.
- Multiplos PRs candidatos para um unico metadata com mesma confianca.
- Janela temporal informada invalida (data inicial maior que data final).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir ao usuario selecionar o repositorio alvo para execucao da descoberta de PRs.
- **FR-002**: O sistema MUST permitir selecionar um ou mais branchs alvo que representem ambientes de entrega (exemplos: forno/staging e main).
- **FR-003**: O sistema MUST permitir filtrar por frente antes de executar a descoberta.
- **FR-004**: O sistema MUST permitir definir janela temporal opcional para limitar o escopo da analise.
- **FR-005**: O sistema MUST processar exclusivamente metadados ja cadastrados no sistema dentro do escopo dos filtros aplicados.
- **FR-006**: O sistema MUST nao executar retrieve da org Salesforce em nenhuma etapa desta feature.
- **FR-007**: O sistema MUST identificar PRs por historico Git local sem dependencia de API externa do GitHub.
- **FR-008**: O sistema MUST aplicar a estrategia de deteccao de PR na ordem definida na secao Deteccao de PR e registrar a heuristica vencedora para cada match.
- **FR-009**: O sistema MUST estabelecer correspondencia metadata <-> PR usando evidencias encontradas no historico Git e dados do metadata no escopo filtrado.
- **FR-010**: O sistema MUST deduplicar PRs repetidos para o mesmo metadata quando o mesmo numero de PR for encontrado por multiplas evidencias.
- **FR-011**: O sistema MUST impedir criacao automatica de vinculo quando houver conflito de multiplos PRs candidatos para o mesmo metadata, classificando o resultado como conflito.
- **FR-012**: O sistema MUST retornar resultado consolidado da execucao contendo totais de metadados processados, matches, sem match, conflitos e erros.
- **FR-013**: O sistema MUST informar erro claro quando o repositorio nao tiver remote origin configurado.
- **FR-014**: O sistema MUST informar erro claro quando um branch alvo selecionado nao existir.
- **FR-015**: O sistema MUST concluir a execucao sem falha global quando nao houver matches, retornando status explicito de sem match para os itens afetados.

### Deteccao de PR

- **DH-001 Ordem de heuristicas**: A deteccao MUST executar na seguinte ordem por metadata:
  1. Merge commit no padrao `Merge pull request #<numero> from <origem>`.
  2. Fallback por mensagem de commit contendo referencia de PR, incluindo formatos como `(#<numero>)` e `PR #<numero>`.
  3. Caso nenhuma heuristica encontre PR valido, classificar como sem match.
- **DH-002 Regra de parada**: Ao encontrar match valido em uma heuristica de maior prioridade, o sistema MUST nao rebaixar o match para heuristicas inferiores.
- **DH-003 Rastreabilidade**: O resultado MUST registrar qual heuristica gerou o match ou se o item terminou sem match.

### Regras de Correspondencia e Deduplicacao

- **RC-001 Escopo de match**: A correspondencia MUST considerar apenas metadados retornados pelos filtros selecionados (repositorio, frente, branchs alvo e janela temporal opcional).
- **RC-002 Voto unico por metadata**: Cada metadata MUST ter no maximo um vinculo automatico ativo ao final da execucao.
- **RC-003 Deduplicacao por numero de PR**: Se o mesmo numero de PR aparecer mais de uma vez para o mesmo metadata, o sistema MUST manter um unico vinculo e descartar duplicatas.
- **RC-004 Conflito multiplo**: Se numeros de PR diferentes forem candidatos validos para o mesmo metadata sem criterio de desempate objetivo, o sistema MUST marcar conflito e nao criar vinculo automatico.

### Non-Functional Requirements *(mandatory)*

- **NFR-001 Code Quality**: A especificacao MUST definir comportamento observavel para filtros, matching, deduplicacao e erros com responsabilidade funcional clara por etapa.
- **NFR-002 Testing**: A feature MUST definir cenarios automatizaveis cobrindo fluxo feliz, sem match, conflito multiplo e erros de configuracao de repositorio/branch.
- **NFR-003 UX Consistency**: A feature MUST apresentar mensagens consistentes para estados de sucesso, sem resultado, conflito e erro bloqueante.
- **NFR-004 Performance**: Em uso operacional padrao, a descoberta MUST finalizar em ate 120 segundos para um lote de ate 500 metadados no escopo filtrado.

### Key Entities *(include if feature involves data)*

- **MetadataCandidate**: Metadata ja cadastrado e elegivel para processamento conforme filtros selecionados.
- **PullRequestEvidence**: Evidencia extraida do historico Git local que aponta para um numero de PR, incluindo tipo de heuristica usada.
- **MetadataPrMatch**: Resultado de correspondencia entre um metadata e um PR detectado, com status de match, sem match ou conflito.
- **DiscoveryRunSummary**: Consolidado da execucao com contagens, erros encontrados e rastreabilidade das decisoes de matching.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em homologacao funcional, pelo menos 95% dos metadados que possuem referencia de PR no historico Git local sao vinculados automaticamente sem intervencao manual.
- **SC-002**: Em 100% das execucoes, nenhum metadata fora dos filtros selecionados e processado.
- **SC-003**: Em 100% dos casos de PR duplicado para o mesmo metadata, apenas um vinculo final permanece ativo.
- **SC-004**: Em 100% dos casos de conflito com multiplos PRs candidatos para o mesmo metadata, nenhum vinculo automatico e criado e o conflito e reportado.
- **SC-005**: Em 100% dos cenarios sem match, o processo finaliza com classificacao explicita sem match para os metadados afetados.
- **SC-006**: Para lotes de ate 500 metadados dentro do escopo filtrado, 90% das execucoes concluem em ate 120 segundos.

## Assumptions

- Os metadados ja estao persistidos e acessiveis no sistema antes da execucao da descoberta de PR.
- O usuario possui permissao para selecionar repositorio, frente e branchs alvo no fluxo de release.
- O repositorio local possui historico de commits suficiente para cobrir o periodo de interesse quando janela temporal for informada.
- A execucao inicial desta feature e exclusivamente local, sem uso de servicos externos de PR.
- Resolucao manual de conflitos de multiplos PRs para o mesmo metadata ocorrera em etapa posterior ao resultado da descoberta.

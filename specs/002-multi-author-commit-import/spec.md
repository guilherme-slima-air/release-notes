# Feature Specification: Busca Multi-Pessoas e Importacao de Commits

**Feature Branch**: `[002-multi-author-commit-import]`  
**Created**: 2026-05-08  
**Status**: Draft  
**Input**: User description: "Precisamos criar uma feature que permite selecionar mais de uma pessoa na aba Busca por commit, sendo possivel pesquisar por commits de diversas pessoas ao mesmo tempo, e permitindo incluir todos commits ou commits selecionados ao incluir metadata"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Buscar commits de varias pessoas ao mesmo tempo (Priority: P1)

Como analista de release, eu quero pesquisar commits de varias pessoas em uma unica busca para montar a visao completa da entrega sem repetir a pesquisa individual por autor.

**Why this priority**: Esta e a necessidade principal da feature e desbloqueia o ganho de produtividade esperado no fluxo de Busca por commit.

**Independent Test**: Pode ser validado informando mais de uma pessoa na busca e confirmando que o resultado consolidado traz commits de todas as pessoas informadas.

**Acceptance Scenarios**:

1. **Given** que o usuario informou duas ou mais pessoas validas para busca, **When** ele executa a pesquisa, **Then** o sistema retorna uma lista consolidada com commits de todas as pessoas informadas.
2. **Given** que a lista consolidada possui commits de autores diferentes, **When** o usuario visualiza os resultados, **Then** cada commit mostra claramente a pessoa associada.

---

### User Story 2 - Incluir todos os commits encontrados (Priority: P2)

Como analista de release, eu quero incluir todos os commits retornados na busca multipessoas diretamente no fluxo de Incluir metadados para acelerar a montagem inicial da release.

**Why this priority**: Este fluxo reduz passos operacionais quando a intencao e aproveitar integralmente o resultado da busca.

**Independent Test**: Pode ser validado executando uma busca multipessoas e acionando a opcao de incluir todos commits, com verificacao de que todos os itens da lista foram enviados para inclusao de metadados.

**Acceptance Scenarios**:

1. **Given** que existem resultados na busca multipessoas, **When** o usuario aciona incluir todos commits, **Then** todos os commits retornados sao encaminhados para inclusao de metadados.
2. **Given** que nao ha commits no resultado da busca, **When** o usuario aciona incluir todos commits, **Then** o sistema exibe mensagem orientativa e nao altera o lote de metadados.

---

### User Story 3 - Incluir apenas commits selecionados (Priority: P3)

Como analista de release, eu quero selecionar somente os commits relevantes dentro da busca multipessoas para incluir apenas os itens desejados no fluxo de Incluir metadados.

**Why this priority**: Garante controle fino do escopo da release, evitando inclusao de commits nao planejados.

**Independent Test**: Pode ser validado marcando um subconjunto de commits no resultado da busca e confirmando que somente os selecionados sao incluidos no fluxo de metadados.

**Acceptance Scenarios**:

1. **Given** que existem commits na busca multipessoas, **When** o usuario seleciona parte dos commits e confirma a inclusao, **Then** apenas os commits selecionados sao encaminhados para inclusao de metadados.
2. **Given** que nenhum commit esta selecionado, **When** o usuario tenta incluir selecionados, **Then** o sistema exibe mensagem de orientacao e nao altera o lote de metadados.

### Edge Cases

- O que acontece quando o usuario informa a mesma pessoa mais de uma vez no mesmo filtro de busca?
- Como o sistema deve se comportar quando uma das pessoas informadas nao possui commits no periodo consultado?
- O que acontece quando o mesmo commit aparece em resultados consolidados por causa de filtros repetidos?
- Como o sistema reage quando o usuario tenta incluir todos ou selecionados sem resultados disponiveis?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir pesquisar commits por duas ou mais pessoas em uma unica operacao de busca na aba Busca por commit.
- **FR-002**: O sistema MUST aceitar multiplas pessoas informadas no filtro da busca por commit em formato de lista.
- **FR-003**: O sistema MUST apresentar os resultados de busca consolidados em uma lista unica, com identificacao clara da pessoa relacionada a cada commit.
- **FR-004**: O sistema MUST permitir acao de incluir todos os commits retornados na busca consolidada para o fluxo Incluir metadados.
- **FR-005**: O sistema MUST permitir selecao individual de commits na lista consolidada para inclusao parcial no fluxo Incluir metadados.
- **FR-006**: O sistema MUST permitir limpar selecao e selecionar todos os commits da lista consolidada.
- **FR-007**: O sistema MUST impedir inclusao de selecionados quando nenhum commit estiver marcado e exibir mensagem orientativa.
- **FR-008**: O sistema MUST impedir inclusao de todos quando nao houver resultados e exibir mensagem orientativa.
- **FR-009**: O sistema MUST evitar duplicacao de commits quando houver repeticao de pessoas no filtro da mesma busca.
- **FR-010**: O sistema MUST preservar o comportamento existente de busca por uma unica pessoa.

### Non-Functional Requirements *(mandatory)*

- **NFR-001 Code Quality**: A feature MUST manter separacao clara entre regras de busca/consolidacao e regras de selecao/inclusao para facilitar manutencao e revisao.
- **NFR-002 Testing**: A feature MUST incluir cobertura automatizada para busca multipessoas, inclusao de todos, inclusao de selecionados e cenarios de validacao sem selecao.
- **NFR-003 UX Consistency**: A feature MUST manter padrao de linguagem, feedback e interacao coerente com os fluxos existentes de Busca por commit e Incluir metadados.
- **NFR-004 Performance**: A feature MUST retornar o resultado consolidado de busca multipessoas em tempo percebido como imediato para operacao rotineira da equipe.

### Key Entities *(include if feature involves data)*

- **MultiPersonSearchRequest**: Conjunto de pessoas informadas para consulta de commits na busca consolidada.
- **ConsolidatedCommitResult**: Item de commit retornado na busca consolidada, com dados do commit e identificacao da pessoa associada.
- **CommitSelectionSet**: Colecao de commits marcados pelo usuario para inclusao parcial no fluxo de metadados.
- **CommitImportActionSummary**: Resumo da acao executada (incluir todos ou incluir selecionados), com totais processados e eventuais itens ignorados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuarios conseguem concluir uma busca com pelo menos 3 pessoas em uma unica operacao sem repetir o processo individual por pessoa.
- **SC-002**: Em validacao funcional, 100% dos commits retornados na busca multipessoas exibem identificacao da pessoa associada.
- **SC-003**: Em validacao interna, usuarios conseguem incluir todos os commits da busca consolidada com uma unica acao em pelo menos 95% das tentativas.
- **SC-004**: Em validacao interna, usuarios conseguem incluir apenas commits selecionados com taxa de sucesso de pelo menos 95%.
- **SC-005**: O sistema bloqueia a acao de incluir selecionados sem itens marcados em 100% dos cenarios testados.
- **SC-006**: O tempo para sair de uma busca multipessoas ate acionar inclusao de commits fica abaixo de 2 minutos na maioria dos cenarios de uso interno.

## Assumptions

- A pessoa informada no filtro de busca e identificada por um dado de autor consistente com os commits existentes no repositorio.
- O comportamento atual de busca por uma unica pessoa permanece disponivel sem mudanca de fluxo obrigatoria.
- A lista de pessoas para busca multipla sera informada no mesmo contexto da aba Busca por commit, sem necessidade de cadastro separado.
- O fluxo Incluir metadados continua sendo o destino das acoes incluir todos e incluir selecionados.
- O volume esperado de pessoas por busca e compativel com o uso operacional rotineiro do time de release.

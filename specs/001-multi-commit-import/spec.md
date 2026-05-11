# Feature Specification: Multi-Commit Metadata Import

**Feature Branch**: `[001-multi-commit-import]`  
**Created**: 2026-05-08  
**Status**: Draft  
**Input**: User description: "Implementar uma forma de incluir mais de um commit no fluxo Incluir metadados"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Importar multiplos commits em lote (Priority: P1)

Como analista de release, eu quero informar varios commits de uma vez para montar um lote unico de metadados, reduzindo retrabalho manual e acelerando a preparacao da release.

**Why this priority**: Este e o valor principal da feature e resolve a dor mais frequente do fluxo atual.

**Independent Test**: Pode ser validado inserindo dois ou mais hashes validos e verificando que os metadados dos commits sao adicionados no lote unico sem acao manual por commit.

**Acceptance Scenarios**:

1. **Given** que o usuario informou um repositorio valido e dois hashes de commit validos, **When** ele executa a importacao, **Then** o sistema adiciona ao lote os metadados detectados a partir da uniao desses commits.
2. **Given** que os commits possuem metadados repetidos, **When** a importacao termina, **Then** cada metadata duplicado aparece apenas uma vez no lote final.

---

### User Story 2 - Selecionar varios commits da busca por autor (Priority: P2)

Como analista de release, eu quero selecionar multiplos commits na tabela de resultados da busca por autor para importar tudo de uma vez no modulo de inclusao de metadados.

**Why this priority**: A busca por autor e o caminho mais usado para localizar commits da sprint; sem selecao multipla a experiencia continua fragmentada.

**Independent Test**: Pode ser validado executando uma busca por autor, selecionando varios commits e acionando importacao conjunta para preencher o lote.

**Acceptance Scenarios**:

1. **Given** que a tabela de commits retornou resultados, **When** o usuario seleciona varios commits e confirma a acao de uso conjunto, **Then** os metadados desses commits sao importados no lote no modulo de inclusao.
2. **Given** que nenhum commit foi selecionado, **When** o usuario tenta usar selecionados, **Then** o sistema exibe mensagem orientativa e nao altera o lote.

---

### User Story 3 - Preservar atalho de commit unico (Priority: P3)

Como analista de release, eu quero manter o atalho atual de usar apenas um commit para nao perder velocidade em ajustes pontuais.

**Why this priority**: Evita regressao de comportamento e protege fluxo conhecido do time.

**Independent Test**: Pode ser validado acionando o atalho de commit unico e confirmando que o resultado no lote permanece equivalente ao fluxo anterior.

**Acceptance Scenarios**:

1. **Given** que o usuario escolheu um unico commit na busca, **When** ele aciona uso rapido, **Then** o sistema importa os metadados desse commit sem exigir selecao multipla.

### Edge Cases

- O que acontece quando o usuario informa mais commits do que o limite permitido por importacao?
- Como o sistema lida com hashes invalidos misturados com hashes validos?
- Como o sistema se comporta quando commits validos nao possuem metadados detectaveis?
- O que acontece quando o mesmo commit e informado duas vezes na mesma requisicao?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir importar metadados a partir de multiplos hashes de commit em uma unica acao de importacao.
- **FR-002**: O sistema MUST aceitar entrada de hashes unicos ou multiplos, com separacao por virgula, espaco ou quebra de linha.
- **FR-003**: O sistema MUST eliminar duplicidades de metadata detectadas entre commits importados no mesmo lote.
- **FR-004**: O sistema MUST manter o fluxo de importacao por commit unico com comportamento equivalente ao atual.
- **FR-005**: O sistema MUST permitir selecao multipla de commits na tabela de busca por autor para importacao conjunta.
- **FR-006**: O sistema MUST impedir importacao quando nao houver commit selecionado e apresentar mensagem de orientacao.
- **FR-007**: O sistema MUST validar formato de hash antes do processamento e retornar erro claro quando houver hash invalido.
- **FR-008**: O sistema MUST impor limite maximo de commits por importacao para proteger estabilidade operacional.
- **FR-009**: O sistema MUST informar resumo do processamento com quantidade de commits lidos, metadados adicionados e duplicados ignorados.

### Non-Functional Requirements *(mandatory)*

- **NFR-001 Code Quality**: A feature MUST manter separacao clara entre regras de agregacao de metadados e camada de interface para facilitar manutencao e revisao.
- **NFR-002 Testing**: A feature MUST incluir cobertura automatizada para deduplicacao entre commits e para o fluxo de selecao multipla na interface.
- **NFR-003 UX Consistency**: A feature MUST seguir o mesmo padrao visual e textual das acoes existentes de importacao por commit, incluindo mensagens de erro e sucesso.
- **NFR-004 Performance**: A feature MUST processar importacao de ate 50 commits sem degradar a experiencia de uso esperada em ambiente local de desenvolvimento.

### Key Entities *(include if feature involves data)*

- **Commit Import Request**: Conjunto de hashes e contexto de repositorio usados para iniciar uma importacao.
- **Detected Metadata Item**: Metadata identificado a partir de arquivos alterados, contendo nome e tipo para compor o lote.
- **Commit Selection Set**: Colecao de commits marcados pelo usuario na busca por autor para importacao conjunta.
- **Import Summary**: Resultado consolidado da importacao com totais de commits processados, metadados adicionados e duplicados ignorados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuarios conseguem importar metadados de 2 a 50 commits em uma unica operacao sem repetir a acao por commit.
- **SC-002**: 100% dos metadados duplicados entre commits selecionados sao consolidados em item unico no lote final.
- **SC-003**: Em validacao funcional, o atalho de commit unico preserva o mesmo resultado esperado de importacao em pelo menos 10 cenarios de regressao.
- **SC-004**: Para um conjunto de ate 50 commits, o resumo de importacao e exibido ao usuario em ate 5 segundos no ambiente local padrao do projeto.
- **SC-005**: Cobertura automatizada da logica de agregacao multi-commit executa sem falhas no pipeline local.
- **SC-006**: A taxa de sucesso de conclusao da tarefa "montar lote de metadados" fica em pelo menos 90% em validacao interna com usuarios do time.

## Assumptions

- O repositorio informado pelo usuario continua sendo local e acessivel com git instalado.
- O limite inicial de importacao por operacao sera de 50 commits para equilibrar usabilidade e estabilidade.
- O criterio de duplicidade considera combinacao de tipo e nome de metadata normalizados.
- Campos comuns do lote (ticket e descricao) continuam definidos no formulario, e nao pelos commits.
- O fluxo de importacao multipla nao altera regras existentes de cadastro e consolidacao de metadados no lote.

# Phase 0 Research - Busca Multi-Pessoas e Importacao de Commits

## Decision 1: Modelo de entrada para busca multi-pessoas
- Decision: Adotar lista de emails de autores no payload (`author_emails[]`) e manter compatibilidade com entrada unica (`author_email`).
- Rationale: Mantem o fluxo antigo funcional e permite evolucao incremental do frontend sem quebra de contrato.
- Alternatives considered:
  - Substituir completamente `author_email` por lista: maior risco de regressao.
  - Fazer multiplas chamadas no frontend (uma por pessoa): mais latencia, mais complexidade de merge no cliente.

## Decision 2: Consolidacao e deduplicacao de resultados
- Decision: Consolidar resultados de todos autores em lista unica e deduplicar por hash de commit.
- Rationale: O hash e identidade canonica do commit e evita duplicacao quando ha repeticao de pessoa no filtro ou cruzamento de autoria.
- Alternatives considered:
  - Nao deduplicar: lista inflada e confusa para selecao/importacao.
  - Deduplicar por hash+autor: poderia manter duplicatas do mesmo commit.

## Decision 3: Acao explicita para incluir todos commits
- Decision: Incluir acao dedicada "Usar todos" na aba Busca por commit, reutilizando pipeline de importacao ja usado por "Usar selecionados" e "Usar commit".
- Rationale: Reduz cliques para cenarios de lote completo e reaproveita logica existente de importacao de metadados.
- Alternatives considered:
  - Exigir selecionar todos manualmente: experiencia mais lenta.
  - Auto-incluir apos busca: comportamento invasivo e sujeito a erro humano.

## Decision 4: Regras de validacao e mensagens UX
- Decision: Exigir pelo menos uma pessoa valida para busca, mostrar mensagens claras para sem resultados, sem selecao e erro de repositorio/git.
- Rationale: Coerencia com UX atual e menor ambiguidade operacional.
- Alternatives considered:
  - Falha silenciosa em cenarios vazios: baixa confiabilidade percebida.
  - Mensagens tecnicas de erro bruto: pior compreensao pelo usuario final.

## Decision 5: Limites operacionais e desempenho
- Decision: Definir processamento local orientado a uso diario (ate dezenas de autores e centenas de commits) com meta de resposta percebida imediata na busca consolidada.
- Rationale: Alinha com contexto local do projeto e com os NFR de performance e usabilidade.
- Alternatives considered:
  - Sem limites ou observacao de volume: maior risco de degradacao.
  - Otimizacao prematura complexa: aumento de manutencao sem evidencias de necessidade.

## Decision 6: Estrategia de testes
- Decision: Cobrir parsing de multiplos autores, consolidacao/dedup por hash e fluxos UI de "usar todos" e "usar selecionados" com testes automatizados e cenarios de quickstart.
- Rationale: Atende a constituicao (testes obrigatorios) e protege regressao de fluxo existente.
- Alternatives considered:
  - Testes manuais apenas: insuficiente para regressao continua.
  - End-to-end completo imediato: custo inicial alto para este incremento.

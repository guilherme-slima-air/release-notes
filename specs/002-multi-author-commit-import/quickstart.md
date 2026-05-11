# Quickstart - Busca Multi-Pessoas e Importacao de Commits

## Prerequisites
- Node.js compativel com `node --experimental-sqlite`.
- Git instalado e acessivel no PATH.
- Repositorio local com historico de commits de mais de uma pessoa.

## Run
1. Instalar dependencias:
   - `npm install`
2. Iniciar aplicacao:
   - `npm start`
3. Abrir no navegador:
   - `http://localhost:3030`

## Validate User Story 1 (busca multipessoas)
1. Ir para aba `Busca por commit`.
2. Informar duas ou mais pessoas para busca (emails de autor).
3. Executar busca.
4. Expected:
   - Lista unica consolidada com commits de todas as pessoas.
   - Cada linha exibe autor e email corretamente.
   - Commits duplicados por repeticao de filtros nao aparecem duplicados.

## Validate User Story 2 (usar todos)
1. Com resultados visiveis na busca multipessoas, acionar `Usar todos`.
2. Expected:
   - Todos os commits retornados sao enviados para o fluxo `Incluir metadados`.
   - Sistema exibe resumo de importacao com totais processados.

## Validate User Story 3 (usar selecionados)
1. Selecionar subconjunto de commits na grade.
2. Acionar `Usar selecionados`.
3. Expected:
   - Apenas commits selecionados sao enviados para `Incluir metadados`.
   - Se nada estiver selecionado, sistema mostra mensagem orientativa e nao altera o lote.

## Backward Compatibility
1. Executar busca por apenas uma pessoa (fluxo antigo).
2. Expected:
   - Resultado equivalente ao comportamento existente antes da feature.

## API Contract Spot Check
- Endpoint: `POST /api/scan-commits`
- Request (novo):
```json
{
  "repo_path": "C:/repos/meu-repo",
  "author_emails": ["dev1@company.com", "dev2@company.com"],
  "since": "2026-05-01",
  "until": "2026-05-08",
  "branch": "main"
}
```
- Request (legado):
```json
{
  "repo_path": "C:/repos/meu-repo",
  "author_email": "dev1@company.com"
}
```

## Automated Tests
1. Executar:
   - `npm test`
2. Expected:
   - Testes de parsing multipessoas, consolidacao/dedup e fluxos de selecao/importacao passam sem falhas.

## Performance Check (local)
1. Rodar busca com multiplas pessoas (cenario real de sprint).
2. Expected:
   - Resposta consolidada em tempo percebido como imediato para uso operacional.

## Validation Evidence (2026-05-08)

### End-to-End Result
- US1: PASS - a busca multi-pessoas consolida commits de varios autores em uma lista unica.
- US2: PASS - `Usar todos` encaminha todos os commits retornados para o fluxo de metadados.
- US3: PASS - `Usar selecionados` encaminha apenas os commits marcados e bloqueia selecao vazia.

### Automated Test Result
- Command executed: `node --test`
- Result: PASS

### Notes
- O fluxo legado de busca por uma unica pessoa foi preservado.
- A interface suporta selecao multipla de pessoas salvas e emails adicionais manuais.

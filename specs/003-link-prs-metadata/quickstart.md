# Quickstart - Vinculo Automatico de PRs por Git Local

## Prerequisites
- Node.js compativel com `node --experimental-sqlite`.
- Git instalado e acessivel no PATH.
- Repositorio local cadastrado na aplicacao (`Repositorios`) com `remote origin` configurado.
- Metadados ja cadastrados para a frente alvo.

## Run
1. Instalar dependencias:
   - `npm install`
2. Iniciar aplicacao:
   - `npm start`
3. Abrir no navegador:
   - `http://localhost:3030`

## Validate User Story 1 (descobrir PR para metadados ja cadastrados)
1. Selecionar repositorio cadastrado.
2. Selecionar frente.
3. Selecionar branchs alvo de ambiente (ex.: `forno/staging`, `main`).
4. Executar descoberta.
5. Expected:
   - O sistema processa somente metadados cadastrados no escopo.
   - Itens com match exibem PR encontrado e heuristica usada.

## Validate User Story 2 (filtros por escopo)
1. Reexecutar descoberta alterando filtros de frente, branchs e janela temporal.
2. Expected:
   - Apenas metadados no escopo filtrado sao avaliados.
   - O total processado muda de acordo com os filtros.

## Validate User Story 3 (falhas e conflito)
1. Simular repo sem `remote origin`.
2. Simular branch alvo inexistente.
3. Simular metadata com multiplos PRs candidatos.
4. Expected:
   - Erro explicito para `remote origin` ausente e branch invalida.
   - Status `conflict` sem gravar vinculo automatico.

## API Contract Spot Check
- Endpoint principal: `POST /api/repos/{id}/discover-pr-links`
- Request exemplo:
```json
{
  "front_id": 4,
  "target_branches": ["forno/staging", "main"],
  "since": "2026-04-01",
  "until": "2026-05-10",
  "include_already_linked": false
}
```
- Endpoint de persistencia: `POST /api/repos/{id}/apply-pr-links`

## Automated Tests
1. Executar:
   - `node --test`
2. Expected:
   - Passar testes de API para: heuristica por merge commit, fallback por mensagem, deduplicacao, conflito e filtros.

## Performance Check (local)
1. Rodar descoberta com ate 500 metadados no escopo.
2. Expected:
   - Conclusao da run em ate 120s para 90% dos cenarios operacionais.

## Validation Evidence (2026-05-10)

- Automated test run: `node --test tests/*.test.js`
- Result: PASS
- Coverage highlights:
   - Contract and route coverage for `discover-pr-links` and `apply-pr-links`
   - Heuristic priority (`merge_commit` before `commit_message`)
   - Error handling for missing remote and invalid branches
   - UI payload mapping for front, target branches, date range, and apply flow

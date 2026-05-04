# Spec-Driven Development - Cadastro de Pessoas

## 1. Contexto
Objetivo desta feature:
1. Evitar que o usuario precise digitar email e caminho de repositorio toda vez.
2. Acelerar o fluxo de "Buscar commits por email" com dados reutilizaveis.
3. Reduzir erros de digitacao em email e repo.

Relacao com a spec de consolidacao:
1. Esta spec estende o fluxo existente de busca de commits por email.
2. Mantem compatibilidade com preenchimento manual quando necessario.

## 2. Problema e visao
Problema atual:
1. O usuario precisa "cacar" dados do autor repetidamente.
2. Nao existe lista de pessoas salvas para reutilizacao rapida.

Visao da solucao:
1. Permitir cadastro de pessoas com dados minimos.
2. Permitir selecionar pessoa cadastrada e preencher formulario automaticamente.
3. Manter consistencia entre frontend e API para salvar/editar/remover registros.

## 3. Objetivos do produto
1. Cadastrar pessoas com nome exibido, email e repo padrao opcional.
2. Listar pessoas cadastradas para selecao rapida.
3. Preencher automaticamente os campos da busca por email ao selecionar uma pessoa.
4. Permitir editar e remover pessoas sem impactar dados de metadata ja gravados.

## 4. Fora de escopo (por enquanto)
1. Integracao automatica com diretorio corporativo (AD/LDAP).
2. Permissoes por perfil (RBAC).
3. Sincronizacao em nuvem entre maquinas.

## 5. Personas
1. Arquiteto de entrega.
Necessidade: selecionar rapidamente autores recorrentes e iniciar busca de commits.
2. Lider tecnico.
Necessidade: manter uma lista curada de pessoas do time para reduzir erro operacional.

## 6. Fluxos principais
1. Cadastro de pessoa.
Usuario informa nome, email e repo padrao opcional e salva.
2. Edicao de pessoa.
Usuario ajusta dados e salva alteracoes.
3. Remocao de pessoa.
Usuario exclui registro apos confirmacao.
4. Uso no fluxo de commits por email.
Usuario escolhe pessoa cadastrada e o formulario e preenchido automaticamente.

## 7. Requisitos funcionais (RF)
RF-01: Permitir criar pessoa com campos obrigatorios: nome e email.
RF-02: Permitir informar repo padrao opcional no cadastro.
RF-03: Validar formato de email no backend e frontend.
RF-04: Evitar email duplicado entre pessoas cadastradas.
RF-05: Permitir listar pessoas ordenadas por nome (asc).
RF-06: Permitir editar nome, email e repo padrao.
RF-07: Permitir remover pessoa cadastrada.
RF-08: Ao selecionar pessoa na tela de busca por email, preencher automaticamente email e repo.
RF-09: Permitir sobrescrever manualmente os campos preenchidos automaticamente.
RF-10: Em caso de lista vazia, manter fluxo manual funcional sem bloqueio.

## 8. Requisitos nao funcionais (RNF)
RNF-01: Mensagens de erro devem ser claras para usuario final.
RNF-02: Compatibilidade com execucao local Windows.
RNF-03: API deve responder em JSON padrao para erros.
RNF-04: Operacoes de listagem e selecao devem ser instantaneas para ate 500 pessoas.

## 9. Modelo de dados
Tabela sugerida: people

Campos:
1. id (PK, inteiro autoincrement).
2. name (texto, obrigatorio, max 120).
3. email (texto, obrigatorio, unico, max 254).
4. default_repo_path (texto, opcional, max 500).
5. created_at (datetime, obrigatorio).
6. updated_at (datetime, obrigatorio).

Indice:
1. UNIQUE(email).

## 10. Contratos de API

### 10.1 Criar pessoa
POST /api/people

Request:
```json
{
  "name": "Joao Silva",
  "email": "joao.silva@company.com",
  "default_repo_path": "C:/repos/salesforce"
}
```

Response 201:
```json
{
  "id": 1,
  "name": "Joao Silva",
  "email": "joao.silva@company.com",
  "default_repo_path": "C:/repos/salesforce",
  "created_at": "2026-05-04T10:00:00.000Z",
  "updated_at": "2026-05-04T10:00:00.000Z"
}
```

### 10.2 Listar pessoas
GET /api/people

Query params:
1. q (opcional): filtra por nome ou email, case-insensitive.

Response 200:
```json
{
  "items": [
    {
      "id": 1,
      "name": "Joao Silva",
      "email": "joao.silva@company.com",
      "default_repo_path": "C:/repos/salesforce",
      "created_at": "2026-05-04T10:00:00.000Z",
      "updated_at": "2026-05-04T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 10.3 Atualizar pessoa
PUT /api/people/:id

Request:
```json
{
  "name": "Joao S.",
  "email": "joao.s@company.com",
  "default_repo_path": "D:/work/repo"
}
```

Response 200:
```json
{
  "id": 1,
  "name": "Joao S.",
  "email": "joao.s@company.com",
  "default_repo_path": "D:/work/repo",
  "created_at": "2026-05-04T10:00:00.000Z",
  "updated_at": "2026-05-04T11:00:00.000Z"
}
```

### 10.4 Remover pessoa
DELETE /api/people/:id

Response 204 sem corpo.

Erros esperados (todos endpoints):
1. 400 para validacao de entrada.
2. 404 para id inexistente.
3. 409 para email duplicado.
4. 500 para falha inesperada.

## 11. Regras de negocio criticas
1. Email e identificador logico unico da pessoa.
2. Exclusao de pessoa nao deve afetar metadados ja cadastrados.
3. Selecao de pessoa so preenche formulario; nao dispara busca automaticamente.
4. Usuario pode alterar manualmente qualquer campo preenchido pela selecao.

## 12. Criterios de aceite
1. Dado cadastro valido, pessoa e salva e aparece na lista.
2. Dado email invalido, retorno 400 com mensagem clara.
3. Dado email duplicado, retorno 409 sem criar novo registro.
4. Dado selecao de pessoa na tela de busca, email e repo sao preenchidos.
5. Dado lista vazia, usuario ainda consegue preencher manualmente e buscar commits.
6. Dado edicao de pessoa, novos dados refletem na selecao futura.
7. Dado remocao de pessoa, item some da lista e fluxo manual continua funcional.

## 13. Edge cases
1. Repo padrao vazio.
2. Nome com espacos extras no inicio/fim (normalizar trim).
3. Email com letras maiusculas (normalizar para comparacao sem case-sensitive).
4. Caminho de repo inexistente no momento do cadastro (validar somente formato minimo, sem bloquear).

## 14. Plano de implementacao (slices)
1. Slice 1 - Persistencia e API CRUD. Status: concluido em 2026-05-04.
Criar migracao/tabela, validacoes e endpoints /api/people.
2. Slice 2 - UI de cadastro de pessoas. Status: concluido em 2026-05-04.
Adicionar bloco de gerenciamento (listar, criar, editar, excluir).
3. Slice 3 - Integracao com "Buscar commits por email". Status: concluido em 2026-05-04.
Adicionar seletor de pessoa e autopreenchimento de email/repo.
4. Slice 4 - Polimento UX e mensagens. Status: concluido em 2026-05-04.
Feedback de sucesso/erro e empty state para lista vazia.

## 15. Definition of Done desta spec
1. CRUD de pessoas funcional com validacoes.
2. Integracao com tela de busca por email concluida.
3. Criterios de aceite validados manualmente.
4. Fluxo manual legado preservado.
# Spec-Driven Development - Busca de PRs no GitHub por Metadata e Branch

## 1. Contexto
Objetivo desta feature:
1. Permitir buscar PRs reais no GitHub sem depender apenas do vinculo local em banco.
2. Manter seguranca de credenciais, com token apenas no backend.
3. Reduzir trabalho manual para descobrir PRs por metadata e branch.
4. Atuar como fallback para os casos que nao forem cobertos pela varredura local de merge commits.

Relacao com specs existentes:
1. Complementa a spec de consolidacao-entrega ao adicionar descoberta automatica de PRs.
2. Reutiliza a padronizacao de metadata_name em caminho relativo iniciando por force-app/.
3. Pode integrar com cadastro local de PRs para reutilizacao futura.

## 2. Problema e visao
Problema atual:
1. A tela "Buscar PRs por branch" consulta apenas PRs locais ja vinculados ao metadata.
2. Quando nao ha vinculo local, o usuario ve "Nenhum PR vinculado" mesmo existindo PR no GitHub.
3. Buscar PR no GitHub manualmente por branch e arquivo toma tempo e gera erros.
4. Alguns cenarios nao sao cobertos localmente (ex.: rebase merge, squash sem numero de PR na mensagem).

Visao da solucao:
1. Backend consulta API do GitHub com token de ambiente e retorna PRs candidatos.
2. Frontend oferece modo "buscar no GitHub" sem expor token no browser.
3. Opcionalmente, usuario confirma e salva PR encontrado no banco local.

## 3. Objetivos do produto
1. Buscar PRs no GitHub por repositorio, branches alvo e arquivo de metadata.
2. Retornar somente o PR mais recente por branch quando houver mais de um.
3. Preservar fluxo atual local como fallback quando token/repositorio nao estiver configurado.
4. Fornecer feedback claro quando faltarem configuracoes (token, owner/repo, permissao).

## 4. Fora de escopo (por enquanto)
1. Suporte a provedores nao-GitHub (GitLab/Bitbucket) para busca remota.
2. Autenticacao multiusuario com OAuth no app.
3. Sincronizacao automatica recorrente (job agendado) de PRs para o banco local.

## 5. Personas
1. Arquiteto de entrega.
Necessidade: encontrar PR por metadata e branch sem acessar GitHub manualmente.
2. Lider tecnico.
Necessidade: manter rastreabilidade entre metadata e PR sem risco de expor token.

## 6. Fluxos principais
1. Busca remota de PR por metadata.
Usuario seleciona metadata, informa branches e executa busca no GitHub.
2. Fallback local.
Se token/repositorio nao estiver configurado, app informa motivo e oferece busca local atual.
3. Persistencia opcional.
Usuario escolhe um PR retornado e salva vinculo no banco local.
4. Prioridade operacional.
Fluxo local por merge commit e a primeira tentativa; API do GitHub entra apenas quando o local nao encontrar resultado suficiente.

## 7. Requisitos funcionais (RF)
RF-01: Backend deve expor endpoint para buscar PRs no GitHub sem revelar token ao frontend.
RF-02: Endpoint deve aceitar metadata_path e lista de branches.
RF-03: Endpoint deve permitir limitar ao PR mais recente por branch.
RF-04: Endpoint deve filtrar PR por arquivo alterado contendo metadata_path.
RF-05: Endpoint deve retornar branch, numero do PR, titulo, url, autor, data de atualizacao e estado.
RF-06: Frontend deve exibir resultado remoto separado de "PRs locais".
RF-07: Frontend deve permitir salvar PR remoto como vinculo local ao metadata selecionado.
RF-08: Em ausencia de token ou erro 401/403, retornar mensagem orientativa e nao quebrar a tela.
RF-09: Manter compatibilidade com fluxo atual de PR local ja cadastrado.

## 8. Requisitos nao funcionais (RNF)
RNF-01: Token do GitHub deve ficar apenas em variavel de ambiente no backend.
RNF-02: Nenhuma chave secreta deve ser persistida no banco ou retornada em resposta JSON.
RNF-03: Erros externos do GitHub devem ser tratados com mensagens objetivas e status coerente.
RNF-04: Busca remota deve responder em ate 5s para cenarios comuns (ate 3 branches).
RNF-05: Codigo versionado deve incluir apenas .env.example sem segredo real.

## 9. Modelo de dados (se aplicavel)
Sem nova tabela obrigatoria nesta fase.

Campos reutilizados:
1. metadatas.metadata_name (caminho relativo padronizado force-app/...).
2. pull_requests.metadata_id, label, url, created_at (persistencia opcional do resultado remoto).

Configuracao sugerida:
1. GITHUB_TOKEN (obrigatorio para busca remota).
2. GITHUB_OWNER (opcional, quando repositorio ja e padrao da equipe).
3. GITHUB_REPO (opcional, quando repositorio ja e padrao da equipe).

## 10. Contratos de API

### 10.1 Buscar PRs no GitHub por metadata e branch
POST /api/github/prs-by-metadata

Request:
```json
{
  "owner": "minha-org",
  "repo": "meu-repo",
  "metadata_path": "force-app/main/default/flows/Case_Member_Update_Case_PP_Multi_Field.flow-meta.xml",
  "branches": ["main", "staging", "forno"],
  "latest_per_branch": true
}
```

Response 200:
```json
{
  "source": "github",
  "total": 2,
  "items": [
    {
      "branch": "main",
      "pr_number": 1234,
      "title": "feat(flow): ajuste de distribuicao",
      "url": "https://github.com/minha-org/meu-repo/pull/1234",
      "author": "fulano",
      "state": "merged",
      "updated_at": "2026-05-04T11:20:00.000Z"
    }
  ]
}
```

### 10.2 Persistir PR remoto no cadastro local (opcional)
POST /api/metadatas/:id/prs

Request:
```json
{
  "label": "PR #1234 main",
  "url": "https://github.com/minha-org/meu-repo/pull/1234"
}
```

Erros esperados:
1. 400 para entrada invalida.
2. 401 para token ausente/invalido na integracao GitHub.
3. 403 para token sem permissao.
4. 404 para repositorio ou metadata nao encontrado.
5. 409 para PR ja vinculado localmente.
6. 502 para falha upstream do GitHub.

## 11. Regras de negocio criticas
1. Token nunca deve trafegar para frontend.
2. metadata_path deve ser comparado no formato padronizado (force-app/...).
3. Quando latest_per_branch=true, retornar no maximo um PR por branch (mais recente).
4. Falha da integracao remota nao deve impedir uso do fluxo local.

## 12. Criterios de aceite
1. Dado token valido e repo existente, quando buscar por metadata e branches, entao PRs reais do GitHub sao exibidos.
2. Dado dois PRs para mesma branch, quando latest_per_branch=true, entao apenas o mais recente e retornado.
3. Dado token ausente, quando buscar remoto, entao app informa configuracao faltante sem quebrar a tela.
4. Dado resultado remoto valido, quando usuario salva PR, entao vinculo local e criado e aparece nas consultas locais.
5. Dado URL de PR ja vinculada, quando salvar novamente, entao backend responde 409.

## 13. Edge cases
1. Branch informada nao existe no repositorio.
2. metadata_path existe em PR fechado e nao mergeado.
3. Rate limit do GitHub atingido.
4. Repo privado com token sem escopo suficiente.
5. Caminho de metadata com underscore, percent ou caracteres especiais.

## 14. Plano de implementacao (slices)
1. Slice 1 - Contrato e backend seguro. Status: planejado.
Criar endpoint /api/github/prs-by-metadata, ler token do ambiente, tratar erros 401/403/502.
2. Slice 2 - Integracao UI de busca remota. Status: planejado.
Adicionar acao de busca no GitHub na aba de PR por branch e painel de resultados remotos.
3. Slice 3 - Persistencia opcional no banco. Status: planejado.
Adicionar botao para vincular PR remoto ao metadata local via endpoint existente.
4. Slice 4 - Hardening e docs de setup. Status: planejado.
Adicionar .env.example, atualizar README e checklist de seguranca para versionamento.

## 15. Definition of Done desta spec
1. Endpoint remoto funcional com token em ambiente e sem vazamento de segredo.
2. UI exibe resultados remotos e permite salvar no cadastro local.
3. Criterios de aceite validados manualmente em ambiente local.
4. README documenta setup de token sem incluir valor real.

## 16. Log de status
1. 2026-05-04 - Spec criada e alinhada com padronizacao de metadata_path.
2. 2026-05-05 - Fluxo local por merge commit implementado no produto; esta spec passa a ser fallback opcional.

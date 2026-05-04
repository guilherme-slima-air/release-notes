# Spec-Driven Development - Consolidacao de Entrega

## 1. Contexto
Este produto nao e uma auditoria formal de compliance.

Objetivo principal:
1. Ajudar arquitetos a consolidar, em uma entrega especifica, tudo que o time subiu de metadata.
2. Reduzir esforco manual quando o time e grande.
3. Gerar documentacao de release de forma consistente.

## 2. Problema e visao
Problema atual do usuario:
1. Em times grandes, a consolidacao da entrega fica manual e sujeita a ruido.
2. O mesmo conteudo precisa ser reaproveitado para canais diferentes (documento, planilha e automacao).

Visao da solucao:
1. Consolidar uma unica base da entrega.
2. Exportar o mesmo conjunto em formatos diferentes sem retrabalho.
3. Garantir previsibilidade: mesmo filtro, mesmo resultado.

## 3. Objetivos do produto
1. Consolidar metadados por contexto de entrega (frente, sprint, tipo, descricao).
2. Facilitar importacao por commit para acelerar cadastro.
3. Permitir vinculo de PRs sem duplicidade por metadata.
4. Gerar release notes legiveis e reutilizaveis.
5. Evitar gravacoes parciais em operacoes de lote.
6. Exportar conteudo da entrega em JSON, CSV e Markdown.

## 4. Fora de escopo (por enquanto)
1. Trilha de auditoria juridica/compliance (append-only formal).
2. RBAC completo com SSO corporativo.
3. Integracao obrigatoria online com API do GitHub/GitLab.
4. Persistencia de historico de arquivos exportados no servidor.

## 5. Personas
1. Arquiteto de entrega.
Necessidade: juntar rapido o que foi entregue por varios devs e publicar documentacao.
2. Lider tecnico.
Necessidade: validar escopo tecnico da entrega e acompanhar gaps (sem PR, sem ticket, etc.).
3. Plataforma/automacao.
Necessidade: consumir dados exportados em formato estruturado para scripts internos.

## 6. Fluxos principais
1. Cadastro manual em lote.
Informa contexto comum (frente/sprint/ticket/descricao), adiciona metadados e PRs opcionais, salva de forma transacional.
2. Importacao por commit.
Informa repo local e hash, sistema detecta metadados e preenche lote.
3. Busca de commits por email.
Informa email, periodo e branch opcional, escolhe commit e reaproveita no cadastro.
4. Geracao de release.
Filtra por contexto e gera texto de release.
5. Exportacao multiformato.
Exporta o conjunto filtrado da entrega em JSON, CSV ou Markdown.

## 7. Estado atual implementado
1. Endpoint transacional de lote implementado.
2. Dedupe de PR por metadata implementado em regra de banco.
3. Validacao de entrada reforcada em metadados e PR.

## 8. Requisitos funcionais (RF)
RF-01: Cadastrar metadados em lote com contexto comum.
RF-02: Evitar duplicidade de metadata no mesmo contexto (frente+sprint+tipo+nome).
RF-03: Evitar duplicidade de PR para o mesmo metadata.
RF-04: Validar entradas obrigatorias e tamanhos maximos de campos.
RF-05: Permitir reaproveitar metadata ja existente ao processar lote.
RF-06: Retornar resumo de processamento do lote (total, novos, reaproveitados, PRs criados).
RF-07: Permitir gerar release note a partir dos filtros atuais.
RF-08: Permitir exportacao com formato selecionado (json, csv, md).
RF-09: Aplicar os mesmos filtros da tela no endpoint de export.
RF-10: Incluir metadados de contexto da exportacao (data/hora e filtros ativos).
RF-11: Quando nao houver itens, retornar arquivo valido e legivel (sem erro tecnico).
RF-12: Retornar 400 para formato invalido.

## 9. Requisitos nao funcionais (RNF)
RNF-01: Operacao de lote deve ser atomica no banco (transacao).
RNF-02: Mensagens de erro devem ser claras para usuario final.
RNF-03: API deve responder em JSON padrao para erros.
RNF-04: Compatibilidade com execucao local Windows.
RNF-05: Exportacao ate 5.000 itens deve responder em ate 2 segundos em ambiente local tipico.
RNF-06: Encoding UTF-8 em todos os formatos exportados.

## 10. Contratos de API

### 10.1 Endpoint existente - lote
POST /api/metadatas/bulk

Request:
```json
{
  "front_id": 1,
  "sprint_id": 2,
  "ticket": "CHG-2481",
  "description": "Entrega da sprint",
  "metadata_items": [
    {
      "metadata_name": "AccountTrigger",
      "metadata_type_id": 1,
      "change_type": "Alteracao"
    }
  ],
  "prs": [
    {
      "label": "PR #123",
      "url": "https://github.com/org/repo/pull/123"
    }
  ]
}
```

Response:
```json
{
  "ok": true,
  "total_metadata": 3,
  "created_count": 2,
  "reused_count": 1,
  "pr_created_count": 4
}
```

Erros esperados:
1. 400 para validacao de entrada.
2. 409 para conflito de unicidade.
3. 500 para falha inesperada.

### 10.2 Endpoint proposto - exportacao multiformato
GET /api/exports

Query params:
1. format: json | csv | md (obrigatorio).
2. front_id: inteiro positivo (opcional).
3. sprint_id: inteiro positivo (opcional).
4. metadata_type_id: inteiro positivo (opcional).
5. q: texto livre (opcional).
6. change_type: Criacao | Alteracao | Correcao | Remocao (opcional).
7. has_pr: true | false (opcional).
8. include_pr_details: true | false (opcional, default true).

Headers de sucesso esperados:
1. JSON: application/json; charset=utf-8.
2. CSV: text/csv; charset=utf-8.
3. MD: text/markdown; charset=utf-8.
4. Content-Disposition: attachment; filename=release_export_YYYYMMDD_HHmmss.ext.

Status esperados:
1. 200 para exportacao gerada.
2. 400 para parametros invalidos.
3. 500 para erro inesperado.

## 11. Semantica de filtros
1. Regra geral: combinacao por AND entre filtros estruturados.
2. Busca textual q: OR entre metadata_name, ticket e description, com case-insensitive.
3. front_id, sprint_id, metadata_type_id, change_type: igualdade exata.
4. has_pr=true: apenas itens com 1 ou mais PRs.
5. has_pr=false: apenas itens sem PR.
6. Filtro ausente nao restringe resultado.
7. Ordenacao padrao da exportacao:
front asc, sprint asc (nulos por ultimo), metadata_type asc, metadata_name asc, created_at desc como desempate.

## 12. Especificacao por formato de export

### 12.1 JSON
Campos minimos:
1. exported_at (ISO-8601).
2. filters (objeto com filtros efetivos).
3. total_items.
4. items (lista de metadados com prs).

### 12.2 CSV
Colunas minimas:
1. front.
2. sprint.
3. metadata_type.
4. metadata_name.
5. change_type.
6. ticket.
7. description.
8. pr_count.
9. pr_labels.
10. pr_urls.
11. created_at.

Regras:
1. Escapar virgula, aspas e quebra de linha.
2. Ticket e sprint nulos devem sair como vazio.

### 12.3 Markdown
Template minimo:
1. Titulo fixo: Release Notes.
2. Data/hora de geracao.
3. Escopo com filtros ativos.
4. Total de itens.
5. Agrupamento: Frente -> Sprint -> Tipo de Metadata.
6. Tabela por tipo com colunas:
Metadata | Ticket | Descricao | Tipo de Mudanca | PRs.

Regras:
1. PRs com link markdown quando houver.
2. Quando nao houver PR, usar "-".
3. Escapar pipe vertical e quebras de linha em campos textuais.
4. Descricao pode ser truncada para legibilidade no MD (exemplo: 120 chars), sem truncar em JSON/CSV.

## 13. Regras de negocio criticas
1. URL de PR aceita apenas http/https.
2. Mesmo PR nao pode ser vinculado duas vezes ao mesmo metadata.
3. Lote com qualquer item invalido nao grava parcialmente.
4. sprint_id deve pertencer a frente selecionada.
5. Exportacao deve refletir exatamente os filtros recebidos.
6. Mesmo filtro deve representar o mesmo conjunto de itens em JSON, CSV e MD.

## 14. Criterios de aceite

### 14.1 Baseline de lote
1. Dado um lote valido com 10 metadados, todos sao gravados ou nenhum e gravado.
2. Dado PR repetido no mesmo metadata, sistema ignora/recusa duplicidade sem quebrar consistencia.
3. Dado campo obrigatorio faltante, retorno 400 com mensagem clara.
4. Dado sprint fora da frente, retorno 400 especifico.
5. Dado lote com itens repetidos na mesma requisicao, sistema deduplica antes de gravar.

### 14.2 Exportacao
1. Dado filtro valido e format=json, retorno 200 com total_items coerente.
2. Dado filtro valido e format=csv, arquivo contem cabecalho e quantidade de linhas correspondente aos itens.
3. Dado filtro valido e format=md, arquivo contem titulo, escopo e agrupamento.
4. Dado format invalido, retorno 400 com mensagem clara.
5. Dado filtro sem resultados, retorno 200 com arquivo valido e estrutura minima.
6. Dado mesmo filtro em json/csv/md, conjunto de itens e equivalente entre formatos.

## 15. Edge cases
1. Itens com sprint nula.
2. Campos com acentos e caracteres especiais.
3. Texto com pipe vertical no markdown.
4. Descricao com quebra de linha e aspas no csv.
5. PR URL antiga invalida vinda de dados legados.
6. q com caracteres especiais como % e _.

## 16. Plano de implementacao (slices)
1. Slice 1 - JSON export. Status: concluido em 2026-05-04.
Criar servico comum de consulta filtrada e endpoint GET /api/exports com format=json.
2. Slice 2 - CSV export. Status: concluido em 2026-05-04.
Adicionar serializacao csv com escaping robusto e colunas padrao.
3. Slice 3 - MD export. Status: concluido em 2026-05-04.
Adicionar template markdown agrupado por frente/sprint/tipo.
4. Slice 4 - UX. Status: concluido em 2026-05-04.
Botoes de exportacao na aba Gerar release note com estado de carregamento ("Exportando..."), feedback de sucesso ("Exportado!") e exibicao de erro no painel de release quando a requisicao falha.

## 17. Definition of Done desta spec
1. Contrato de API de export aprovado.
2. Criterios de aceite fechados para lote e exportacao.
3. Edge cases mapeados.
4. Plano em slices definido para implementacao incremental.

## 18. Backlog recomendado (apos exportacao)
1. Campo delivery_tag para agrupar entrega especifica sem depender apenas de sprint.
2. Endpoint de health para operacao local.
3. Lista de verificacao de entrega (itens sem PR, sem ticket, sem descricao).
4. Presets de filtro por time/frente.

## 19. Cadencia SDD sugerida
1. Uma spec curta por funcionalidade.
2. Criterios de aceite definidos antes de codar.
3. Implementacao em PR pequeno por slice.
4. Validacao manual guiada por checklist do criterio de aceite.
5. Atualizacao da spec quando regra mudar.

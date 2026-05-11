# Release Notes Hub

Aplicacao web para centralizar e compartilhar release notes com foco em projetos Salesforce.

Embora o foco principal seja Salesforce, a estrutura e o fluxo deste projeto permitem uso em outros tipos de projetos e times.

## Stack

- Node.js
- Express
- HTML/CSS/JavaScript

## Como executar

1. Instale as dependencias:
   - `npm install`
2. Inicie o servidor:
   - `npm start`
3. Abra no navegador:
   - `http://localhost:3030`

## Aviso de seguranca (uso local)

Este aplicativo foi projetado para uso local (localhost) e ambiente de desenvolvimento.

Nao publique este projeto diretamente em servidor proprio ou internet sem uma camada de seguranca adequada.

Se houver necessidade de deploy fora do ambiente local, e obrigatorio implementar pelo menos:

- Autenticacao de usuarios
- Autorizacao por perfil/permissao
- Filtragem/minimizacao de campos sensiveis nas respostas da API
- Endurecimento de headers e TLS/HTTPS
- Politica de logs sem exposicao de dados sensiveis

Sem essas medidas, existe risco de exposicao de dados e uso indevido da aplicacao.

## Banco de dados local

No primeiro start, o arquivo `release.db` e as tabelas sao criados automaticamente.

## Busca por commits de varias pessoas

Na aba `Busca por commit`, e possivel selecionar mais de uma pessoa salva e consultar commits de todos os autores ao mesmo tempo.

- Selecionar varias pessoas no campo de pessoas salvas usando `Ctrl`/`Cmd`
- Informar emails adicionais manualmente, separados por virgula, espaco ou quebra de linha
- Usar `Selecionar todos` e `Limpar selecao` na grade de resultados
- Acionar `Usar todos` para importar todos os commits encontrados
- Acionar `Usar selecionados` para importar apenas os commits marcados

O fluxo continua compatível com a busca por uma unica pessoa e com o atalho `Usar commit` de cada linha.

## Importacao de metadados por multiplos commits

O fluxo `Incluir metadados` suporta importacao por hash unico e por lote.

- Hash unico: continua usando o caminho tradicional e permanece compativel com o comportamento anterior.
- Multiplos hashes: informe hashes separados por espaco, virgula ou quebra de linha no campo de commit.
- Limite operacional: ate 50 commits por importacao.
- Deduplicacao: metadados repetidos entre commits sao consolidados automaticamente por tipo e nome.

No fluxo `Busca por commit`, tambem e possivel:

- Selecionar varios commits na grade (checkbox por linha)
- Usar `Selecionar todos` e `Limpar selecao`
- Acionar `Usar selecionados` para importar tudo em lote no modulo de metadados

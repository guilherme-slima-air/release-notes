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

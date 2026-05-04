# Spec-Driven Development - <Nome da Feature>

## 1. Contexto
Objetivo desta feature:
1. <Objetivo 1>
2. <Objetivo 2>
3. <Objetivo 3>

Relacao com specs existentes:
1. <Como se conecta com consolidacao-entrega ou outra spec>
2. <Impacto em fluxo atual>

## 2. Problema e visao
Problema atual:
1. <Dor principal>
2. <Dor secundaria>

Visao da solucao:
1. <Como a feature resolve>
2. <Valor para usuario>

## 3. Objetivos do produto
1. <Objetivo funcional 1>
2. <Objetivo funcional 2>
3. <Objetivo funcional 3>

## 4. Fora de escopo (por enquanto)
1. <Item fora de escopo 1>
2. <Item fora de escopo 2>
3. <Item fora de escopo 3>

## 5. Personas
1. <Persona 1>.
Necessidade: <necessidade principal>.
2. <Persona 2>.
Necessidade: <necessidade principal>.

## 6. Fluxos principais
1. <Fluxo 1>.
<Descricao curta do passo a passo>.
2. <Fluxo 2>.
<Descricao curta do passo a passo>.
3. <Fluxo 3>.
<Descricao curta do passo a passo>.

## 7. Requisitos funcionais (RF)
RF-01: <Requisito funcional 1>.
RF-02: <Requisito funcional 2>.
RF-03: <Requisito funcional 3>.
RF-04: <Requisito funcional 4>.
RF-05: <Requisito funcional 5>.

## 8. Requisitos nao funcionais (RNF)
RNF-01: <NFR 1>.
RNF-02: <NFR 2>.
RNF-03: <NFR 3>.

## 9. Modelo de dados (se aplicavel)
Tabela/entidade sugerida: <nome>

Campos:
1. <campo 1> (<tipo>, <regra>). 
2. <campo 2> (<tipo>, <regra>). 
3. <campo 3> (<tipo>, <regra>). 

Indices/constraints:
1. <indice ou unique>

## 10. Contratos de API (se aplicavel)

### 10.1 <Operacao 1>
<METODO> <rota>

Request:
```json
{
  "<campo>": "<valor>"
}
```

Response:
```json
{
  "<campo>": "<valor>"
}
```

### 10.2 <Operacao 2>
<METODO> <rota>

Erros esperados:
1. 400 para validacao de entrada.
2. 404 para recurso inexistente.
3. 409 para conflito de unicidade.
4. 500 para falha inesperada.

## 11. Regras de negocio criticas
1. <Regra critica 1>.
2. <Regra critica 2>.
3. <Regra critica 3>.

## 12. Criterios de aceite
1. Dado <contexto>, quando <acao>, entao <resultado esperado>.
2. Dado <contexto>, quando <acao>, entao <resultado esperado>.
3. Dado <contexto>, quando <acao>, entao <resultado esperado>.
4. Dado <contexto>, quando <acao>, entao <resultado esperado>.

## 13. Edge cases
1. <Edge case 1>.
2. <Edge case 2>.
3. <Edge case 3>.

## 14. Plano de implementacao (slices)
1. Slice 1 - <Nome do slice>. Status: planejado.
<Descricao do que entra no slice>.
2. Slice 2 - <Nome do slice>. Status: planejado.
<Descricao do que entra no slice>.
3. Slice 3 - <Nome do slice>. Status: planejado.
<Descricao do que entra no slice>.

## 15. Definition of Done desta spec
1. <Criterio DoD 1>.
2. <Criterio DoD 2>.
3. <Criterio DoD 3>.

## 16. Log de status (opcional)
1. <YYYY-MM-DD> - Slice 1 concluido.
2. <YYYY-MM-DD> - Slice 2 concluido.

---

Checklist rapido antes de implementar:
1. Escopo fechado e fora de escopo claro.
2. RF e RNF revisados.
3. Criterios de aceite testaveis.
4. Slices pequenos e independentes.
5. Backlog da spec consolidacao-entrega atualizado com referencia desta feature.

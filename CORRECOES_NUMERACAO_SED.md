# Correções — Numeração de Chamada e Fidelidade ao SED

## Contexto

Este documento registra a investigação e as correções aplicadas ao sistema
de importação de dados do SED (Secretaria Digital Escolar), motivadas por
casos reais de alunos com número de chamada incorreto, duplicado ou ausente
após a importação.

**Princípio de negócio estabelecido**: o sistema deve ser um **espelho fiel
do SED**. Cada linha do relatório oficial (PDF/Excel) — nome, número,
situação, data de movimentação — deve ser reproduzida exatamente como está
no documento de origem, sem lógica adicional de "correção" ou "melhoria" por
parte do sistema. Quando o mesmo aluno (mesmo RA) aparece em mais de uma
linha do SED — por exemplo, uma linha de transferência (TRAN) e outra de
matrícula ativa (ATIVO) — **ambas as linhas devem existir no sistema**, com
seus próprios números, exatamente como aparecem no relatório.

## Casos reais que motivaram a investigação

- **Bernardo Santiago Cantarero Berthault** (4º Ano C, Prof. Cida Drigo):
  aparece no SED como TRAN nº4 e ATIVO nº5 (mesmo RA). O sistema estava
  fundindo as duas linhas em uma só, ora perdendo o número correto, ora
  criando um buraco na numeração da turma (nº4 sumindo da lista).
- **Isaac Antony de Souza Nascimento** (2º Ano A, Prof. Ione): aparece no
  SED como BXTR no 2º Ano A (nº12) e ATIVO no 2º Ano B (RAs iguais, turmas
  diferentes). O sistema sobrescrevia um registro pelo outro, fazendo o
  nº12 desaparecer da turma A.

## Causas raiz encontradas (por ordem de descoberta)

### 1. Merge da situação/número dentro do parser (PR #238, #241)
O código que unifica duplicidades de RA durante a leitura do arquivo SED
usava a regra "situação não-ATIVO sempre vence" para decidir qual registro
manter, e travava o número no registro que chegasse primeiro na leitura do
arquivo — não necessariamente o vigente. Corrigido para decidir pela **Data
de Movimentação mais recente**, e o número passou a acompanhar o registro
vigente, nunca ficando "preso" ao registro desatualizado.

### 2. Pré-limpeza de duplicatas já existentes no banco (PR #240)
Antes de cada importação, uma rotina separada varre o banco procurando RAs
duplicados de importações anteriores e os unifica. Essa rotina usava a
mesma regra antiga (não-ATIVO vence) e rodava **antes** da correção do
parser conseguir agir — por isso reimportar sozinho não resolvia. Corrigida
para usar a mesma lógica de recência.

### 3. Bug de posição no parser de PDF (PR #243)
O mapa que localiza o número de chamada pela posição (X/Y) de cada RA na
página era indexado só pela string do RA. Quando o mesmo RA aparece duas
vezes na mesma página (TRAN + ATIVO), a segunda ocorrência batia num guard
`if (jáMapeado) continue` e nunca tinha seu próprio número mapeado —
herdava silenciosamente o número da primeira linha. Corrigido: cada
ocorrência agora tem uma chave própria (`RA#índice de aparição`), tanto ao
mapear quanto ao consultar.

### 4. Mudança de modelo: mesclar → espelhar (PR #242)
Até aqui, o sistema tentava sempre **unificar** duplicidades de RA na mesma
turma em um único registro "correto". O caso real do Bernardo mostrou que
isso está errado: o SED lista as duas linhas por um motivo — são dois
eventos de matrícula distintos (saída e retorno). A partir daqui, TRAN +
outra situação na mesma turma passou a gerar **duas linhas separadas** no
sistema — o mesmo padrão já usado para REMA + ATIVO (retorno de
remanejamento).

### 5. Varredura preventiva automática (PR #239)
Para não depender de alguém encontrar manualmente uma duplicidade e
reportar, o Dashboard e a página Alunos passaram a rodar uma auditoria
automática: qualquer duplicidade real de número de chamada (dois alunos
diferentes, mesma turma, mesmo número) gera um alerta visível assim que o
sistema é aberto — sem falso positivo para remanejamento ou situações
excluídas da contagem (TRAN/BXTR/REMA/N COM).

### 6. Constraint do banco de dados incompleta (PR #258)
Mesmo com o parser corrigido, a trava de unicidade do banco
(`aluno_ra_uniq`) só isentava as situações **REMA** e **TRAN** da
obrigatoriedade de RA único — **BXTR não estava na lista**. O caso do Isaac
Antony (BXTR numa turma + ATIVO noutra) violava essa trava, e o código de
tratamento de conflito **sobrescrevia** um registro pelo outro em vez de
manter os dois, apagando uma das duas linhas do SED. Corrigida para que a
unicidade valha **somente** para o registro ATIVO (a matrícula corrente) —
TRAN, BXTR, REMA e N COM podem coexistir em turmas diferentes para o mesmo
RA, como o SED realmente mostra. Migração: `AJUSTAR_UNICIDADE_ATIVO.sql`.

## Estado atual

- O parser extrai situação, número e data de movimentação de cada linha do
  SED sem alterar nem "corrigir" nada.
- Duplicidades de RA na mesma turma (TRAN/REMA + outra situação) viram duas
  linhas separadas, cada uma com seu próprio número — nunca fundidas.
- A trava do banco permite essa coexistência para todas as situações
  administrativas (TRAN, BXTR, REMA, N COM), exigindo unicidade apenas para
  o registro ATIVO.
- Dashboard e Alunos auditam automaticamente e alertam sobre qualquer
  duplicidade real de numeração, sem precisar de verificação manual.

## O que isso não garante

Esta não é uma promessa de zero bugs futuros — é o fechamento das classes
de erro específicas que causaram os casos relatados (numeração, situação e
duplicidade de RA entre turmas). Qualquer novo padrão de dado do SED ainda
não visto pode expor um caso não coberto; a varredura automática existe
justamente para detectar isso cedo, sem depender de garimpo manual.

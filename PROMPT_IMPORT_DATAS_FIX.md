# PROMPT — Corrigir datas de matrícula no importador
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA
**Arquivo-alvo:** `frontend/src/pages/Importar.tsx`
**Branch:** desenvolvimento atual

---

## CONTEXTO E PROBLEMA

Após importar o Excel da Secretaria Escolar Digital (SED), os campos
`data_inicio_matricula` e `data_fim_matricula` aparecem como "⚠️ não informado"
para todos os alunos — inclusive ATIVO. O SED exporta as datas corretamente,
mas o sistema não as está gravando no banco.

**Causa identificada — dois problemas independentes:**

---

## PROBLEMA 1 — Normalização de acentos nas chaves do Excel

O Excel do SED exporta os cabeçalhos com acentos:
- `"Data Início Matrícula"` (com Í e Í)
- `"Data Fim Matrícula"` (com Í)
- `"Situação"` (com ã)
- `"Série"` (com é)

O parser já usa `normalizeStr` para normalizar as chaves, mas há caminhos no código
onde a lookup é feita com `Object.keys(nr).find(k => k.includes('INICIO'))` — e essa
busca falha se a chave ainda tiver acentos.

### Correção 1a — Garantir normalização completa

**Localizar** (em `parseExcels`, dentro do loop `for (const row of rows)`):

```typescript
for (const row of rows) {
  const nr: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    nr[normalizeStr(String(k).trim())] = v;
  }
```

**Verificar** que `normalizeStr` está assim (remove acentos + ordinais):
```typescript
function normalizeStr(s: string): string {
  return s.toUpperCase().trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove acentos
    .replace(/[ªº°]/g, '');           // remove ordinais ª º
}
```

Se estiver diferente, corrigir para essa versão.

### Correção 1b — Adicionar todos os aliases de colunas de data

**Localizar** o bloco `const dataInicioMatricula = fmtDate(...)` e **substituir** por:

```typescript
const dataInicioMatricula = fmtDate(
  nr['DATA INICIO MATRICULA'] ??           // "Data Início Matrícula" normalizado
  nr['DATA DE INICIO DA MATRICULA'] ??
  nr['DT INICIO MATRICULA'] ??
  nr['INICIO DA MATRICULA'] ??
  nr['INICIO MATRICULA'] ??
  nr['DATA DA MATRICULA'] ??
  nr['DT INICIO'] ??
  nr[Object.keys(nr).find(k =>
    k.replace(/[ÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ]/gi, c =>
      'AAAAAAAEEEEIIIIOOOOOOUUUU'['ÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ'.indexOf(c)]
    ).includes('INICIO') &&
    k.replace(/[ÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ]/gi, c =>
      'AAAAAAAEEEEIIIIOOOOOOUUUU'['ÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ'.indexOf(c)]
    ).includes('MATRICULA')
  ) ?? '']
);

const dataFimMatricula = fmtDate(
  nr['DATA FIM MATRICULA'] ??             // "Data Fim Matrícula" normalizado
  nr['DT FIM MATRICULA'] ??
  nr['FIM MATRICULA'] ??
  nr['DATA FIM'] ??
  nr[Object.keys(nr).find(k =>
    k.replace(/[ÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ]/gi, c =>
      'AAAAAAAEEEEIIIIOOOOOOUUUU'['ÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ'.indexOf(c)]
    ).includes('FIM') &&
    k.replace(/[ÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ]/gi, c =>
      'AAAAAAAEEEEIIIIOOOOOOUUUU'['ÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ'.indexOf(c)]
    ).includes('MATRICULA')
  ) ?? '']
);
```

> **Nota:** Este fallback normaliza INLINE (sem depender de normalizeStr já ter rodado)
> para garantir que qualquer variação de acento seja tratada.

---

## PROBLEMA 2 — Merge REMA+ATIVO sobrescreve datas ao processar múltiplas fontes

Quando o usuário importa simultaneamente Excel + SED HTML, o sistema processa
ambos. A segunda rodada (`mergeAluno` para o HTML) detecta novamente o par REMA+ATIVO
e **sobrescreve** o registro REMA com dados do HTML — que tem datas vazias —
apagando as datas corretas que vieram do Excel.

### Localizar o bloco `ehRemaDuplo`:

```typescript
if (ehRemaDuplo) {
  const rema  = existente.situacao === 'REMA' ? existente : a;
  const ativo = existente.situacao === 'REMA' ? a : existente;
  // ...
  todosAlunos.set(key, ativo);           // destino (ATIVO) — chave principal
  todosAlunos.set(`${key}|REMA`, rema);  // origem  (REMA)  — chave separada
  return;
}
```

### Substituir as duas linhas `todosAlunos.set` por:

```typescript
// Preservar datas do ATIVO já armazenado (não sobrescrever com vazio)
const existAtivo = todosAlunos.get(key);
if (existAtivo) {
  if (!ativo.dataInicioMatricula && existAtivo.dataInicioMatricula)
    ativo.dataInicioMatricula = existAtivo.dataInicioMatricula;
  if (!ativo.dataFimMatricula && existAtivo.dataFimMatricula)
    ativo.dataFimMatricula = existAtivo.dataFimMatricula;
  if (!ativo.dataMovimentacao && existAtivo.dataMovimentacao)
    ativo.dataMovimentacao = existAtivo.dataMovimentacao;
}
todosAlunos.set(key, ativo);           // destino (ATIVO) — chave principal

// Preservar datas do REMA já armazenado (não sobrescrever com vazio)
const remaKey = `${key}|REMA`;
const existRema = todosAlunos.get(remaKey);
if (existRema) {
  if (!rema.dataInicioMatricula && existRema.dataInicioMatricula)
    rema.dataInicioMatricula = existRema.dataInicioMatricula;
  if (!rema.dataFimMatricula && existRema.dataFimMatricula)
    rema.dataFimMatricula = existRema.dataFimMatricula;
  if (!rema.dataMovimentacao && existRema.dataMovimentacao)
    rema.dataMovimentacao = existRema.dataMovimentacao;
  if (!rema.turmaDestino && existRema.turmaDestino)
    rema.turmaDestino = existRema.turmaDestino;
  if (!rema.professoraDestino && existRema.professoraDestino)
    rema.professoraDestino = existRema.professoraDestino;
}
todosAlunos.set(remaKey, rema);  // origem (REMA) — chave separada
```

---

## PROBLEMA 3 — SED HTML não extrai datas de início dos registros ATIVO

Na função `parseSEDHTML` (ou `parseSEDPDF`), o registro ATIVO é criado sem
`dataInicioMatricula`:

```typescript
dataInicioMatricula: '',   // ← sempre vazio para todos os registros do HTML
```

O SED HTML **não contém** a coluna "Data Início Matrícula" — ela existe apenas
nos arquivos Excel. Portanto, as datas de início **só podem vir do Excel**.

### Regra de ouro para o importador:
> **Fonte autoritativa das datas:** sempre o Excel.
> O SED HTML só fornece: nome, RA, nascimento, série, professora, situação, data_movimentação.
> Nunca sobrescrever datas do Excel com datas vazias do HTML.

---

## RESUMO DAS MUDANÇAS

| # | Arquivo | O que fazer |
|---|---|---|
| 1 | `Importar.tsx` — `parseExcels` | Garantir `normalizeStr` correto nas chaves + alias de colunas de data |
| 2 | `Importar.tsx` — bloco `ehRemaDuplo` | Preservar datas existentes antes de sobrescrever com `todosAlunos.set` |
| 3 | `Importar.tsx` — merge normal | Confirmar que `if (a.dataInicioMatricula)` nunca sobrescreve com vazio |

---

## RESULTADO ESPERADO APÓS A CORREÇÃO

| Aluno | Campo | Antes | Depois |
|---|---|---|---|
| Alice REMA (Angelita, 2ª F) | Início | 04/02/2026 ✅ | 04/02/2026 ✅ |
| Alice REMA (Angelita, 2ª F) | Fim | 18/12/2026 ❌ | **22/04/2026** ✅ |
| Alice ATIVO (Solange, 2ª D) | Início | ⚠️ não informado ❌ | **23/04/2026** ✅ |
| Alice ATIVO (Solange, 2ª D) | Fim | 18/12/2026 ✅ | 18/12/2026 ✅ |
| Todos os outros ATIVO | Início | ⚠️ não informado ❌ | **data do Excel** ✅ |

---

*Prompt gerado pelo CEREBRO — Branch: claude/bold-hamilton-a1Oj6*

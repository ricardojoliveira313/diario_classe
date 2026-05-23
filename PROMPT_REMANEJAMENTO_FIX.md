# PROMPT — Correção do Remanejamento + Professor/Professora
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA
**Arquivo-alvo:** `frontend/src/pages/Alunos.tsx`
**Branch:** `claude/bold-hamilton-a1Oj6`

---

## CONTEXTO

Aluno REMANEJADO significa que saiu de uma turma (origem) e foi para outra (destino).
O sistema já armazena os campos no banco:
- `turma_origem` / `professora_origem` — turma e docente de onde saiu
- `turma_destino` / `professora_destino` — turma e docente para onde foi
- `data_inicio_matricula` — data de entrada na turma de origem
- `data_fim_matricula` — data de saída da turma de origem (= data do remanejamento)
- `data_movimentacao` — data em que o remanejamento foi registrado

Hoje o painel expandido do aluno **não mostra origem/destino** e o label **"Professora"** é sempre feminino, mesmo quando o docente é homem (ex: Magnus).

---

## PROBLEMA 1 — Painel do aluno remanejado não mostra origem e destino

### Localizar no arquivo `Alunos.tsx`:

O painel expandido é renderizado quando `expandido === a.id`. Procurar por:
```typescript
{expandido === a.id && (
```

Dentro desse bloco, há a linha que mostra **Início Matrícula**, **Fim Matrícula**, **Movimentação**, **Professora**, **NIS**.

### O que adicionar:

Quando `a.situacao === 'REMA'`, exibir bloco especial de remanejamento **antes** dos outros campos:

```typescript
{a.situacao === 'REMA' && (
  <div style={{
    background: 'rgba(249,115,22,0.08)',
    border: '1px solid rgba(249,115,22,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 8,
    fontSize: 13,
  }}>
    <div style={{ fontWeight: 700, color: theme.orange, marginBottom: 6 }}>
      🔄 Remanejamento
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px' }}>
      {/* ORIGEM */}
      {(a.turma_origem || a.professora_origem) && (
        <div>
          <span style={{ color: theme.textMuted, fontSize: 12 }}>Turma origem: </span>
          <span style={{ fontWeight: 600 }}>{a.turma_origem || '—'}</span>
          {a.professora_origem && (
            <span style={{ color: theme.textSecondary }}>
              {' '}· {labelDocente(a.professora_origem)} {a.professora_origem}
            </span>
          )}
        </div>
      )}
      {/* DESTINO */}
      {(a.turma_destino || a.professora_destino) && (
        <div>
          <span style={{ color: theme.textMuted, fontSize: 12 }}>Turma destino: </span>
          <span style={{ fontWeight: 600 }}>{a.turma_destino || '—'}</span>
          {a.professora_destino && (
            <span style={{ color: theme.textSecondary }}>
              {' '}· {labelDocente(a.professora_destino)} {a.professora_destino}
            </span>
          )}
        </div>
      )}
      {/* DOR Datas */}
      {a.data_inicio_matricula && (
        <div>
          <span style={{ color: theme.textMuted, fontSize: 12 }}>Início na origem: </span>
          <span>{a.data_inicio_matricula}</span>
        </div>
      )}
      {a.data_movimentacao && (
        <div>
          <span style={{ color: theme.textMuted, fontSize: 12 }}>Data remanejamento: </span>
          <span style={{ fontWeight: 600, color: theme.orange }}>{a.data_movimentacao}</span>
        </div>
      )}
    </div>
  </div>
)}
```

---

## PROBLEMA 2 — Label "Professora" deve ser "Professor" para homens

### Criar função auxiliar `labelDocente` no início do arquivo:

Adicionar logo após os imports, antes do `export default function Alunos()`:

```typescript
/** Retorna "Professor" ou "Professora" com base no nome do docente.
 *  Heurística: se o nome termina em "o", "os", "e" (nomes masculinos comuns),
 *  usa "Professor". Caso contrário usa "Professora".
 *  Exemplos: Magnus → Professor | Cátia → Professora | André → Professor
 */
function labelDocente(nome: string): string {
  if (!nome) return 'Professora';
  const n = nome.trim().split(' ')[0].toLowerCase(); // primeiro nome
  // Termina em vogal "o" ou consoantes típicas de nomes masculinos
  if (/o$|os$|us$|el$|on$|an$|ar$|or$|er$|ir$|ur$/.test(n)) return 'Professor';
  // Nomes masculinos conhecidos que fogem da regra
  const masculinos = ['magnus', 'andre', 'felipe', 'gabriel', 'rafael', 'daniel',
    'miguel', 'samuel', 'israel', 'ezequiel', 'manoel', 'manuel', 'ismael'];
  if (masculinos.includes(n)) return 'Professor';
  return 'Professora';
}
```

### Substituir TODOS os labels fixos "Professora:" por `{labelDocente(t?.professora || '')}:`

**Localizar as ocorrências:**

```
Buscar por: "Professora:"
```

Todas as ocorrências devem ser trocadas por:
```typescript
{labelDocente(t?.professora || a.professora || '')}:
```

**Localizar as ocorrências no cabeçalho da tabela:**

```
Buscar por: <span>Professora</span>
```

Manter como "Professora" no cabeçalho da tabela (é o nome da coluna, não o label de um docente específico). Só trocar onde o label se refere a um docente específico (no painel expandido e nas linhas da tabela).

---

## PROBLEMA 3 — Início Matrícula "não informado" para alunos remanejados

### Causa:

Quando o aluno é remanejado, o registro do aluno na turma de **destino** é um novo registro — e esse novo registro não tem `data_inicio_matricula` porque ela não foi copiada do Educacenso/SED para o registro de destino.

### Correção no painel expandido:

No bloco que exibe `data_inicio_matricula`, quando o aluno é REMA e o campo está vazio, mostrar uma mensagem diferente (não "não informado" genérico):

**Localizar:**
```typescript
{a.situacao === 'REMA' && !a.data_inicio_matricula && (
  // mostrar aviso diferente
)}
```

**Substituir a mensagem de "não informado" para REMA:**
```typescript
// Antes (genérico para todos):
<span style={{ color: theme.orange }}>⚠️ não informado</span>

// Depois (específico para REMA — mostrar data de origem se disponível):
a.situacao === 'REMA'
  ? <span style={{ color: theme.textMuted, fontSize: 12 }}>— ver turma origem</span>
  : <span style={{ color: theme.orange }}>⚠️ não informado — clique em ✏️ Situação para preencher</span>
```

---

## PROBLEMA 4 — Campo "Professora" no cabeçalho da tabela

O cabeçalho da coluna exibe "Professora". Para ser neutro (já que há professores e professoras), trocar para:

**Localizar:**
```typescript
<span>Professora</span>  // no cabeçalho da tabela
```

**Substituir por:**
```typescript
<span>Docente</span>
```

---

## RESUMO DAS MUDANÇAS

| # | O que fazer | Onde |
|---|---|---|
| 1 | Criar função `labelDocente(nome)` | Antes do export default |
| 2 | Bloco de remanejamento origem/destino no painel expandido | Dentro de `{expandido === a.id && ...}` |
| 3 | Trocar "Professora:" → `{labelDocente(...)}:` no painel expandido | Painel do aluno |
| 4 | Trocar "Professora" → "Docente" no cabeçalho da tabela | Cabeçalho da grid |
| 5 | Mensagem especial de início matrícula para REMA | Painel do aluno |

---

## CAMPOS DO BANCO (tabela `Aluno` no Supabase)

Verificar se os campos existem. Se não existirem, executar no SQL Editor:

```sql
ALTER TABLE "Aluno"
  ADD COLUMN IF NOT EXISTS turma_origem text,
  ADD COLUMN IF NOT EXISTS professora_origem text,
  ADD COLUMN IF NOT EXISTS turma_destino text,
  ADD COLUMN IF NOT EXISTS professora_destino text;
```

---

*Prompt gerado pelo CEREBRO — Branch: claude/bold-hamilton-a1Oj6*

# PROMPT — Remanejamento Complemento (Parte 2)
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA
**Arquivo-alvo:** `frontend/src/pages/Alunos.tsx`
**Branch:** `claude/sort-fix-alunos` (ou branch atual de desenvolvimento)

---

## CONTEXTO

A Parte 1 já foi executada e está correta:
- ✅ REMA aparece antes do ATIVO na lista (mesmo nome agrupado)
- ✅ Ao mudar situação para REMA, salva `turma_origem` e `professora_origem`
- ✅ Painel mostra "⬅ Veio de:" e "➡ Foi para:"

Esta Parte 2 completa os itens que faltaram:
1. Label "Professora:" dinâmico (Professor para homens, Professora para mulheres)
2. Cabeçalho da tabela "Professora" → "Docente"
3. Mensagem especial de `data_inicio_matricula` para alunos REMA

---

## MUDANÇA 1 — Criar função `labelDocente` antes do `export default`

**Localizar:**
```typescript
export default function Alunos() {
```

**Inserir ANTES dessa linha:**
```typescript
/** Retorna "Professor" ou "Professora" conforme o primeiro nome do docente.
 *  Heurística: termina em "o/os/us/el/on/an/ar/or/er/ir/ur" → masculino.
 *  Nomes conhecidos fora da regra também estão na lista.
 *  Exemplos: Magnus → Professor | Cátia → Professora | André → Professor
 */
function labelDocente(nome: string): string {
  if (!nome) return 'Professora';
  const n = nome.trim().split(' ')[0].toLowerCase();
  if (/o$|os$|us$|el$|on$|an$|ar$|or$|er$|ir$|ur$/.test(n)) return 'Professor';
  const masculinos = ['magnus', 'andre', 'felipe', 'gabriel', 'rafael', 'daniel',
    'miguel', 'samuel', 'israel', 'ezequiel', 'manoel', 'manuel', 'ismael'];
  if (masculinos.includes(n)) return 'Professor';
  return 'Professora';
}

```

---

## MUDANÇA 2 — Trocar "Professora:" fixo no painel expandido

**Localizar:**
```typescript
{t?.professora && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>Professora:</span> {t.professora}</div>}
```

**Substituir por:**
```typescript
{t?.professora && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>{labelDocente(t.professora)}:</span> {t.professora}</div>}
```

---

## MUDANÇA 3 — Trocar cabeçalho da tabela "Professora" → "Docente"

**Localizar:**
```typescript
<span>Professora</span><span>Turma</span>
```

**Substituir por:**
```typescript
<span>Docente</span><span>Turma</span>
```

> ⚠️ Não alterar o label do filtro `<label>Professora</label>` — esse é o filtro lateral,
> não o cabeçalho da coluna. Alterar apenas o `<span>Professora</span>` que está no cabeçalho
> da grid de alunos (mesma linha do `<span>Turma</span>`).

---

## MUDANÇA 4 — Mensagem especial para REMA sem data de início

**Localizar:**
```typescript
{a.data_inicio_matricula
  ? <span style={{ color: theme.text }}>{a.data_inicio_matricula}</span>
  : <span style={{ color: theme.danger, fontWeight: 600 }}>⚠️ não informado</span>
}
```

**Substituir por:**
```typescript
{a.data_inicio_matricula
  ? <span style={{ color: theme.text }}>{a.data_inicio_matricula}</span>
  : a.situacao === 'REMA'
    ? <span style={{ color: theme.textMuted, fontStyle: 'italic', fontSize: 12 }}>— ver turma origem</span>
    : <span style={{ color: theme.danger, fontWeight: 600 }}>⚠️ não informado — clique em ✏️ Situação para preencher</span>
}
```

---

## RESUMO

| # | O que fazer | Localizar |
|---|---|---|
| 1 | Inserir função `labelDocente()` | Antes de `export default function Alunos()` |
| 2 | `"Professora:"` → `{labelDocente(t.professora)}:` | Linha no painel expandido com `t?.professora &&` |
| 3 | `<span>Professora</span>` → `<span>Docente</span>` | Cabeçalho da grid (mesma linha do `<span>Turma</span>`) |
| 4 | Mensagem `⚠️ não informado` com tratamento especial para REMA | Bloco `data_inicio_matricula` no painel expandido |

---

*Prompt gerado pelo CEREBRO — Branch: claude/bold-hamilton-a1Oj6*

# PROMPT — Ordenação por Nº SED + Agrupamento por Turma
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA
**Arquivo-alvo:** `frontend/src/pages/Alunos.tsx`
**Branch:** main

---

## CONTEXTO

O SED (Secretaria Escolar Digital) é a fonte de verdade para tudo:
- `numero` = Nº de chamada do aluno na turma (vem do PDF do SED)
- A ordem dos alunos no sistema deve espelhar **exatamente** a ordem do SED
- Alunos matriculados no início do ano ficam nos primeiros números (ex: 1–24)
- Alunos que chegaram depois (remanejados, transferências recebidas) ficam nos últimos números (ex: 25, 26, 27...)
- **Não importa o nome**: se "Alice" entrou depois de "Yu", Alice aparece depois de Yu

---

## PROBLEMA 1 — Ordenação alfabética em vez de Nº SED

### Estado atual (ERRADO)
```typescript
.sort((a, b) => {
  const nomeA = (a.nome ?? '').toLowerCase();
  const nomeB = (b.nome ?? '').toLowerCase();
  if (nomeA !== nomeB) return nomeA.localeCompare(nomeB, 'pt-BR');
  const ordemSit: Record<string, number> = { REMA: 0, ATIVO: 1, ... };
  return (ordemSit[a.situacao] ?? 9) - (ordemSit[b.situacao] ?? 9);
});
```

### Correção — ordenar por `numero` do SED
Localizar o `.sort(...)` de `alunosFiltrados` e **substituir por**:

```typescript
.sort((a, b) => {
  const nA = a.numero || 9999;
  const nB = b.numero || 9999;
  if (nA !== nB) return nA - nB;
  // Mesmo numero: mesmo aluno em situações diferentes → REMA antes do ATIVO
  const ordemSit: Record<string, number> = { REMA: 0, ATIVO: 1, TRAN: 2, BXTR: 3, 'N COM': 4, ABAN: 5 };
  return (ordemSit[a.situacao] ?? 9) - (ordemSit[b.situacao] ?? 9);
});
```

**Regra:** `numero` é o Nº de chamada do SED. Alunos sem `numero` (0 ou undefined) vão para o final (9999). 
Dentro do mesmo `numero` (par REMA+ATIVO do mesmo aluno), REMA aparece primeiro.

---

## PROBLEMA 2 — "Todas as turmas" não agrupa por turma

### Estado atual (ERRADO)
Quando `turmaId === '__all__'` (filtro "Todas as turmas"), o código exibe uma lista única
de todos os alunos misturados, sem separação por professora/turma.

### Comportamento esperado
Quando "Todas as turmas" for selecionado, exibir assim:

```
┌─ 📚 1ª ETAPA PRÉ-ESCOLA A MANHA — Professora Roseli Pereira ──────────┐
│  1. João Silva                                                          │
│  2. Maria Souza                                                         │
│  ...                                                                    │
│  26. Ana Lima                                                           │
└────────────────────────────────────────────────────────────────────────┘
┌─ 📚 1ª ETAPA PRÉ-ESCOLA B MANHA — Professor Carlos Mendes ────────────┐
│  1. Pedro Costa                                                         │
│  ...                                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

Dentro de cada turma: alunos ordenados por `numero` (igual ao Problema 1).

### Correção — Adicionar lógica de agrupamento

No JSX onde os alunos são renderizados, **localizar** o trecho:

```typescript
{alunosFiltrados.map((a, i) => {
  const t = turmaMap.get(a.turmaId);
  // ...
```

**Substituir** por:

```typescript
{turmaId === '__all__'
  ? (() => {
      // Agrupa por turmaId preservando a ordem já definida pelo sort
      const grupos = new Map<string, typeof alunosFiltrados>();
      for (const a of alunosFiltrados) {
        const tid = a.turmaId || '__sem_turma__';
        if (!grupos.has(tid)) grupos.set(tid, []);
        grupos.get(tid)!.push(a);
      }
      const blocos: React.ReactNode[] = [];
      for (const [tid, alunos] of grupos) {
        const t = turmaMap.get(tid);
        blocos.push(
          <div key={`header-${tid}`} style={{
            margin: '20px 0 6px',
            padding: '8px 14px',
            background: theme.primary,
            color: 'white',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            📚 {t ? `${t.nome} — ${labelDocente(t.professora || '')} ${t.professora || ''}` : 'Sem turma'}
            <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12, opacity: 0.8 }}>
              {alunos.length} aluno{alunos.length !== 1 ? 's' : ''}
            </span>
          </div>
        );
        alunos.forEach((a, i) => {
          blocos.push(renderAluno(a, i));  // ver nota abaixo
        });
      }
      return blocos;
    })()
  : alunosFiltrados.map((a, i) => renderAluno(a, i))
}
```

> **Nota sobre `renderAluno`:** Extrair o conteúdo do `.map((a, i) => <div key={a.id}>...</div>)` 
> para uma função `renderAluno(a: Aluno, i: number): React.ReactNode` fora do JSX.
> Assim o mesmo código serve tanto para a view de uma turma quanto para "todas as turmas".

---

## PROBLEMA 3 — Nº exibido usa fallback `i + 1` (índice do loop)

### Estado atual (ERRADO)
```typescript
<span style={{ fontSize: 13, color: theme.textMuted }}>{a.numero || i + 1}</span>
```

O `i + 1` é o índice do loop, não o Nº do SED. Se um aluno não tiver `numero`, 
exibir `—` em vez do índice.

### Correção
```typescript
<span style={{ fontSize: 13, color: theme.textMuted }}>
  {a.numero || <span style={{ color: theme.textMuted, fontSize: 11 }}>—</span>}
</span>
```

---

## RESUMO DAS MUDANÇAS

| # | O que mudar | Onde |
|---|---|---|
| 1 | `sort((a,b) => a.numero - b.numero)` em vez de sort por nome | `alunosFiltrados.sort(...)` |
| 2 | Agrupar por turma quando `turmaId === '__all__'` com cabeçalho | JSX de renderização |
| 3 | Extrair `renderAluno(a, i)` como função reutilizável | Antes do return JSX |
| 4 | `a.numero \|\| '—'` em vez de `a.numero \|\| i + 1` | Coluna Nº no grid |

---

## RESULTADO ESPERADO

### View de uma turma (ex: Turma da Solange)
```
Nº  Nome                    Situação
1   João Silva              ATIVO
2   Maria Souza             ATIVO
...
24  Pedro Costa             ATIVO
25  Alice Ferreira          ATIVO   ← entrou depois (matrícula mais recente)
```
Alice aparece por último porque o SED atribuiu o Nº 25 a ela (matriculada mais tarde).

### View "Todas as turmas"
```
📚 2ª ETAPA 1º ANO A MANHA — Professora Solange Aparecida   [25 alunos]
  1  João Silva ...
  2  Maria Souza ...
  ...
  25 Alice Ferreira ...

📚 2ª ETAPA 1º ANO B TARDE — Professora Angelita Santos     [22 alunos]
  1  Bruno Lima ...
  ...
```

---

*Prompt gerado pelo CEREBRO — Branch: claude/bold-hamilton-a1Oj6*

# PROMPT — Ordenação pedagógica das turmas
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA — Santo André/SP
**Arquivos-alvo:** `frontend/src/styles.ts` · `frontend/src/pages/Turmas.tsx` · `frontend/src/pages/Alunos.tsx` · `frontend/src/pages/Faltas.tsx`
**Branch:** main

---

## PROBLEMA

As turmas aparecem em ordem **alfabética** (`order('nome')` no Supabase).
O caractere `°` (grau) vem antes de `ª` (ordinal feminino) no Unicode, então
"1° ANO" aparece **antes** de "1ª ETAPA" — o que é pedagogicamente errado.

**Ordem atual (errada):**
```
1° ANO A MANHA ANUAL       ← aparece primeiro, deveria ser último do Fundamental
1° ANO B MANHA ANUAL
...
1ª ETAPA PRÉ-ESCOLA A ...  ← deveria ser PRIMEIRO de tudo
1ª ETAPA PRÉ-ESCOLA B ...
...
2ª ETAPA A                 ← ok, mas só por coincidência
2ª ETAPA B
...
2º ANO A                   ← ok
...
```

---

## ORDEM CORRETA (pedagógica)

```
Grupo 01 — 1ª ETAPA PRÉ-ESCOLA (Ed. Infantil 4 anos)
  1ª ETAPA PRÉ-ESCOLA A MANHA ANUAL  · Prof. Maria Lucia
  1ª ETAPA PRÉ-ESCOLA B MANHA ANUAL  · Prof. Denise
  1ª ETAPA PRÉ-ESCOLA C MANHA ANUAL  · Prof. Fernanda
  1ª ETAPA PRÉ-ESCOLA D MANHA ANUAL  · Prof. Celina
  1ª ETAPA PRÉ-ESCOLA E TARDE ANUAL  · Prof. Debora
  1ª ETAPA PRÉ-ESCOLA F TARDE ANUAL  · Prof. Andressa
  1ª ETAPA PRÉ-ESCOLA G TARDE ANUAL  · Prof. Rosangela
  1ª ETAPA PRÉ-ESCOLA H TARDE ANUAL  · Prof. Adriana Zenoides

Grupo 02 — 2ª ETAPA (Ed. Infantil 5 anos)
  2ª ETAPA A  · Prof. Liliane
  2ª ETAPA B  · Prof. Silvana
  2ª ETAPA C  · Prof. Michele
  2ª ETAPA D  · Prof. Solange
  2ª ETAPA E  · Prof. Sabrina
  2ª ETAPA F  · Prof. Angelita
  2ª ETAPA G  · Prof. Kamila
  2ª ETAPA H  · Prof. Danielle

Grupo 03 — 1° ANO (Ensino Fundamental)
  1° ANO A MANHA ANUAL  · Prof. Roseli Pereira
  1° ANO B MANHA ANUAL  · Prof. Bruna
  1° ANO C TARDE ANUAL  · Prof. Luciany
  1° ANO D TARDE ANUAL  · Prof. Silene
  1° ANO E TARDE ANUAL  · Prof. Bianca

Grupo 04 — 2º ANO
  2º ANO A · Prof. Ione    (Manhã)
  2º ANO B · Prof. Sandra  (Manhã)
  2º ANO C · Prof. Gilmara (Manhã)
  2º ANO D · Prof. Paula   (Tarde)
  2º ANO E · Prof. Marta   (Tarde)

Grupo 05 — 3º ANO
  3º ANO A · Prof. Magnus        (Manhã)
  3º ANO B · Prof. Thabata       (Manhã)
  3º ANO C · Prof. Cátia         (Tarde)
  3º ANO D · Prof. Adriana Caetano (Tarde)

Grupo 06 — 4º ANO
  4º ANO A · Prof. Juliana  (Manhã)
  4º ANO B · Prof. Camila P (Manhã)
  4º ANO C · Prof. Cida Drigo (Tarde)
  4º ANO D · Prof. Karine   (Tarde)

Grupo 07 — 5º ANO
  5º ANO A · Prof. Roseli Zamana (Manhã)
  5º ANO B · Prof. Jessica       (Manhã)
  5º ANO C · Prof. Alessandra    (Tarde)
  5º ANO D · Prof. Raquel        (Tarde)

Grupo 08 — EJA (Educação de Jovens e Adultos)
  EJA I  · Prof. Maria dos Anjos (Noturno)
  EJA II · Prof. Elaine          (Noturno)
```

---

## MUDANÇA 1 — Função `ordemTurma` (adicionar em `styles.ts`)

Adicionar **ao final** de `styles.ts`:

```typescript
// ── Ordenação pedagógica das turmas — EMEIEF Luiz Gonzaga ──────────────────

/**
 * Retorna uma chave de ordenação para o nome de uma turma.
 * Ordem pedagógica: 1ªEtapa → 2ªEtapa → 1ºAno → 2ºAno → ... → 5ºAno → EJA
 *
 * Dentro de cada série: Manhã(1) → Tarde(2) → Noturno(3) → outros(9)
 * Depois: letra da turma (A, B, C, ...)
 */
export function ordemTurma(nome: string): string {
  // Normaliza: sem acento, sem ordinal (ª º °), maiúsculo
  const n = nome.toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ªº°]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ── 1. Grupo pedagógico ───────────────────────────────────────────────────
  let grupo = '99'; // desconhecido → no final
  if      (/\b1\b.*ETAPA/.test(n) || /ETAPA.*\b1\b/.test(n)) grupo = '01';
  else if (/\b2\b.*ETAPA/.test(n) || /ETAPA.*\b2\b/.test(n)) grupo = '02';
  else if (/\b1\b.*ANO/.test(n))   grupo = '03';
  else if (/\b2\b.*ANO/.test(n))   grupo = '04';
  else if (/\b3\b.*ANO/.test(n))   grupo = '05';
  else if (/\b4\b.*ANO/.test(n))   grupo = '06';
  else if (/\b5\b.*ANO/.test(n))   grupo = '07';
  else if (/\bEJA\b/.test(n))      grupo = '08';

  // ── 2. Período ────────────────────────────────────────────────────────────
  let periodo = '9';
  if      (n.includes('MANHA'))    periodo = '1';
  else if (n.includes('TARDE'))    periodo = '2';
  else if (n.includes('NOTURNO'))  periodo = '3';
  else if (n.includes('INTEGRAL')) periodo = '4';

  // ── 3. Letra ou número da turma (A, B, ..., I, II) ───────────────────────
  // Pega a primeira letra isolada que apareça (ex: "A MANHA" → "A")
  const letraM = n.match(/\b([A-HJ-Z])\b/); // exclui I (evita conflito com II do EJA)
  // Para EJA: captura I, II, III
  const ejaM = n.match(/\bEJA\s+(I{1,3}|IV|VI{0,3})\b/);
  const ordem3 = ejaM ? ejaM[1].padStart(3, ' ') : (letraM ? letraM[1] : 'Z');

  return `${grupo}-${periodo}-${ordem3}`;
}

/** Ordena um array de turmas pelo critério pedagógico */
export function sortTurmasPedagogico<T extends { nome: string }>(turmas: T[]): T[] {
  return [...turmas].sort((a, b) =>
    ordemTurma(a.nome).localeCompare(ordemTurma(b.nome))
  );
}
```

---

## MUDANÇA 2 — Aplicar em `Turmas.tsx`

### Import
Adicionar `sortTurmasPedagogico` ao import de `../styles`.

### Ordenar lista
Localizar onde `setTurmas(...)` é chamado após o fetch e aplicar o sort:

```typescript
// Antes:
setTurmas(data || []);

// Depois:
setTurmas(sortTurmasPedagogico(data || []));
```

---

## MUDANÇA 3 — Aplicar em `Alunos.tsx`

### Import
Adicionar `sortTurmasPedagogico, ordemTurma` ao import de `../styles`.

### Dropdown de turmas
Localizar o `<select>` ou lista de opções de turma e substituir o `.map` por:
```typescript
{sortTurmasPedagogico(turmas).map(t => (
  <option key={t.id} value={t.id}>{t.nome}</option>
))}
```

### Grupos em "Todas as turmas"
No bloco que itera sobre os grupos (`for (const [tid, alunos] of grupos)`),
**ordenar as entradas antes de iterar**:

```typescript
// Substituir:
for (const [tid, alunos] of grupos) {

// Por:
const gruposOrdenados = [...grupos.entries()].sort(([tidA], [tidB]) => {
  const nA = turmaMap.get(tidA)?.nome ?? '';
  const nB = turmaMap.get(tidB)?.nome ?? '';
  return ordemTurma(nA).localeCompare(ordemTurma(nB));
});
for (const [tid, alunos] of gruposOrdenados) {
```

---

## MUDANÇA 4 — Aplicar em `Faltas.tsx`

### Import
Adicionar `sortTurmasPedagogico` ao import de `../styles`.

### Dropdown de turmas
```typescript
{sortTurmasPedagogico(turmas).map(t => (
  <option key={t.id} value={t.id}>{t.nome}</option>
))}
```

---

## RESUMO DAS MUDANÇAS

| # | Arquivo | O que fazer |
|---|---|---|
| 1 | `styles.ts` | Adicionar `ordemTurma()` e `sortTurmasPedagogico()` ao final |
| 2 | `Turmas.tsx` | `setTurmas(sortTurmasPedagogico(data))` no fetch |
| 3 | `Alunos.tsx` | Dropdown + grupos "todas as turmas" ordenados |
| 4 | `Faltas.tsx` | Dropdown ordenado |

**Não mexer em `api.ts`** — o `order('nome')` no Supabase continua igual.
O sort pedagógico é feito no **frontend**, após o fetch.

---

*Prompt gerado pelo CEREBRO — Branch: claude/bold-hamilton-a1Oj6*

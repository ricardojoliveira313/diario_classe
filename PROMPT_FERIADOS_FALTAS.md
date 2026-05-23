# PROMPT — Calendário letivo 2026 com feriados reais da escola
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA — Santo André/SP
**Arquivos-alvo:** `frontend/src/pages/Faltas.tsx` + `frontend/src/styles.ts`
**Branch:** main

---

## CONTEXTO

Este prompt usa o **Calendário Escolar Oficial 2026** da unidade.
Todos os feriados, emendas, dias letivos e recesso foram extraídos diretamente
do arquivo `CALENDÁRIO ESCOLAR 2026.xlsx` da escola.

**Município:** Santo André — SP
**Ano letivo começa:** 06/02/2026 (1º dia letivo EMEI/EMEIEF)
**Ano letivo termina:** 22/12/2026

---

## PROBLEMA ATUAL

A grade de faltas mostra colunas `1, 2, 3 ... N` onde N = `DIAS_LETIVOS[mes]` (número fixo).
O professor não sabe qual coluna corresponde a qual data do calendário.
Dias como `1 de Maio (Dia do Trabalhador)` aparecem como dia letivo normal — errado.

---

## SOLUÇÃO — Grade por data real do calendário

Em vez de "N dias letivos anônimos", mostrar **todos os dias do mês (1–31)**:
- Dias letivos → coluna normal com P/F/J/A clicável
- Finais de semana → coluna cinza escuro, bloqueada
- Feriados / emendas → coluna cinza médio com 🎉, bloqueada
- Recesso escolar → coluna azul escuro com 🏖️, bloqueada
- Sábado letivo → coluna normal com 📚 (tem aula)

---

## MUDANÇA 1 — Dias letivos por mês (atualizar `styles.ts`)

Localizar `DIAS_LETIVOS_ANO` e **substituir os valores de 2026** pelos do calendário oficial.
O código atual tem valores errados em Janeiro (4→0), Setembro (22→21), Outubro (18→19) e Novembro (20→19).

```typescript
export const DIAS_LETIVOS_ANO: Record<number, Record<number, number>> = {
  2026: {
    1: 0,   // Janeiro — sem aulas (ano letivo começa 06/02) ← era 4, CORRIGIR
    2: 13,  // Fevereiro (início: 06/02)
    3: 22,  // Março
    4: 18,  // Abril
    5: 20,  // Maio
    6: 21,  // Junho
    7: 9,   // Julho (6 DL até 08/07 + 3 DL a partir de 29/07)
    8: 21,  // Agosto
    9: 21,  // Setembro ← era 22, CORRIGIR
    10: 19, // Outubro  ← era 18, CORRIGIR
    11: 19, // Novembro ← era 20, CORRIGIR
    12: 17, // Dezembro (último dia letivo: 22/12)
    // Total 1º semestre: 100 DL | 2º semestre: 100 DL | Ano: 200 DL
  },
};
```

---

## MUDANÇA 2 — Feriados 2026 reais (adicionar em `styles.ts`)

Adicionar **antes** dos exports existentes:

```typescript
// ── Calendário Escolar 2026 — EMEIEF Luiz Gonzaga — Santo André/SP ────────

/** Feriados fixos que se repetem todo ano (chave: 'MM-DD') */
export const FERIADOS_FIXOS: Record<string, string> = {
  '01-01': 'Ano Novo',
  '04-08': 'Aniversário de Santo André',   // feriado municipal
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalhador',
  '07-09': 'Revolução Constitucionalista (SP)',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '10-13': 'Dia do Professor',             // ponto facultativo escolar
  '10-28': 'Dia do Servidor Público',
  '11-02': 'Dia de Finados',
  '11-20': 'Dia da Consciência Negra',
  '12-25': 'Natal',
};

/** Feriados e emendas móveis por ano (chave: 'MM-DD') */
export const FERIADOS_MOVEIS: Record<number, Record<string, string>> = {
  2026: {
    '02-16': 'Emenda Carnaval',
    '02-17': 'Carnaval',
    '04-03': 'Sexta-feira Santa',
    '04-20': 'Emenda Tiradentes',
    '06-04': 'Corpus Christi',
    '06-05': 'Emenda Corpus Christi',
    '07-10': 'Emenda Revolução Constitucionalista',
  },
};

/** Sábados que são dias letivos (compensação — normalmente livres) */
export const SABADOS_LETIVOS: Record<number, string[]> = {
  2026: [
    '2026-06-27',  // Sábado Letivo (compensação)
    '2026-12-12',  // Sábado Letivo (compensação)
  ],
};

/** Períodos de recesso/férias sem aulas para alunos */
export const RECESSO_ESCOLAR: Record<number, Array<{ inicio: string; fim: string; descricao: string }>> = {
  2026: [
    { inicio: '2026-01-01', fim: '2026-02-05', descricao: 'Férias de verão' },
    { inicio: '2026-07-09', fim: '2026-07-28', descricao: 'Recesso escolar — julho' },
    { inicio: '2026-12-23', fim: '2026-12-31', descricao: 'Recesso de final de ano' },
  ],
};

/** Retorna o nome do feriado para uma data, ou null se dia letivo */
export function getFeriado(ano: number, mes: number, dia: number): string | null {
  const mmdd = String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
  return FERIADOS_FIXOS[mmdd] ?? FERIADOS_MOVEIS[ano]?.[mmdd] ?? null;
}

/** Retorna true se a data está no período de recesso */
export function isRecesso(ano: number, mes: number, dia: number): string | null {
  const data = new Date(ano, mes - 1, dia);
  for (const r of (RECESSO_ESCOLAR[ano] ?? [])) {
    if (data >= new Date(r.inicio) && data <= new Date(r.fim)) return r.descricao;
  }
  return null;
}

/** Retorna true se é sábado letivo (excepcionalmente com aula) */
export function isSabadoLetivo(ano: number, mes: number, dia: number): boolean {
  const s = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  return (SABADOS_LETIVOS[ano] ?? []).includes(s);
}
```

---

## MUDANÇA 3 — Tipo e função de calendário (em `Faltas.tsx`)

Adicionar **no topo de `Faltas.tsx`** (após os imports existentes):

```typescript
import { getFeriado, isRecesso, isSabadoLetivo } from '../styles';

interface CalendarDay {
  dia: number;
  isWeekend: boolean;
  isSabadoLetivo: boolean;   // sábado com aula — letivo mesmo sendo fim de semana
  feriado: string | null;
  recesso: string | null;
  isEmenda: boolean;         // marcado manualmente pelo admin
  isLetivo: boolean;
  schoolIdx: number;         // índice 0-based no array dias[]; -1 se não-letivo
}

function buildCalendarDays(ano: number, mes: number, emendas: string[]): CalendarDay[] {
  const totalDias = new Date(ano, mes, 0).getDate();
  const result: CalendarDay[] = [];
  let schoolIdx = 0;

  for (let d = 1; d <= totalDias; d++) {
    const dw = new Date(ano, mes - 1, d).getDay();
    const weekend = dw === 0 || dw === 6;
    const sabLetivo = isSabadoLetivo(ano, mes, d);
    const feriado = getFeriado(ano, mes, d);
    const recesso = isRecesso(ano, mes, d);
    const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const emenda = emendas.includes(dataStr);
    const letivo = !feriado && !recesso && !emenda && (!weekend || sabLetivo);

    result.push({
      dia: d, isWeekend: weekend, isSabadoLetivo: sabLetivo,
      feriado, recesso, isEmenda: emenda, isLetivo: letivo,
      schoolIdx: letivo ? schoolIdx++ : -1,
    });
  }
  return result;
}
```

---

## MUDANÇA 4 — Import de `useAuth` + estado no componente (em `Faltas.tsx`)

> ⚠️ **ATENÇÃO:** `Faltas.tsx` não importa `useAuth` atualmente. O `role` é necessário
> para controlar quem pode marcar emendas. Adicionar **obrigatoriamente**.

**Adicionar** no bloco de imports no topo de `Faltas.tsx`:
```typescript
import { useAuth } from '../AuthContext';
```

**Adicionar** dentro do componente, junto com os outros hooks (useTheme, useAno...):
```typescript
const { role } = useAuth();
```

---

**Substituir** a linha `const numDias = DIAS_LETIVOS[mes] ?? 22;` por:

```typescript
// Emendas manuais do admin (persistidas no localStorage por ano)
const EMENDAS_KEY = `emendas-${ano}`;
const [emendas, setEmendas] = useState<string[]>(() => {
  try { return JSON.parse(localStorage.getItem(EMENDAS_KEY) || '[]'); }
  catch { return []; }
});
const toggleEmenda = (dataStr: string) => {
  if (role !== 'admin') return;
  setEmendas(prev => {
    const next = prev.includes(dataStr)
      ? prev.filter(d => d !== dataStr)
      : [...prev, dataStr];
    localStorage.setItem(EMENDAS_KEY, JSON.stringify(next));
    return next;
  });
};

const calDays = useMemo(() => buildCalendarDays(ano, mes, emendas), [ano, mes, emendas]);
const numDias = useMemo(() => calDays.filter(d => d.isLetivo).length, [calDays]);
```

---

## MUDANÇA 5 — Cabeçalho da grade (em `Faltas.tsx`)

**Substituir** `{Array(numDias).fill(0).map((_, d) => (<th key={d}>{d+1}</th>))}` por:

```typescript
{calDays.map(cd => {
  const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(cd.dia).padStart(2,'0')}`;
  const naoLetivo = !cd.isLetivo;
  const bg = cd.isWeekend && !cd.isSabadoLetivo ? '#374151'
           : cd.recesso ? '#1e3a5f'
           : naoLetivo ? '#4b5563'
           : undefined;

  const tooltip =
    cd.feriado ?? (cd.isEmenda ? '⛔ Emenda marcada' : null) ??
    cd.recesso ?? (cd.isSabadoLetivo ? '📚 Sábado Letivo' : null) ??
    (cd.isWeekend ? 'Final de semana' : `Dia ${cd.dia}`);

  return (
    <th key={cd.dia} title={tooltip}
      onClick={
        role === 'admin' && !cd.isWeekend && !cd.feriado && !cd.recesso
          ? () => toggleEmenda(dataStr) : undefined
      }
      style={{
        width: isMobile ? 38 : 24, textAlign: 'center',
        fontSize: isMobile ? 9 : 10, padding: '6px 1px',
        fontWeight: 600, background: bg, lineHeight: 1.2,
        opacity: naoLetivo ? 0.55 : 1,
        cursor: role === 'admin' && !cd.isWeekend && !cd.feriado && !cd.recesso
          ? 'pointer' : 'default',
      }}
    >
      <div>{cd.dia}</div>
      {cd.feriado && <div style={{ fontSize: 7 }}>🎉</div>}
      {!cd.feriado && cd.recesso && <div style={{ fontSize: 7 }}>🏖️</div>}
      {cd.isEmenda && <div style={{ fontSize: 7 }}>⛔</div>}
      {cd.isSabadoLetivo && <div style={{ fontSize: 7 }}>📚</div>}
    </th>
  );
})}
```

---

## MUDANÇA 6 — Células de frequência por aluno (em `Faltas.tsx`)

**Substituir** `{dias.map((status, d) => (<td key={d} onClick={() => toggleDia(a.id, d)}...>))}` por:

```typescript
{calDays.map(cd => {
  if (!cd.isLetivo) {
    const bg = cd.recesso ? '#1a2f4a' : cd.isWeekend ? '#1f2937' : '#283548';
    return <td key={cd.dia} style={{
      width: isMobile ? 38 : 24, background: bg,
      borderLeft: '1px solid var(--border-light)',
    }} />;
  }
  const status = dias[cd.schoolIdx] ?? 'P';
  return (
    <td key={cd.dia}
      onClick={() => toggleDia(a.id, cd.schoolIdx)}
      title={`Dia ${cd.dia}: ${ST_LABEL[status]}${cd.isSabadoLetivo ? ' (Sábado Letivo)' : ''}`}
      style={{
        width: isMobile ? 38 : 24, textAlign: 'center', cursor: 'pointer',
        background: ST_BG[status], color: ST_COR[status],
        fontWeight: 700, fontSize: isMobile ? 13 : 11,
        padding: isMobile ? '12px 0' : '7px 0',
        borderLeft: '1px solid var(--border-light)',
        userSelect: 'none', transition: 'opacity 0.1s', touchAction: 'manipulation',
      }}
      onMouseEnter={!isMobile ? (e => (e.currentTarget.style.opacity = '0.75')) : undefined}
      onMouseLeave={!isMobile ? (e => (e.currentTarget.style.opacity = '1')) : undefined}
    >
      {status}
    </td>
  );
})}
```

---

## MUDANÇA 7 — Legenda (adicionar ao final da barra de legendas)

```typescript
<span style={{ fontSize: 11, color: theme.textMuted }}>
  · 🎉 Feriado &nbsp; 🏖️ Recesso
</span>
{role === 'admin' && (
  <span style={{ fontSize: 11, color: '#f97316' }}>
    · Admin: clique no Nº do dia para marcar/desmarcar emenda ⛔
  </span>
)}
```

---

## NOTA SOBRE AS FUNÇÕES DE EXPORT (PDF, Excel, Folha OCR, Grade)

As funções de export **não precisam ser alteradas**. Elas já usam:
```typescript
const diasNoMes = new Date(ano, mes, 0).getDate(); // total de dias do mês
const diasCols = Array.from({ length: diasNoMes }, (_, i) => { ... });
```
Ou seja, já trabalham com todos os dias do mês — não dependem de `numDias`.

O `numDias` dinâmico calculado pelo `calDays` afeta apenas:
- O cabeçalho interativo da grade (substituído pelo `calDays.map`)
- Os totais exibidos (Dias Letivos: N) — agora calculados corretamente
- O tamanho dos arrays `dias[]` para alunos novos (`initDias(numDias)`)

> **Alunos com dados existentes no banco:** o `decodeDias(frequencia, numDias)` pode ter
> diferença de 1 dia nos meses onde o DL foi corrigido (Set, Out, Nov). Isso é aceitável
> como correção de dado — não há perda de informação, apenas ajuste de tamanho do array.

---

## RESUMO — Comportamento por tipo de dia

| Tipo | Visual (header) | Célula do aluno |
|---|---|---|
| Dia letivo normal | azul (padrão) | P/F/J/A clicável |
| Sábado letivo 📚 | azul com 📚 | P/F/J/A clicável |
| Final de semana | cinza escuro | bloqueada (vazia) |
| Feriado 🎉 | cinza médio com 🎉 | bloqueada (vazia) |
| Recesso 🏖️ | azul escuro com 🏖️ | bloqueada (vazia) |
| Emenda manual ⛔ | cinza médio com ⛔ | bloqueada (vazia) |

---

## CALENDÁRIO 2026 — Todos os feriados e datas especiais

| Data | Dia | Descrição | Tipo |
|---|---|---|---|
| 01/01 | qui | Ano Novo | Nacional |
| 16/02 | seg | Emenda Carnaval | Emenda |
| 17/02 | ter | Carnaval | Nacional |
| 03/04 | sex | Sexta-feira Santa | Nacional |
| 08/04 | qua | **Aniversário de Santo André** | **Municipal** |
| 20/04 | seg | Emenda Tiradentes | Emenda |
| 21/04 | ter | Tiradentes | Nacional |
| 01/05 | sex | Dia do Trabalhador | Nacional |
| 04/06 | qui | Corpus Christi | Nacional |
| 05/06 | sex | Emenda Corpus Christi | Emenda |
| 27/06 | sab | **Sábado Letivo** 📚 | Especial |
| 09/07 | qui | Revolução Constitucionalista (SP) | Estadual |
| 10/07 | sex | Emenda Revolução Const. | Emenda |
| 09/07–28/07 | — | **Recesso escolar (férias julho)** 🏖️ | Recesso |
| 07/09 | seg | Independência do Brasil | Nacional |
| 12/10 | seg | Nossa Senhora Aparecida | Nacional |
| 13/10 | ter | Dia do Professor | Ponto facultativo |
| 28/10 | qua | Dia do Servidor Público | Ponto facultativo |
| 02/11 | seg | Dia de Finados | Nacional |
| 15/11 | dom | Proclamação da República | Nacional |
| 20/11 | sex | Dia da Consciência Negra | Nacional |
| 12/12 | sab | **Sábado Letivo** 📚 | Especial |
| 25/12 | sex | Natal | Nacional |

---

*Prompt gerado pelo CEREBRO com base no CALENDÁRIO ESCOLAR 2026 oficial.*
*Fonte: `CALENDÁRIO ESCOLAR 2026.xlsx` da unidade.*
*Branch: claude/bold-hamilton-a1Oj6*

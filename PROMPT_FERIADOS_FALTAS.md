# PROMPT — Calendário letivo com feriados e emendas na grade de Faltas
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA
**Arquivos-alvo:** `frontend/src/pages/Faltas.tsx` + `frontend/src/styles.ts`
**Branch:** main

---

## CONTEXTO E PROBLEMA

A grade de faltas hoje mostra colunas numeradas `1, 2, 3 ... N` onde N = `DIAS_LETIVOS[mes]`
(número fixo de dias letivos por mês). Esse número é calculado sem levar em conta feriados.

O resultado: **o professor não sabe qual número corresponde a qual data do calendário**,
e dias como `1 de Maio (Dia do Trabalhador)` aparecem como dia letivo normal — o que é errado.

---

## SOLUÇÃO — Grade por data real do calendário

Em vez de mostrar "1, 2, 3 ... 20 dias letivos", mostrar **todos os dias do mês (1–31)**:
- Dias letivos normais → coluna normal com P/F/J/A clicável
- Finais de semana → coluna cinza escuro, sem P, sem clique
- Feriados / emendas → coluna cinza claro com ícone 🎉, sem P, sem clique

---

## MUDANÇA 1 — Lista de feriados nacionais + estaduais SP

**Em `frontend/src/styles.ts`**, adicionar antes do export:

```typescript
// ── Feriados nacionais + estaduais SP (2025–2027) ─────────────────────────
// Formato: 'MM-DD' (independente do ano) ou 'AAAA-MM-DD' (data fixa)
export const FERIADOS_FIXOS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalhador',
  '07-09': 'Revolução Constitucionalista (SP)',
  '09-07': 'Independência do Brasil',
  '10-12': 'N. Sra. Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Consciência Negra',
  '12-25': 'Natal',
};

// Feriados móveis por ano (Carnaval, Sexta-feira Santa, Corpus Christi)
export const FERIADOS_MOVEIS: Record<number, Record<string, string>> = {
  2025: {
    '03-03': 'Carnaval', '03-04': 'Carnaval',
    '04-18': 'Sexta-feira Santa',
    '06-19': 'Corpus Christi',
  },
  2026: {
    '02-16': 'Carnaval', '02-17': 'Carnaval',
    '04-03': 'Sexta-feira Santa',
    '06-04': 'Corpus Christi',  // ← ajustar se necessário
  },
  2027: {
    '03-01': 'Carnaval', '03-02': 'Carnaval',
    '03-26': 'Sexta-feira Santa',
    '05-13': 'Corpus Christi',
  },
};

// Retorna o nome do feriado para uma data, ou null se não for feriado
export function getFeriado(ano: number, mes: number, dia: number): string | null {
  const mmdd = String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
  return FERIADOS_FIXOS[mmdd]
    ?? FERIADOS_MOVEIS[ano]?.[mmdd]
    ?? null;
}
```

---

## MUDANÇA 2 — Tipo CalendarDay e função getCalendarDays

**Em `frontend/src/pages/Faltas.tsx`**, adicionar no topo (após imports, antes do componente):

```typescript
import { FERIADOS_FIXOS, FERIADOS_MOVEIS, getFeriado } from '../styles';

// Um dia do calendário do mês
interface CalendarDay {
  dia: number;          // 1–31
  isWeekend: boolean;   // sábado ou domingo
  feriado: string | null; // nome do feriado, ou null
  isEmenda: boolean;    // marcado manualmente como emenda pelo admin
  isLetivo: boolean;    // = !isWeekend && !feriado && !isEmenda
  schoolIdx: number;    // índice dentro dos dias letivos (0-based); -1 se não-letivo
}

function buildCalendarDays(
  ano: number,
  mes: number,
  emendas: string[]  // array de 'AAAA-MM-DD'
): CalendarDay[] {
  const totalDias = new Date(ano, mes, 0).getDate();
  const days: CalendarDay[] = [];
  let schoolIdx = 0;
  for (let d = 1; d <= totalDias; d++) {
    const date = new Date(ano, mes - 1, d);
    const dw = date.getDay();
    const isWeekend = dw === 0 || dw === 6;
    const feriado = getFeriado(ano, mes, d);
    const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isEmenda = emendas.includes(dataStr);
    const isLetivo = !isWeekend && !feriado && !isEmenda;
    days.push({ dia: d, isWeekend, feriado, isEmenda, isLetivo, schoolIdx: isLetivo ? schoolIdx++ : -1 });
  }
  return days;
}
```

---

## MUDANÇA 3 — Estado de emendas (localStorage + admin)

**No componente `FaltasPage`**, adicionar estado:

```typescript
// Chave: 'emendas-AAAA' → JSON array de 'AAAA-MM-DD'
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

// Recalcular dias do calendário sempre que mes/ano/emendas mudar
const calDays = useMemo(
  () => buildCalendarDays(ano, mes, emendas),
  [ano, mes, emendas]
);

// numDias = total de dias letivos do mês (calculado dinamicamente)
const numDias = useMemo(() => calDays.filter(d => d.isLetivo).length, [calDays]);
```

> **ATENÇÃO:** Remover a linha `const numDias = DIAS_LETIVOS[mes] ?? 22;` e usar o `numDias`
> calculado acima. Também remover a importação de `DIAS_LETIVOS` de `../styles` se não usada em outro lugar.

---

## MUDANÇA 4 — Grid com colunas por data real

### 4a — Cabeçalho (header das colunas)

Substituir:
```typescript
{Array(numDias).fill(0).map((_, d) => (
  <th key={d} style={{ ... }}>
    {d + 1}
  </th>
))}
```

Por:
```typescript
{calDays.map(cd => {
  const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(cd.dia).padStart(2,'0')}`;
  const bgHeader = cd.isWeekend
    ? '#374151'               // cinza escuro — fim de semana
    : cd.feriado || cd.isEmenda
      ? '#4b5563'             // cinza médio — feriado / emenda
      : undefined;            // padrão azul do thead
  return (
    <th
      key={cd.dia}
      title={cd.feriado ?? (cd.isEmenda ? 'Emenda' : cd.isWeekend ? 'Final de semana' : `Dia ${cd.dia}`)}
      onClick={role === 'admin' && !cd.isWeekend && !cd.feriado ? () => toggleEmenda(dataStr) : undefined}
      style={{
        width: isMobile ? 38 : 24,
        textAlign: 'center',
        fontSize: isMobile ? 9 : 10,
        padding: '8px 1px',
        fontWeight: 600,
        background: bgHeader,
        cursor: role === 'admin' && !cd.isWeekend && !cd.feriado ? 'pointer' : 'default',
        opacity: cd.isWeekend || cd.feriado || cd.isEmenda ? 0.6 : 1,
      }}
    >
      {cd.dia}
      {(cd.feriado || cd.isEmenda) && <div style={{ fontSize: 7, lineHeight: 1 }}>🎉</div>}
      {cd.isWeekend && <div style={{ fontSize: 7, lineHeight: 1 }}>—</div>}
    </th>
  );
})}
```

> **Comportamento:** Admin pode **clicar** no cabeçalho de um dia normal para marcá-lo como
> emenda (toggle). Dias de feriado fixo e fins de semana não são clicáveis.

### 4b — Células de frequência por aluno

Substituir:
```typescript
{dias.map((status, d) => (
  <td key={d}
    onClick={() => toggleDia(a.id, d)}
    ...
  >
    {status}
  </td>
))}
```

Por:
```typescript
{calDays.map(cd => {
  if (!cd.isLetivo) {
    // Dia não letivo: cinza, sem clique
    const bgCell = cd.isWeekend ? '#1f2937' : '#283548';
    return (
      <td key={cd.dia} style={{
        width: isMobile ? 38 : 24,
        background: bgCell,
        borderLeft: '1px solid var(--border-light)',
      }} />
    );
  }
  const status = dias[cd.schoolIdx] ?? 'P';
  return (
    <td key={cd.dia}
      onClick={() => toggleDia(a.id, cd.schoolIdx)}
      title={`Dia ${cd.dia}: ${ST_LABEL[status]} — clique para alternar`}
      style={{
        width: isMobile ? 38 : 24,
        textAlign: 'center', cursor: 'pointer',
        background: ST_BG[status],
        color: ST_COR[status],
        fontWeight: 700,
        fontSize: isMobile ? 13 : 11,
        padding: isMobile ? '12px 0' : '7px 0',
        borderLeft: '1px solid var(--border-light)',
        userSelect: 'none',
        transition: 'opacity 0.1s',
        touchAction: 'manipulation',
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

## MUDANÇA 5 — Legenda de emendas

Na barra de legendas (onde está `P = Presença`, `F = Falta`...), adicionar ao final:

```typescript
{role === 'admin' && (
  <span style={{ fontSize: 11, color: theme.textSecondary, marginLeft: 8 }}>
    · Admin: clique no número do dia para marcar/desmarcar emenda
  </span>
)}
```

---

## RESULTADO ESPERADO

### Grade — Maio 2026

```
# Aluno   | 1  | 2  | 3  | 4  | 5  | ... | 31 |
          |🎉  |——  |——  | P  | P  | ... | —— |
          |feri|sáb |dom |seg |ter |     |dom |
Alice     | ▓▓ | ▓▓ | ▓▓ | P  | P  | ... | ▓▓ |
João      | ▓▓ | ▓▓ | ▓▓ | P  | F  | ... | ▓▓ |
```

- Dia 1 (1º de Maio) → coluna cinza com 🎉, sem P/F/J/A
- Dias 2–3 (fim de semana) → coluna escura com —, sem P/F/J/A
- Dias 4+ (letivos) → P/F/J/A normais
- "Dias Letivos: 20" calculado automaticamente (20 dias letivos em Maio 2026)

---

## RESUMO DAS MUDANÇAS

| # | O que fazer | Onde |
|---|---|---|
| 1 | Adicionar `FERIADOS_FIXOS`, `FERIADOS_MOVEIS`, `getFeriado()` | `styles.ts` |
| 2 | Adicionar `CalendarDay`, `buildCalendarDays()` | `Faltas.tsx` |
| 3 | Adicionar estado `emendas` + `toggleEmenda` + `calDays` + recalcular `numDias` | `Faltas.tsx` componente |
| 4 | Trocar colunas do cabeçalho: usar `calDays` em vez de `Array(numDias)` | `Faltas.tsx` JSX header |
| 5 | Trocar células: dias não-letivos → cinza sem clique; letivos → P/F/J/A normal | `Faltas.tsx` JSX tbody |
| 6 | Adicionar legenda de emenda para admin | `Faltas.tsx` JSX legenda |

---

*Prompt gerado pelo CEREBRO — Branch: claude/bold-hamilton-a1Oj6*

# PROMPT — FOLHA OCR DIÁRIA (Tesseract.js)
## Grade de dias com marcação X + leitura automática de faltas

> **VOCÊ É O EXECUTOR. Leia tudo antes de tocar em qualquer arquivo.**
> Este documento é a versão CORRIGIDA do prompt original.
> Três problemas críticos foram identificados e já estão resolvidos aqui.

---

## ESTADO REAL DO CÓDIGO (confirmado pelo responsável Ricardo)

> **Botões existentes na tela Faltas:** `🖨️ Diário` · `📊 Excel` · `📄 PDF`
> **NÃO EXISTE** o botão `📋 Folha OCR` nem a função `exportarFolhaOCR()`
> As ações abaixo são todas de **CRIAÇÃO**, não de substituição.

### Correções em relação ao prompt original que foi apresentado:

### ✅ Correção #1: Usar X (faltou) em vez de P/F/J/A por célula
O Tesseract.js foi treinado para texto impresso. Letras soltas escritas à mão em caixinhas de 22px são irreconhecíveis:
- "F" → lido como "E", "P", "7" ou "T"
- "J" → lido como "I", "1", "l"
- "P" → lido como "D", "R", "B"
- "A" → lido como "4", "H", "^"

**Solução:** A professora escreve apenas **X** nos dias que o aluno **FALTOU**. Célula vazia = PRESENTE. O OCR detecta presença ou ausência de marca (muito mais confiável). J e A podem ser diferenciados manualmente na tela de revisão.

### ✅ Correção #2: `OCR.tsx` não existe — usar `Professor.tsx`
O arquivo `frontend/src/pages/OCR.tsx` não existe. A funcionalidade de OCR está em `frontend/src/pages/Professor.tsx`. A nova funcionalidade deve ser adicionada ao `Professor.tsx` como um terceiro modo: `'folha'`.

### ✅ Correção #3: `exportarFolhaOCR()` não existe — CRIAR do zero
A função e o botão NÃO existem na versão atual do código deployado. A ação correta é **CRIAR** a função e **ADICIONAR** o botão ao lado dos botões existentes (`🖨️ Diário`, `📊 Excel`, `📄 PDF`).

---

## 1. VISÃO GERAL

**Sistema:** Diário de Classe Digital — EMEIEF LUIZ GONZAGA  
**URL:** https://diario.jroapp.com.br  
**Ferramenta OCR:** Tesseract.js (gratuito, 100% local, sem internet)  
**Objetivo:** Folha imprimível com grade de dias vazios → professora escreve **X** nos dias de falta → tira foto → sistema lê automaticamente e salva como `DIAS:PPFP...`.

### Fluxo completo:
```
1. Abrir /faltas → turma + mês
2. Clicar 📋 Folha OCR → imprimir folha com grade VAZIA
3. Professora preenche: escreve X nos dias de falta (nada = presente)
4. Tira foto da folha
5. Abrir /professor → modo 📋 Folha OCR
6. Fazer upload da foto → Tesseract detecta Xs
7. Revisar na tela (corrigir se necessário, marcar J ou A nos casos de justificativa)
8. Salvar → sistema grava DIAS:PPFPPPFP... para cada aluno
9. Abrir /faltas → grade já mostra os dias preenchidos
```

---

## 2. ESTADO ATUAL (antes das alterações)

### `frontend/src/pages/Faltas.tsx`
- Botões existentes: `🖨️ Diário`, `📊 Excel`, `📄 PDF`
- `exportarFolhaOCR()` **NÃO EXISTE** — precisa ser criada
- Botão `📋 Folha OCR` **NÃO EXISTE** — precisa ser adicionado ao grupo de botões
- **Ação: CRIAR** a função e ADICIONAR o botão

### `frontend/src/pages/Professor.tsx`
- Estado `modo` com valores `'manual'` e `'foto'`
- Modo `'foto'` faz OCR via Google Vision API → resultado vai para tabela `Pendente`
- **Ação: ADICIONAR** terceiro modo `'folha'` para leitura da grade de dias com Tesseract.js

---

## 3. PASSO 1 — CRIAR `exportarFolhaOCR()` em `Faltas.tsx` e ADICIONAR botão

**Arquivo:** `frontend/src/pages/Faltas.tsx`  
**Ação 1:** Localizar a função `exportarDiario()` (para referência de posição) e **INSERIR a nova função `exportarFolhaOCR()` ANTES dela**.  
**Ação 2:** Localizar o grupo de botões `🖨️ Diário` / `📊 Excel` / `📄 PDF` e **ADICIONAR o botão `📋 Folha OCR` ao lado deles**.

### Botão a adicionar (inserir ao lado dos botões existentes):
```tsx
<button
  onClick={exportarFolhaOCR}
  style={btn('primary', { small: true, outline: true })}
  title="Folha com grade de dias — professora escreve X nos dias de falta — fotografa para OCR">
  📋 Folha OCR
</button>
```

```typescript
// ── Folha OCR — Grade de Dias (A4 paisagem, células VAZIAS) ──────────────────
const exportarFolhaOCR = () => {
  const turmaObj = turmas.find(t => t.id === turmaId);
  const nomeMes = MESES[mes - 1];
  const diasNoMes = new Date(ano, mes, 0).getDate();

  // Colunas: apenas dias úteis (segunda a sexta)
  // Para simplificar OCR: incluir TODOS os dias 1 a diasNoMes, marcar fins de semana em cinza
  const diasCols = Array.from({ length: diasNoMes }, (_, i) => {
    const date = new Date(ano, mes - 1, i + 1);
    const dw = date.getDay();
    return { dia: i + 1, isWeekend: dw === 0 || dw === 6 };
  });

  const headerDias = diasCols.map(d =>
    `<th style="
      border:1px solid #94a3b8;
      padding:0; width:22px; min-width:22px; max-width:22px;
      font-size:8px; font-weight:700; text-align:center; height:30px;
      vertical-align:middle;
      background:${d.isWeekend ? '#475569' : '#1e40af'};
      color:${d.isWeekend ? '#94a3b8' : '#ffffff'};
    ">${d.dia}</th>`
  ).join('');

  const linhas = alunos.map((a, i) => {
    const defi = a.deficiencia ? ' ♿' : '';
    const bf = a.bolsa_familia ? ' 💚' : '';
    const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const celulas = diasCols.map(d =>
      `<td style="
        border:1px solid ${d.isWeekend ? '#94a3b8' : '#cbd5e1'};
        width:22px; min-width:22px; max-width:22px;
        height:22px; text-align:center; vertical-align:middle;
        font-size:14px; font-weight:900;
        background:${d.isWeekend ? '#f1f5f9' : rowBg};
        color:#dc2626;
      "></td>`
    ).join('');
    return `<tr>
      <td style="border:1px solid #cbd5e1;padding:3px 5px;font-size:11px;text-align:center;width:26px;font-weight:700;">${String(a.numero || i + 1).padStart(2, '0')}</td>
      <td style="border:1px solid #cbd5e1;padding:3px 7px;font-size:11px;white-space:nowrap;font-weight:${bf ? '700' : '400'};">${a.nome}${defi}${bf}</td>
      ${celulas}
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Folha OCR — ${turmaObj?.nome ?? ''} — ${nomeMes} ${ano}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 6mm; font-size: 11px; color: #000; background: #fff; }
  table { border-collapse: collapse; }
  @media print {
    @page { size: A4 landscape; margin: 7mm 6mm; }
    body { margin: 0; }
  }
</style>
</head>
<body>

<!-- CABEÇALHO -->
<div style="text-align:center; border-bottom:2px solid #1e40af; padding-bottom:6px; margin-bottom:8px;">
  <div style="font-size:9px; color:#64748b; font-weight:600; letter-spacing:0.5px;">PREFEITURA MUNICIPAL DE SANTO ANDRÉ</div>
  <div style="font-size:16px; font-weight:900; color:#1e40af; margin:1px 0;">EMEIEF LUIZ GONZAGA</div>
  <div style="font-size:9px; color:#475569; font-weight:600;">Folha de Frequência Diária — ${nomeMes.toUpperCase()} / ${ano}</div>
</div>

<!-- INFO TURMA -->
<table style="width:100%; border:none; margin-bottom:7px;">
  <tr>
    <td style="border:none; padding:2px 0; font-size:10px;">
      <b style="color:#475569;">TURMA:</b>
      <span style="font-size:13px; font-weight:900; color:#1e40af; margin-left:5px;">${turmaObj?.nome ?? '—'}</span>
    </td>
    <td style="border:none; padding:2px 0; font-size:10px; text-align:center;">
      <b style="color:#475569;">PROFESSORA:</b>
      <span style="font-weight:700; margin-left:5px;">${turmaObj?.professora ?? '—'}</span>
    </td>
    <td style="border:none; padding:2px 0; font-size:10px; text-align:right;">
      <b style="color:#475569;">Alunos:</b> ${alunos.length}
      &nbsp;&nbsp;
      <b style="color:#475569;">Dias letivos:</b> ${numDias}
    </td>
  </tr>
</table>

<!-- INSTRUÇÃO -->
<div style="font-size:9px; padding:4px 8px; background:#fef3c7; border:1px solid #fbbf24; border-radius:4px; margin-bottom:6px; color:#92400e; font-weight:700;">
  ✏️ INSTRUÇÕES: Escreva <strong>X</strong> somente nos dias em que o aluno <strong>FALTOU</strong>.
  Células vazias = presente. Para falta justificada escreva <strong>J</strong>, para atestado escreva <strong>A</strong>.
  Fins de semana estão em cinza — não preencher.
</div>

<!-- GRADE DE DIAS -->
<table style="width:100%;">
  <thead>
    <tr style="height:30px;">
      <th style="border:1px solid #94a3b8;padding:2px;font-size:9px;text-align:center;width:26px;background:#0f172a;color:#ffffff;">Nº</th>
      <th style="border:1px solid #94a3b8;padding:2px 6px;font-size:9px;text-align:left;min-width:140px;background:#0f172a;color:#ffffff;">NOME DO ALUNO</th>
      ${headerDias}
    </tr>
  </thead>
  <tbody>
    ${linhas}
  </tbody>
</table>

<!-- LEGENDA + ASSINATURA -->
<div style="margin-top:6mm; display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:8mm;">
  <div style="font-size:9px; color:#475569;">
    <b>Legenda:</b>
    <span style="margin-left:6px; background:#fee2e2; padding:1px 5px; border-radius:3px; font-weight:900; color:#dc2626;">X</span> = Falta
    <span style="margin-left:6px; background:#ffedd5; padding:1px 5px; border-radius:3px; font-weight:900; color:#d97706;">J</span> = Justificada
    <span style="margin-left:6px; background:#ede9fe; padding:1px 5px; border-radius:3px; font-weight:900; color:#7c3aed;">A</span> = Atestado
    <span style="margin-left:6px; background:#f1f5f9; padding:1px 5px; border-radius:3px; color:#475569;">■■</span> = Fim de semana (não preencher)
  </div>
  <div style="font-size:10px; display:flex; gap:14mm;">
    <span>Assinatura do(a) Professor(a): _________________________</span>
    <span>Data: ___/___/______</span>
  </div>
</div>

<script>setTimeout(()=>window.print(),400);</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Permita pop-ups para abrir a folha.'); return; }
  win.document.write(html);
  win.document.close();
};
```

### Resultado visual esperado:
- Grade A4 paisagem com 31 colunas de dias (22px cada)
- Cabeçalho azul escuro com Nº e NOME
- Dias da semana: azul (#1e40af), fins de semana: cinza escuro (#475569)
- Células completamente VAZIAS para a professora preencher à mão
- Instrução clara em amarelo: escreva X nos dias de falta
- Legenda e assinatura no rodapé

---

## 4. PASSO 2 — Adicionar modo `'folha'` em `Professor.tsx`

**Arquivo:** `frontend/src/pages/Professor.tsx`  
**Ação:** Adicionar terceiro modo ao toggle existente e implementar lógica de OCR da grade.

### 4a — Adicionar `'folha'` ao tipo do estado `modo`

Localizar:
```typescript
const [modo, setModo] = useState<'manual' | 'foto'>('manual');
```

Substituir por:
```typescript
const [modo, setModo] = useState<'manual' | 'foto' | 'folha'>('manual');
```

---

### 4b — Adicionar terceiro botão no toggle de modo

Localizar o bloco do toggle (os dois botões `✏️ Digitar` e `📷 Via Foto`).

**Adicionar terceiro botão DEPOIS do `📷 Via Foto`:**
```tsx
<button
  onClick={() => setModo('folha')}
  style={{
    flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
    borderRadius: 8, fontWeight: 700, fontSize: 13,
    background: modo === 'folha' ? '#ffffff' : 'transparent',
    color: modo === 'folha' ? '#1e40af' : theme.textSecondary,
    boxShadow: modo === 'folha' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
    transition: 'all 0.15s ease',
  }}>
  📋 Folha OCR
</button>
```

---

### 4c — Adicionar estados para o modo `'folha'`

Junto dos outros estados no componente `Professor`, adicionar:
```typescript
// Estados modo folha OCR
const [folhaImagem, setFolhaImagem] = useState<string | null>(null);
const [folhaResultados, setFolhaResultados] = useState<Array<{
  numero: number;
  nome: string;
  dias: Array<'P' | 'F' | 'J' | 'A'>;
}>>([]);
const [folhaOcrStatus, setFolhaOcrStatus] = useState('');
const [folhaOcrProgresso, setFolhaOcrProgresso] = useState(0);
const [folhaSalvo, setFolhaSalvo] = useState(false);
const folhaFileRef = useRef<HTMLInputElement>(null);
```

---

### 4d — Adicionar interface para resultado da folha

No topo do arquivo, junto das outras interfaces/tipos:
```typescript
interface AlunoFolhaDia {
  numero: number;
  nome: string;
  dias: Array<'P' | 'F' | 'J' | 'A'>;
}
```

---

### 4e — Adicionar função `parsearGradeOCR()`

Inserir junto das outras funções, antes do `return` do componente:

```typescript
// Parser para grade dia a dia
// Estratégia: Tesseract retorna texto linha a linha
// A professora escreveu X nos dias de falta (vazio = presente, J = justificada, A = atestado)
// Tesseract verá: "01 ALANNA FERREIRA     X        X    X"
// Capturamos o nº, o nome (maiúsculas), e a sequência de caracteres
// Mapeamos cada caractere:
//   X, x, *, ×, + → 'F' (faltou)
//   J, j           → 'J' (justificada)
//   A, a, @        → 'A' (atestado)
//   tudo mais      → 'P' (presente)

const parsearGradeOCR = (texto: string, numDiasEsperado: number): AlunoFolhaDia[] => {
  const resultados: AlunoFolhaDia[] = [];
  const numerosVistos = new Set<number>();

  for (const linhaRaw of texto.split('\n')) {
    const linha = linhaRaw.trim();
    if (!linha || linha.length < 8) continue;

    // Ignorar linhas de cabeçalho, rodapé, instrução
    if (/^(nº|nome|aluno|prof|turma|série|serie|mês|mes|escola|data|total|freq|emei|legenda|presença|falta|justif|atestado|instrução|instrucao|prefeitura|assinatura|x\s*=|j\s*=|a\s*=)/i.test(linha)) continue;

    // Tenta capturar: Nº (1-2 dígitos) + espaços + NOME (maiúsculas) + espaços + conteúdo de células
    // Formato esperado: "01 ALANNA EMANUELLY FERREIRA DE SOUZA   X     X   J"
    // Regex: início da linha, Nº, espaços, nome em maiúsculas, resto
    const m = linha.match(/^(\d{1,2})\.?\s{1,4}([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ\s'-]{5,55}?)\s{2,}(.{3,})$/);
    if (!m) continue;

    const num = parseInt(m[1]);
    if (numerosVistos.has(num)) continue;
    numerosVistos.add(num);

    const nome = m[2].trim();
    const celulasRaw = m[3];

    // Extrair marcações: X/J/A/espaço — cada token separado por espaço ou por posição fixa de ~22px
    // Tesseract separa células por espaços; mapeamos cada token não-espaço
    const tokens = celulasRaw.split(/\s+/).filter(t => t.length > 0);

    const dias: Array<'P' | 'F' | 'J' | 'A'> = [];
    for (const tok of tokens) {
      const c = tok[0].toUpperCase();
      if (c === 'X' || c === '*' || c === '+' || tok === '×') {
        dias.push('F');
      } else if (c === 'J') {
        dias.push('J');
      } else if (c === 'A' || c === '@') {
        dias.push('A');
      } else if (c === ' ' || c === '-' || c === '_' || c === '.' || c === '0') {
        dias.push('P'); // vazio ou ponto = presente
      }
      // Ignora dígitos e caracteres não reconhecidos (são artefatos OCR de células vazias)
    }

    // Preenche com P até numDiasEsperado se leu menos dias
    while (dias.length < numDiasEsperado) dias.push('P');

    // Trunca se leu mais que o esperado
    const diasFinal = dias.slice(0, numDiasEsperado) as Array<'P' | 'F' | 'J' | 'A'>;

    if (nome.length >= 5 && diasFinal.length >= 3) {
      resultados.push({ numero: num, nome, dias: diasFinal });
    }
  }

  return resultados.sort((a, b) => a.numero - b.numero);
};
```

---

### 4f — Adicionar função `analisarFolha()` com Tesseract.js

```typescript
const analisarFolha = async () => {
  if (!folhaImagem) { alert('Selecione a foto da folha.'); return; }
  if (!turmaId || !mes) { alert('Selecione a turma e o mês.'); return; }

  setFolhaOcrStatus('Iniciando reconhecimento de texto...');
  setFolhaOcrProgresso(0);
  setFolhaResultados([]);

  try {
    // Importação dinâmica do Tesseract
    const Tesseract = await import('tesseract.js');
    const { data } = await Tesseract.recognize(
      folhaImagem,
      'por',   // Português
      {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setFolhaOcrProgresso(Math.round(m.progress * 100));
            setFolhaOcrStatus(`Reconhecendo texto... ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );

    const diasNoMes = new Date(ano, mes, 0).getDate();
    const resultados = parsearGradeOCR(data.text, diasNoMes);

    if (resultados.length === 0) {
      setFolhaOcrStatus('');
      alert('Não foi possível identificar alunos na imagem. Verifique se a foto está nítida e com boa iluminação.');
      return;
    }

    setFolhaResultados(resultados);
    setFolhaOcrStatus('');
    setFolhaOcrProgresso(100);
  } catch (err: any) {
    setFolhaOcrStatus('');
    alert(`Erro no OCR: ${err.message ?? String(err)}`);
  }
};
```

---

### 4g — Adicionar função `salvarFolha()`

```typescript
const salvarFolha = async () => {
  if (!turmaId || !mes) { alert('Selecione turma e mês.'); return; }
  const validos = folhaResultados.filter(e => e.nome.trim().length >= 4 && e.dias.length >= 3);
  if (validos.length === 0) { alert('Sem dados para salvar.'); return; }

  setFolhaOcrStatus('Cruzando com alunos da turma...');
  try {
    const alunosTurma = await api.getAlunos(turmaId);
    const registros: any[] = [];

    for (const e of validos) {
      // Tenta match por número de chamada
      let aluno = alunosTurma.find((a: any) => (a.numero || 0) === e.numero);

      // Fallback: match por nome (primeiro + último palavra)
      if (!aluno) {
        const partes = e.nome.toUpperCase().trim().split(/\s+/).filter(Boolean);
        aluno = alunosTurma.find((a: any) => {
          const an = (a.nome ?? '').toUpperCase();
          return partes.length >= 2
            && an.includes(partes[0])
            && an.includes(partes[partes.length - 1]);
        });
      }

      if (!aluno) continue; // não encontrou — pula (não quebra, só avisa)

      const diasCompletos = e.dias.slice(0, new Date(ano, mes, 0).getDate());
      const nFaltas = diasCompletos.filter(d => d === 'F').length;
      const nJust = diasCompletos.filter(d => d === 'J').length;
      const nAtest = diasCompletos.filter(d => d === 'A').length;

      registros.push({
        alunoId: aluno.id,
        turmaId,
        mes,
        ano,
        faltas: nFaltas + nJust + nAtest,
        frequencia: 'DIAS:' + diasCompletos.join(''),
      });
    }

    if (registros.length === 0) {
      throw new Error('Não foi possível cruzar nenhum aluno. Verifique os nomes na tela de revisão.');
    }

    setFolhaOcrStatus('Salvando...');
    await api.upsertFaltasBatch(registros);

    // Informa alunos não cruzados
    const naoEncontrados = validos.length - registros.length;
    setFolhaOcrStatus('');
    setFolhaSalvo(true);
    if (naoEncontrados > 0) {
      alert(`✅ ${registros.length} alunos salvos com sucesso.\n⚠️ ${naoEncontrados} aluno(s) não foram encontrados na turma (verifique nomes na revisão).`);
    }
  } catch (err: any) {
    setFolhaOcrStatus('');
    alert(`Erro ao salvar: ${err.message ?? String(err)}`);
  }
};
```

---

### 4h — Adicionar UI do modo `'folha'` no JSX de `Professor.tsx`

No `return` do componente, **após** o bloco do modo `'foto'` e **antes** do fechamento do `</div>` principal:

```tsx
{/* ──── MODO FOLHA OCR ──── */}
{modo === 'folha' && (
  <div style={{ animation: 'fadeIn 0.2s ease both' }}>

    {/* Seleção de turma + mês (reaproveitar o mesmo seletor do modo manual) */}
    {/* NOTA: A seleção de turma e mês do modo manual já deve estar visível acima do toggle.
         Se não estiver, incluir aqui os mesmos <select> de turmaId e mes. */}

    {!folhaSalvo && (
      <>
        {/* Upload da foto */}
        <div style={{
          border: `2px dashed ${theme.border}`, borderRadius: theme.radiusMd,
          padding: folhaImagem ? 12 : 32,
          textAlign: 'center', marginBottom: 14, cursor: 'pointer',
          background: 'var(--row-odd)',
        }}
          onClick={() => folhaFileRef.current?.click()}>
          <input
            ref={folhaFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = ev => setFolhaImagem(ev.target?.result as string);
              reader.readAsDataURL(f);
            }}
          />
          {folhaImagem ? (
            <img src={folhaImagem} alt="Folha" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
          ) : (
            <>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
              <div style={{ fontWeight: 700, color: theme.primaryText, fontSize: 15 }}>
                Tirar foto ou escolher imagem da Folha OCR
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                Use a folha impressa com grade de dias
              </div>
            </>
          )}
        </div>

        {folhaImagem && folhaResultados.length === 0 && !folhaOcrStatus && (
          <button
            onClick={analisarFolha}
            style={{ ...btn('primary', { full: true }), padding: '13px', fontSize: 16, fontWeight: 700, borderRadius: theme.radiusMd }}>
            🔍 Ler Frequência (Tesseract.js — grátis)
          </button>
        )}

        {/* Progresso OCR */}
        {folhaOcrStatus && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: theme.textSecondary }}>
            <p style={{ marginBottom: 8 }}>{folhaOcrStatus}</p>
            {folhaOcrProgresso > 0 && folhaOcrProgresso < 100 && (
              <div style={{ height: 6, background: theme.border, borderRadius: 3, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
                <div style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${theme.primary}, ${theme.sky})`,
                  width: `${folhaOcrProgresso}%`,
                  transition: 'width 0.3s ease',
                  borderRadius: 3,
                }} />
              </div>
            )}
          </div>
        )}

        {/* Tela de revisão */}
        {folhaResultados.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{
              background: theme.primaryBg, borderRadius: theme.radius,
              padding: '10px 14px', marginBottom: 12,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 700, color: theme.primaryText, fontSize: 14 }}>
                📋 {folhaResultados.length} aluno(s) reconhecidos — revise e corrija se necessário
              </span>
              <button
                onClick={() => { setFolhaResultados([]); setFolhaImagem(null); setFolhaOcrProgresso(0); }}
                style={{ ...btn('ghost', {}), fontSize: 12, padding: '4px 10px' }}>
                🔄 Nova foto
              </button>
            </div>

            {folhaResultados.map((e, i) => (
              <div key={i} style={{
                marginBottom: 10, padding: '10px 12px',
                background: 'var(--row-odd)',
                borderRadius: theme.radius,
                border: `1px solid ${theme.border}`,
              }}>
                {/* Linha: Nº + Nome editável */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{
                    fontWeight: 800, fontSize: 13, color: theme.primaryText,
                    minWidth: 28, textAlign: 'center',
                  }}>
                    {String(e.numero).padStart(2, '0')}
                  </span>
                  <input
                    value={e.nome}
                    onChange={v => {
                      const novo = [...folhaResultados];
                      novo[i] = { ...novo[i], nome: v.target.value };
                      setFolhaResultados(novo);
                    }}
                    style={{
                      flex: 1, padding: '5px 8px', borderRadius: theme.radius,
                      border: `1px solid ${theme.border}`,
                      background: 'var(--edit-bg)', fontSize: 12, fontWeight: 600,
                    }}
                  />
                </div>
                {/* Grade de dias */}
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {e.dias.map((d, di) => (
                    <div key={di} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 8, color: theme.textMuted, lineHeight: 1 }}>{di + 1}</span>
                      <select
                        value={d}
                        onChange={v => {
                          const novo = [...folhaResultados];
                          const dias = [...novo[i].dias] as Array<'P' | 'F' | 'J' | 'A'>;
                          dias[di] = v.target.value as 'P' | 'F' | 'J' | 'A';
                          novo[i] = { ...novo[i], dias };
                          setFolhaResultados(novo);
                        }}
                        style={{
                          width: 28, height: 26, fontSize: 11, textAlign: 'center',
                          border: '1px solid #cbd5e1', borderRadius: 3, cursor: 'pointer',
                          background: d === 'F' ? '#fee2e2' : d === 'J' ? '#ffedd5' : d === 'A' ? '#ede9fe' : '#dcfce7',
                          color: d === 'F' ? '#dc2626' : d === 'J' ? '#d97706' : d === 'A' ? '#7c3aed' : '#16a34a',
                          fontWeight: 700,
                        }}>
                        <option value="P">P</option>
                        <option value="F">F</option>
                        <option value="J">J</option>
                        <option value="A">A</option>
                      </select>
                    </div>
                  ))}
                </div>
                {/* Resumo */}
                <div style={{ marginTop: 6, fontSize: 11, color: theme.textSecondary }}>
                  {(() => {
                    const nF = e.dias.filter(d => d === 'F').length;
                    const nJ = e.dias.filter(d => d === 'J').length;
                    const nA = e.dias.filter(d => d === 'A').length;
                    const nP = e.dias.filter(d => d === 'P').length;
                    const total = e.dias.length;
                    const freq = total > 0 ? ((nP / total) * 100).toFixed(0) : '100';
                    return `F:${nF} J:${nJ} A:${nA} → Freq: ${freq}%${parseInt(freq) < 75 ? ' ⚠️' : ''}`;
                  })()}
                </div>
              </div>
            ))}

            <button
              onClick={salvarFolha}
              disabled={!!folhaOcrStatus}
              style={{ ...btn('primary', { full: true }), padding: '13px', fontSize: 16, fontWeight: 700, borderRadius: theme.radiusMd, marginTop: 8 }}>
              {folhaOcrStatus ? folhaOcrStatus : `💾 Salvar Frequência (${folhaResultados.length} alunos)`}
            </button>
          </div>
        )}
      </>
    )}

    {folhaSalvo && (
      <div style={{
        background: theme.successLight, borderRadius: theme.radiusMd,
        padding: 24, textAlign: 'center',
        border: `2px solid ${theme.success}`,
        animation: 'scaleIn 0.3s ease both',
      }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <p style={{ fontSize: 17, fontWeight: 700, color: theme.successHover, marginTop: 8 }}>
          Frequência salva com sucesso!
        </p>
        <p style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
          Os dados estão disponíveis na grade de Faltas.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center' }}>
          <button onClick={() => { setFolhaSalvo(false); setFolhaImagem(null); setFolhaResultados([]); setFolhaOcrProgresso(0); }}
            style={btn('ghost', {})}>
            📷 Nova folha
          </button>
          <a href="/faltas" style={{ ...btn('primary'), textDecoration: 'none' }}>
            📋 Ver grade de faltas
          </a>
        </div>
      </div>
    )}
  </div>
)}
```

---

## 5. IMPACTO EM ARQUIVOS

| Arquivo | Ação | Detalhe |
|---|---|---|
| `Faltas.tsx` | **CRIAR** função `exportarFolhaOCR()` | Inserir antes de `exportarDiario()` |
| `Faltas.tsx` | **ADICIONAR** botão `📋 Folha OCR` | Ao lado de `🖨️ Diário`, `📊 Excel`, `📄 PDF` |
| `Professor.tsx` | **ADICIONAR** tipo `'folha'` no estado `modo` | 1 linha |
| `Professor.tsx` | **ADICIONAR** terceiro botão no toggle | Após o botão `📷 Via Foto` |
| `Professor.tsx` | **ADICIONAR** estados, interface, 3 funções, UI | `folhaImagem`, `folhaResultados`, etc. |
| `api.ts` | **NENHUMA** alteração | Usa `upsertFaltasBatch()` já existente |
| `styles.ts` | **NENHUMA** alteração | |

---

## 6. REGRAS CRÍTICAS

1. **Células na folha impressa: COMPLETAMENTE VAZIAS** — nenhuma letra, nenhum zero, nenhum P. A professora preenche.
2. **X = falta, vazio = presente** — é o padrão da folha. J e A são opcionais para precisão.
3. **Salvar como `DIAS:` + letras** — formato: `DIAS:PPFPJPPP...`. O campo `faltas` = total de F+J+A.
4. **Modo 'total' e modo 'foto' do Professor.tsx são preservados** — não remover nada.
5. **Mínimo de 3 dias lidos para aceitar um aluno** — evita falsos positivos de linhas de cabeçalho.
6. **Cores da revisão:** P = verde (#dcfce7), F = vermelho (#fee2e2), J = laranja (#ffedd5), A = roxo (#ede9fe).
7. **Fallback de match** — se não achar por número de chamada, tenta por nome (primeira + última palavra).
8. **NÃO usar Google Vision API** — Tesseract.js apenas no modo `'folha'`.

---

## 7. CHECKLIST DE EXECUÇÃO

- [ ] **1.** CRIAR função `exportarFolhaOCR()` em `Faltas.tsx` (inserir antes da função `exportarDiario()`)
- [ ] **2.** ADICIONAR botão `📋 Folha OCR` ao lado dos botões `🖨️ Diário`, `📊 Excel`, `📄 PDF`
- [ ] **3.** Adicionar tipo `'folha'` ao estado `modo` em `Professor.tsx`
- [ ] **4.** Adicionar terceiro botão `📋 Folha OCR` no toggle de modo
- [ ] **5.** Adicionar interface `AlunoFolhaDia` no `Professor.tsx`
- [ ] **6.** Adicionar estados: `folhaImagem`, `folhaResultados`, `folhaOcrStatus`, `folhaOcrProgresso`, `folhaSalvo`, `folhaFileRef`
- [ ] **7.** Adicionar função `parsearGradeOCR()` no `Professor.tsx`
- [ ] **8.** Adicionar função `analisarFolha()` no `Professor.tsx`
- [ ] **9.** Adicionar função `salvarFolha()` no `Professor.tsx`
- [ ] **10.** Adicionar bloco JSX do modo `'folha'` no `return` do `Professor.tsx`
- [ ] **11.** Rodar `cd frontend && npm run build` — zero erros TypeScript
- [ ] **12.** **Teste 1:** Abrir /faltas → turma + mês → clicar 📋 Folha → verificar que abre grade vazia em paisagem
- [ ] **13.** **Teste 2:** Imprimir a folha → preencher X em algumas células → tirar foto
- [ ] **14.** **Teste 3:** Abrir /professor → modo 📋 Folha OCR → upload da foto → clicar Ler Frequência
- [ ] **15.** **Teste 4:** Verificar tela de revisão → corrigir um dia → clicar Salvar
- [ ] **16.** **Teste 5:** Abrir /faltas com a mesma turma/mês → confirmar que grade mostra os dias preenchidos
- [ ] **17.** Commit: `"feat: folha OCR dia a dia (grade X/vazio) + modo folha no Professor"`
- [ ] **18.** Push para branch `claude/bold-hamilton-a1Oj6`
- [ ] **19.** Criar PR draft se não existir

---

*Documento: PROMPT_FOLHA_OCR.md — Versão 1.0 CORRIGIDA*  
*Sistema: Diário de Classe Digital — EMEIEF LUIZ GONZAGA*

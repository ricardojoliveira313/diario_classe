# PROMPT — FOLHA OCR DIÁRIA (Tesseract.js)
## Grade com X por dia + leitura automática de faltas

> **VOCÊ É O EXECUTOR. Leia tudo antes de tocar em qualquer arquivo.**
> Nenhuma linha de código deve ser alterada fora do especificado aqui.

---

## 1. VISÃO GERAL

**Sistema:** Diário de Classe Digital — EMEIEF LUIZ GONZAGA  
**URL:** https://diario.jroapp.com.br  
**Ferramenta OCR:** Tesseract.js (grátis, 100% local, sem internet)  
**Proibido:** Google Vision API — não usar em hipótese alguma

### Objetivo
Criar folha imprimível com grade de dias do mês (células vazias) onde a professora **marca X no dia que o aluno faltou** (deixa em branco se presente). Depois tira foto, o OCR lê os X e converte para o formato `DIAS:PPFJ...` que o sistema já usa.

**Regra de ouro:**
- Célula **vazia** → professora não marca nada → **P** (presente)
- Célula com **X** → professora marcou → **F** (falta)
- Detecção binária: X presente ou ausente — muito mais confiável que ler letras manuscritas

---

## 2. DECISÃO ARQUITETURAL — X ao invés de letras P/F/J/A

Tesseract.js foi treinado para texto impresso, não letras soltas manuscritas em caixinhas de 22px:
- "F" manuscrito → Tesseract lê "E", "P", "7" ou "T"
- "J" manuscrito → Tesseract lê "I", "1" ou "l"

**Solução:** Professora marca **X** só nos dias de falta. Vazio = presente.  
Para justificativa (J) e atestado (A): editados manualmente na tela de revisão do OCR ou pela grade de cliques em `/faltas`.

---

## 3. ESTADO ATUAL (antes das alterações)

### `frontend/src/pages/Faltas.tsx`

Botões existentes (linhas ~411–414):
```
📋 Folha   (chama exportarFolhaOCR — linha 165)
🖨️ Diário  (chama exportarDiario)
📊 Excel   (chama exportarExcel)
📄 PDF     (chama exportarPDF)
```

O botão `📋 Folha` **JÁ EXISTE** e a função `exportarFolhaOCR()` **JÁ EXISTE** (linhas 165–250).  
Mas a função atual gera uma folha simples com colunas F/J para escrever **totais numéricos** — não a grade de dias com células X.

**Ação: SUBSTITUIR** o conteúdo completo da função `exportarFolhaOCR()` pela nova versão com grade de dias.  
**O botão `📋 Folha` NÃO precisa ser alterado** — já existe e continua chamando `exportarFolhaOCR`.

### `frontend/src/pages/OCR.tsx` — JÁ EXISTE (294 linhas)

- `interface AlunoExtrato` → `{ numero, nome, faltas }` (total numérico)
- `parseOCRText()` → lê total numérico de faltas
- `salvar()` → grava `faltas: numero, frequencia: ''`
- Usa Tesseract.js (grátis, local)
- **Não tem suporte a grade de dias** → será ADICIONADO (preservando tudo existente)

---

## 4. PASSO 1 — SUBSTITUIR `exportarFolhaOCR()` em `Faltas.tsx`

**Arquivo:** `frontend/src/pages/Faltas.tsx`  
**Ação:** Localizar a função `exportarFolhaOCR()` (começa na linha 165, termina na linha 250) e **SUBSTITUIR TODO O CONTEÚDO** pelo código abaixo.  
**O botão na linha 411 NÃO muda.**

```typescript
  // ── Folha OCR — Grade de Dias com X (A4 paisagem, células VAZIAS) ─────────────
  const exportarFolhaOCR = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const nomeMes = MESES[mes - 1];
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const diasCols = Array.from({ length: diasNoMes }, (_, i) => {
      const date = new Date(ano, mes - 1, i + 1);
      const dw = date.getDay();
      return { dia: i + 1, isWeekend: dw === 0 || dw === 6 };
    });

    const headerDias = diasCols.map(d =>
      `<th style="border:1px solid #64748b;padding:0;width:22px;min-width:22px;max-width:22px;height:28px;text-align:center;vertical-align:middle;font-size:8px;font-weight:700;background:${d.isWeekend ? '#334155' : '#1e40af'};color:${d.isWeekend ? '#94a3b8' : '#ffffff'};">${d.dia}</th>`
    ).join('');

    const linhas = alunos.map((a, i) => {
      const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      const celulas = diasCols.map(d =>
        `<td style="border:1px solid ${d.isWeekend ? '#94a3b8' : '#cbd5e1'};width:22px;min-width:22px;max-width:22px;height:22px;background:${d.isWeekend ? '#f1f5f9' : rowBg};"></td>`
      ).join('');
      const defi = a.deficiencia ? ' ♿' : '';
      const bf = a.bolsa_familia ? ' 💚' : '';
      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:2px 4px;text-align:center;width:26px;font-size:11px;font-weight:700;">${String(a.numero || i + 1).padStart(2, '0')}</td>
        <td style="border:1px solid #cbd5e1;padding:2px 6px;font-size:10px;white-space:nowrap;">${a.nome}${defi}${bf}</td>
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
  body { font-family: Arial, Helvetica, sans-serif; margin: 6mm; color: #000; background: #fff; }
  table { border-collapse: collapse; }
  @media print { @page { size: A4 landscape; margin: 7mm 6mm; } body { margin: 0; } }
</style>
</head>
<body>

<div style="text-align:center;border-bottom:2px solid #1e40af;padding-bottom:5px;margin-bottom:7px;">
  <div style="font-size:9px;color:#64748b;font-weight:600;letter-spacing:0.5px;">PREFEITURA MUNICIPAL DE SANTO ANDRÉ</div>
  <div style="font-size:15px;font-weight:900;color:#1e40af;margin:1px 0;">EMEIEF LUIZ GONZAGA</div>
  <div style="font-size:9px;color:#475569;font-weight:600;">Folha de Frequência Diária — ${nomeMes.toUpperCase()} / ${ano}</div>
</div>

<table style="width:100%;border:none;margin-bottom:6px;">
  <tr>
    <td style="border:none;font-size:10px;padding:1px 0;">
      <b style="color:#475569;">TURMA:</b>
      <span style="font-size:12px;font-weight:900;color:#1e40af;margin-left:5px;">${turmaObj?.nome ?? '—'}</span>
    </td>
    <td style="border:none;font-size:10px;padding:1px 0;text-align:center;">
      <b style="color:#475569;">PROFESSORA:</b>
      <span style="font-weight:700;margin-left:5px;">${turmaObj?.professora ?? '—'}</span>
    </td>
    <td style="border:none;font-size:10px;padding:1px 0;text-align:right;">
      <b style="color:#475569;">Alunos:</b> ${alunos.length}
      &nbsp;&nbsp;
      <b style="color:#475569;">Dias letivos:</b> ${numDias}
    </td>
  </tr>
</table>

<div style="font-size:9px;padding:3px 8px;background:#fef3c7;border:1px solid #fbbf24;border-radius:3px;margin-bottom:5px;color:#92400e;font-weight:700;">
  ✏️ Escreva <strong>X</strong> no dia em que o aluno <strong>FALTOU</strong>. Deixe em <strong>BRANCO</strong> se veio à aula. Fins de semana (cinza escuro) não preencher.
</div>

<table style="width:100%;">
  <thead>
    <tr>
      <th style="border:1px solid #64748b;padding:2px;width:26px;font-size:9px;text-align:center;background:#0f172a;color:#ffffff;">Nº</th>
      <th style="border:1px solid #64748b;padding:2px 6px;font-size:9px;text-align:left;background:#0f172a;color:#ffffff;min-width:130px;">NOME DO ALUNO</th>
      ${headerDias}
    </tr>
  </thead>
  <tbody>
    ${linhas}
  </tbody>
</table>

<div style="margin-top:5mm;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:4mm;">
  <div style="font-size:9px;color:#475569;">
    <b>Legenda:</b>
    <span style="margin-left:6px;background:#fee2e2;padding:1px 6px;border-radius:2px;font-weight:900;color:#dc2626;font-size:11px;">X</span> = Falta
    &nbsp;&nbsp;
    <span style="background:#f1f5f9;padding:1px 10px;border-radius:2px;border:1px solid #cbd5e1;font-size:10px;">  </span> = Presente (vazio)
    &nbsp;&nbsp;
    <span style="background:#334155;padding:1px 8px;border-radius:2px;font-size:10px;color:#94a3b8;">■</span> = Fim de semana (não preencher)
  </div>
  <div style="font-size:10px;display:flex;gap:12mm;">
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

**Resultado esperado:**
- A4 paisagem, margens 7mm
- Cabeçalho azul com escola e turma
- Grade: Nº (26px) | NOME (min 130px) | D1..D31 (22px cada)
- Dias de semana: cabeçalho azul (#1e40af), células brancas/cinza alternado
- Fins de semana: cabeçalho cinza escuro (#334155), células cinza claro
- Células completamente vazias — professora preenche X à mão
- Instrução em amarelo: "escreva X no dia que faltou, branco se veio"
- Legenda e linha de assinatura no rodapé
- Abre diálogo de impressão automaticamente

---

## 5. PASSO 2 — Adicionar suporte a grade de X em `OCR.tsx`

**Arquivo:** `frontend/src/pages/OCR.tsx` (294 linhas — preservar tudo existente)

### 2a — Adicionar interface `AlunoFolhaDia` (após a interface `AlunoExtrato` existente, linha ~11)

```typescript
// NOVO: grade de dias — true = X (falta), false = vazio (presente)
interface AlunoFolhaDia {
  numero: number;
  nome: string;
  dias: boolean[];
}
```

### 2b — Adicionar função `parseOCRFolha()` (após `parseOCRText()`, linha ~55)

```typescript
// Parser para grade de dias com X
// Tesseract devolve texto linha a linha:
//   "01  ALANNA EMANUELLY FERREIRA      X         X"
//   "02  ANA CLARA SOUZA"
//   "03  PEDRO HENRIQUE       X  X         X"
// Captura: Nº + NOME + sequência de X/espaços
// X, x, *, +, ✗ → true (falta); qualquer outro token → false (presente)
function parseOCRFolha(text: string): AlunoFolhaDia[] {
  const results: AlunoFolhaDia[] = [];
  const seen = new Set<number>();

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.length < 10) continue;
    if (/^(nº|nome|aluno|prof|turma|série|serie|mês|mes|escola|data|total|freq|emei|legenda|presença|falta|justif|atestado|marque|deixe|instruç|fim de)/i.test(line)) continue;

    // Regex: Nº(1-2 dígitos) + NOME (maiúsculas, 8-60 chars) + conteúdo das células
    const m = line.match(/^(\d{1,2})\.?\s{1,4}([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ\s'-]{6,58}?)\s{2,}(.{3,})$/);
    if (!m) continue;

    const num = parseInt(m[1]);
    if (seen.has(num)) continue;
    seen.add(num);

    const nome = m[2].trim();
    const rawDias = m[3];
    // Tokens separados por espaço — cada um representa uma célula
    const tokens = rawDias.split(/\s+/).filter(t => t.length > 0);
    // Linha sem nenhuma marca = todos presentes (tokens podem ser poucos)
    const dias = tokens.map(t => /^[Xx*+✗×]$/.test(t));

    if (dias.length >= 3) {
      results.push({ numero: num, nome, dias });
    }
  }

  return results.sort((a, b) => a.numero - b.numero);
}
```

### 2c — Adicionar função `parseOCRFolhaFallback()` (após `parseOCRFolha()`)

```typescript
// Fallback: separa linha por 2+ espaços em vez de regex
function parseOCRFolhaFallback(line: string): AlunoFolhaDia | null {
  const parts = line.trim().split(/\s{2,}/);
  if (parts.length < 2) return null;

  const [header, ...rest] = parts;
  const diasRaw = rest.join(' ').trim();
  const tokens = diasRaw.split(/\s+/).filter(t => t.length > 0);
  const dias = tokens.map(t => /^[Xx*+✗×]$/.test(t));
  if (dias.length < 3) return null;

  const hMatch = header.match(/^(\d{1,2})\.?\s{1,4}([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ\s'-].+)$/);
  if (!hMatch) return null;

  return {
    numero: parseInt(hMatch[1]),
    nome: hMatch[2].trim(),
    dias,
  };
}
```

---

## 6. PASSO 3 — Adaptar `OCR.tsx`: estados, toggle, `analisar()`, `salvarDiario()`, revisão

### 3a — Adicionar estados novos (junto dos outros `useState`, após linha ~68)

```typescript
const [modoLeitura, setModoLeitura] = useState<'total' | 'diario'>('total');
const [extratosDias, setExtratosDias] = useState<AlunoFolhaDia[]>([]);
```

### 3b — Adicionar toggle de modo na UI (ANTES do bloco de upload, dentro do `return`)

Localizar a div com o `<select>` de Turma e Mês (~linha 162). Inserir o toggle **ANTES** dessa div:

```tsx
{/* Toggle modo leitura */}
<div style={{ marginBottom: 12, display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 4 }}>
  <button
    onClick={() => setModoLeitura('total')}
    style={{
      flex: 1, padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer',
      fontWeight: 700, fontSize: 13,
      background: modoLeitura === 'total' ? '#ffffff' : 'transparent',
      color: modoLeitura === 'total' ? '#1e40af' : '#64748b',
      boxShadow: modoLeitura === 'total' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
      transition: 'all 0.15s',
    }}>
    📊 Total por mês
  </button>
  <button
    onClick={() => setModoLeitura('diario')}
    style={{
      flex: 1, padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer',
      fontWeight: 700, fontSize: 13,
      background: modoLeitura === 'diario' ? '#ffffff' : 'transparent',
      color: modoLeitura === 'diario' ? '#1e40af' : '#64748b',
      boxShadow: modoLeitura === 'diario' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
      transition: 'all 0.15s',
    }}>
    📅 Dia a dia (X na grade)
  </button>
</div>
```

### 3c — Modificar `analisar()` para usar parser conforme modo

Localizar a função `analisar()` (~linha 87). **SUBSTITUIR o bloco interno** pelo seguinte:

```typescript
const analisar = async () => {
  if (!imagePreview) { setErro('Selecione uma imagem.'); return; }
  setErro('');
  setProgresso(0);
  setStatus(modoLeitura === 'total'
    ? 'Carregando motor OCR (primeira vez é mais lento)...'
    : 'Extraindo grade de dias...');
  try {
    const text = await runTesseractOCR(imagePreview, (p) => {
      setProgresso(p);
      setStatus(`Reconhecendo texto... ${p}%`);
    });
    setRawText(text);

    if (modoLeitura === 'total') {
      // Fluxo existente — sem alteração
      const parsed = parseOCRText(text);
      setExtratos(parsed);
      setExtratosDias([]);
      setStep('review');
      setStatus('');
      if (parsed.length === 0) setErro('Não foi possível extrair alunos automaticamente. Revise o texto bruto abaixo e edite manualmente.');
    } else {
      // Novo fluxo — grade de X
      let parsed = parseOCRFolha(text);
      if (parsed.length === 0) {
        // Tenta fallback
        const seenN = new Set<number>();
        const fallback: AlunoFolhaDia[] = [];
        for (const ln of text.split('\n')) {
          const r = parseOCRFolhaFallback(ln);
          if (r && !seenN.has(r.numero)) {
            seenN.add(r.numero);
            fallback.push(r);
          }
        }
        parsed = fallback;
      }
      setExtratosDias(parsed);
      setExtratos([]);
      setStep('review');
      setStatus('');
      if (parsed.length === 0) setErro('Não foi possível identificar alunos na grade. Verifique se a foto está nítida e com boa iluminação.');
    }
  } catch (ex: any) {
    setErro(ex.message);
    setStatus('');
  }
};
```

### 3d — Adicionar função `salvarDiario()` (após a função `salvar()` existente, ~linha 141)

```typescript
const salvarDiario = async () => {
  if (!turmaId) { setErro('Selecione a turma.'); return; }
  const validos = extratosDias.filter(e => e.nome.trim().length > 2 && e.dias.length >= 5);
  if (validos.length === 0) { setErro('Nenhum aluno com dados válidos.'); return; }
  setStatus('Salvando frequência dia a dia...');
  setErro('');
  try {
    const alunosTurma = await api.getAlunos(turmaId);
    const registros: any[] = [];
    const numDias = Math.max(...validos.map(e => e.dias.length));

    for (const e of validos) {
      // Match por número de chamada, depois por nome exato, depois por primeira+última palavra
      let aluno = alunosTurma.find((a: any) => a.numero === e.numero);
      if (!aluno) aluno = alunosTurma.find((a: any) => a.nome?.toUpperCase().trim() === e.nome);
      if (!aluno) {
        const partes = e.nome.split(' ').filter(Boolean);
        aluno = alunosTurma.find((a: any) => {
          const an = a.nome?.toUpperCase() ?? '';
          return partes.length >= 2 && an.includes(partes[0]) && an.includes(partes[partes.length - 1]);
        });
      }
      if (!aluno) continue;

      // Converte boolean[] para string: true → 'F', false → 'P'
      const diasStr = Array(numDias).fill('P').map((_, i) => e.dias[i] ? 'F' : 'P');

      registros.push({
        alunoId: aluno.id,
        turmaId,
        mes,
        ano: 2026,
        faltas: diasStr.filter(d => d === 'F').length,
        frequencia: 'DIAS:' + diasStr.join(''),
      });
    }

    if (registros.length === 0) throw new Error('Não foi possível cruzar os nomes. Verifique se a turma selecionada está correta.');
    await api.upsertFaltasBatch(registros);
    setStep('done');
    setStatus('');
  } catch (ex: any) {
    setErro(ex.message);
    setStatus('');
  }
};
```

### 3e — Adicionar tela de revisão para modo diário

No bloco `step === 'review'` (~linha 195), o código atual mostra a revisão do modo "total".  
**Adicionar logo ANTES do `<div style={{ display: 'flex', gap: 8 }}>` dos botões de ação** (~linha 234):

```tsx
{/* Revisão modo diário — grade de X */}
{modoLeitura === 'diario' && extratosDias.length > 0 && (
  <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 14 }}>
    <div style={{ background: '#1e40af', color: 'white', padding: '10px 14px' }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>
        📅 Grade lida — {extratosDias.length} aluno(s) · Clique nas células para corrigir
      </span>
    </div>
    <div style={{ padding: 10 }}>
      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
        <span style={{ background: '#fee2e2', padding: '1px 6px', borderRadius: 2, color: '#dc2626', fontWeight: 700 }}>X</span> = falta detectada
        &nbsp;&nbsp;
        <span style={{ background: '#dcfce7', padding: '1px 8px', borderRadius: 2, color: '#16a34a', fontWeight: 700 }}> </span> = presente
        &nbsp;&nbsp;
        Clique para alternar.
      </p>
      {extratosDias.map((e, i) => (
        <div key={i} style={{ marginBottom: 8, padding: 8, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#1e40af', minWidth: 26, textAlign: 'center' }}>
              {String(e.numero).padStart(2, '0')}
            </span>
            <input
              value={e.nome}
              onChange={v => setExtratosDias(prev => prev.map((x, j) => j === i ? { ...x, nome: v.target.value } : x))}
              style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {e.dias.map((marcado, di) => (
              <div
                key={di}
                onClick={() => setExtratosDias(prev => prev.map((x, j) => {
                  if (j !== i) return x;
                  const dias = [...x.dias];
                  dias[di] = !dias[di];
                  return { ...x, dias };
                }))}
                title={`Dia ${di + 1}`}
                style={{
                  width: 24, height: 22, border: '1px solid #cbd5e1', borderRadius: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 900, cursor: 'pointer',
                  background: marcado ? '#fee2e2' : '#dcfce7',
                  color: marcado ? '#dc2626' : '#16a34a',
                  userSelect: 'none',
                }}>
                {marcado ? 'X' : ''}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: '#64748b' }}>
            {(() => {
              const nF = e.dias.filter(Boolean).length;
              const total = e.dias.length;
              const freq = total > 0 ? (((total - nF) / total) * 100).toFixed(0) : '100';
              return `Faltas: ${nF} de ${total} dias → Frequência: ${freq}%${parseInt(freq) < 75 ? ' ⚠️' : ''}`;
            })()}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

### 3f — Adaptar botão de salvar no `step === 'review'`

Localizar o botão `💾 Salvar Faltas` (~linha 239). **SUBSTITUIR** por:

```tsx
<button
  onClick={modoLeitura === 'total' ? salvar : salvarDiario}
  disabled={!!status}
  style={{ flex: 2, padding: '11px', borderRadius: 8, background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
  {status || (modoLeitura === 'total' ? '💾 Salvar Faltas' : '💾 Salvar Frequência (X → falta)')}
</button>
```

### 3g — Adaptar `reiniciar()` para limpar os novos estados

Localizar a função `reiniciar()` (~linha 143). **ADICIONAR** dentro dela:

```typescript
setExtratosDias([]);
setModoLeitura('total'); // opcional: reseta para modo total ao reiniciar
```

---

## 7. IMPACTO EM ARQUIVOS

| Arquivo | Ação | Detalhe |
|---|---|---|
| `Faltas.tsx` | **SUBSTITUIR** `exportarFolhaOCR()` (linhas 165–250) | Nova versão com grade de dias X |
| `Faltas.tsx` | **NÃO alterar** botão `📋 Folha` (linha 411) | Já existe, continua chamando `exportarFolhaOCR` |
| `OCR.tsx` | **ADICIONAR** interface `AlunoFolhaDia` | Após `AlunoExtrato` (~linha 11) |
| `OCR.tsx` | **ADICIONAR** `parseOCRFolha()` | Após `parseOCRText()` (~linha 55) |
| `OCR.tsx` | **ADICIONAR** `parseOCRFolhaFallback()` | Logo após `parseOCRFolha()` |
| `OCR.tsx` | **ADICIONAR** estados `modoLeitura`, `extratosDias` | Junto dos outros `useState` (~linha 68) |
| `OCR.tsx` | **ADICIONAR** toggle de modo na UI | Antes do `<select>` de Turma (~linha 162) |
| `OCR.tsx` | **SUBSTITUIR** `analisar()` | Nova versão com bifurcação por modo |
| `OCR.tsx` | **ADICIONAR** `salvarDiario()` | Após `salvar()` (~linha 141) |
| `OCR.tsx` | **ADICIONAR** revisão modo diário no JSX | Antes dos botões no `step === 'review'` |
| `OCR.tsx` | **SUBSTITUIR** botão `💾 Salvar Faltas` | Versão que chama função certa por modo |
| `OCR.tsx` | **MODIFICAR** `reiniciar()` | Adicionar limpeza dos novos estados |
| `api.ts` | **NENHUMA** alteração | Usa `upsertFaltasBatch()` já existente |
| `styles.ts` | **NENHUMA** alteração | |

---

## 8. REGRAS CRÍTICAS

1. **Células VAZIAS na folha impressa** — nenhum caractere. A professora marca X à mão.
2. **X = falta, vazio = presente** — detecção binária. Não tenta ler P/F/J/A manuscritos.
3. **Tolerância OCR** — X lido como "x", "*", "+", "✗" ou "×" → todos viram `true` (falta).
4. **Mínimo 5 dias** para aceitar uma linha — evita falsos positivos.
5. **Modo "Total por mês" preservado intacto** — zero mudanças no fluxo existente.
6. **Revisão editável** — clicar na célula alterna X/vazio antes de salvar.
7. **Salvar como `DIAS:PPFPP...`** — mesmo formato da grade de cliques em `Faltas.tsx`.
8. **`api.upsertFaltasBatch()`** — usa o método existente com `onConflict: 'alunoId,mes,ano'`.

---

## 9. FLUXO COMPLETO (para testar após implementar)

1. Abrir `/faltas` → selecionar turma + mês
2. Clicar **📋 Folha** → janela abre com grade A4 paisagem e células VAZIAS
3. Imprimir (Ctrl+P) — verificar que nenhuma célula tem caractere impresso
4. Professora marca **X** nos dias de falta de cada aluno
5. Tirar foto da folha preenchida (foco, boa iluminação)
6. Abrir `/ocr` → selecionar modo **📅 Dia a dia (X na grade)**
7. Selecionar turma e mês corretos
8. Upload da foto → clicar **🔍 Extrair Texto (Grátis)**
9. Tela de revisão: células vermelhas (X detectado) e verdes (vazio)
10. Corrigir eventuais erros clicando nas células
11. Clicar **💾 Salvar Frequência (X → falta)**
12. Abrir `/faltas` com a mesma turma/mês → grade mostra os dias preenchidos

---

## 10. CHECKLIST DE EXECUÇÃO (ordem obrigatória)

- [ ] **1.** Substituir `exportarFolhaOCR()` em `Faltas.tsx` (linhas 165–250) pelo código do Passo 1
- [ ] **2.** Verificar que o botão `📋 Folha` (linha 411) NÃO foi alterado
- [ ] **3.** Adicionar interface `AlunoFolhaDia` em `OCR.tsx` após `AlunoExtrato`
- [ ] **4.** Adicionar `parseOCRFolha()` em `OCR.tsx` após `parseOCRText()`
- [ ] **5.** Adicionar `parseOCRFolhaFallback()` em `OCR.tsx`
- [ ] **6.** Adicionar estados `modoLeitura` e `extratosDias` em `OCR.tsx`
- [ ] **7.** Adicionar toggle de modo na UI antes do seletor de turma
- [ ] **8.** Substituir `analisar()` pelo código do Passo 3c
- [ ] **9.** Adicionar `salvarDiario()` após `salvar()` em `OCR.tsx`
- [ ] **10.** Adicionar tela de revisão do modo diário no `step === 'review'`
- [ ] **11.** Substituir botão `💾 Salvar Faltas` pelo código do Passo 3f
- [ ] **12.** Adicionar limpeza dos novos estados em `reiniciar()`
- [ ] **13.** Rodar `cd frontend && npm run build` — confirmar zero erros TypeScript
- [ ] **14.** **Teste 1:** clicar 📋 Folha → grade abre vazia em paisagem, sem nenhum caractere preenchido
- [ ] **15.** **Teste 2:** imprimir e marcar X manualmente, tirar foto, abrir OCR modo diário → tela de revisão aparece
- [ ] **16.** **Teste 3:** salvar → abrir `/faltas` e confirmar que grade mostra os dias corretos
- [ ] **17.** **Teste 4:** OCR modo "Total por mês" ainda funciona normalmente
- [ ] **18.** Commit: `"feat: folha OCR grade de X por dia + modo diário em OCR.tsx"`
- [ ] **19.** Push para `claude/bold-hamilton-a1Oj6`
- [ ] **20.** Criar PR draft se não existir

---

*PROMPT_FOLHA_OCR.md — Versão 2.0 FINAL*  
*Sistema: Diário de Classe Digital — EMEIEF LUIZ GONZAGA*

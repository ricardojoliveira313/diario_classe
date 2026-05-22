# PROMPT CIRÚRGICO — DIÁRIO DE CLASSE
## 🧠 CÉREBRO: Ricardo Oliveira | 👷 EXECUTOR: Equipe Técnica

---

⚠️ **LEIA O CÓDIGO REAL antes de alterar qualquer arquivo.**
⚠️ **Números de linha abaixo são do código atual em `main`. Confirme com `git pull`.**

---

## 🔴 BUG #1 — Datas de matrícula não capturadas do Excel SED

### Arquivo: `frontend/src/pages/Importar.tsx`

#### Localização exata

**Linha 254 — dataInicioMatricula (ERRO: mesma chave repetida, sem fallback real):**
```typescript
dataInicioMatricula: fmtDate(nr['DATA INICIO MATRICULA'] ?? nr['DATA INICIO MATRICULA']),
```
⚠️ As duas wildcards são IDÊNTICAS! O fallback `nr['DATA INICIO MATRICULA']` nunca será usado porque é igual à primeira.

**Linha 255 — dataFimMatricula (ERRO: sem fallback para "DT FIM MATRICULA"):**
```typescript
dataFimMatricula: fmtDate(nr['DATA FIM MATRICULA']),
```
Se a coluna SED for "DT FIM MATRICULA" (sem "A" no final), retorna `undefined`.

**Linha 256 — dataMovimentacao (ERRO: sem fallback para "DT MOVIMENTACAO"):**
```typescript
dataMovimentacao: fmtDate(nr['DATA MOVIMENTACAO']),
```

#### Causa raiz
A função `normalizeStr()` (linha 41-43) transforma "Dt Início Matrícula" → "DT INICIO MATRICULA", mas o código só testa `'DATA INICIO MATRICULA'` — sem o prefixo "DT". O SED exporta com "Dt", não "Data".

#### Correção exata

Substituir as linhas 254-256 por:

```typescript
// Busca dinâmica: encontra QUALQUER chave que contenha os termos
const _findKey = (terms: string[]): string | undefined => {
  return Object.keys(nr).find(k => terms.every(t => k.includes(t)));
};

dataInicioMatricula: fmtDate(
  nr['DATA INICIO MATRICULA'] ??
  nr['DT INICIO MATRICULA'] ??
  nr[_findKey(['INICIO', 'MATRICULA'])]
),
dataFimMatricula: fmtDate(
  nr['DATA FIM MATRICULA'] ??
  nr['DT FIM MATRICULA'] ??
  nr[_findKey(['FIM', 'MATRICULA'])]
),
dataMovimentacao: fmtDate(
  nr['DATA MOVIMENTACAO'] ??
  nr['DT MOVIMENTACAO'] ??
  nr['DATA DE MOVIMENTACAO'] ??
  nr[_findKey(['MOVIMENTACAO'])] ??
  nr[_findKey(['MOVIM'])]
),
```

#### Teste
Reimportar o Excel SED. Abrir Alunos → clicar na aluna ALANNA EMANUELLY (RA 000123981657, Prof.ª Maria Lucia). Verificar:
- "Início Matrícula: 04/02/2026"
- "Fim Matrícula: 18/12/2026"

---

## 🔴 BUG #2 — Toda reimportação APAGA histórico de faltas

### Diagnóstico do fluxo atual (linhas 648-699):

```
importar()
  → api.clearAll()              [linha 650]  ← APAGA FALTA + ALUNO + TURMA
  → api.bulkInsertTurmas()      [linha 653]  ← NOVOS UUIDs de turma
  → api.bulkInsertAlunos()      [linha 669]  ← NOVOS UUIDs de aluno (INSERT)
  → api.bulkInsertFaltas()      [linha 699]  ← NOVOS registros de falta (INSERT)
```

**Problemas:**
1. `clearAll()` deleta TODAS as faltas de TODOS os meses
2. `bulkInsertTurmas` cria novas turmas com novos UUIDs (perde referência)
3. `bulkInsertAlunos` com INSERT cria novos alunos com novos UUIDs (mesmo RA geraria duplicata ou erro)
4. `bulkInsertFaltas` com INSERT falharia se `alunoId` já existir com `mes+ano`

### Correção exata — Substituir função `importar()` inteira (linhas 640-708)

Substituir TODO o conteúdo da função `importar` (da linha 640 até 708) por:

```typescript
const importar = async () => {
  if (!dadosRef.current) return;
  const { turmas, alunos } = dadosRef.current;
  setErro('');
  setSucesso(false);
  setTotal(alunos.length);
  setProgresso(0);

  try {
    // ─── PASSO 1: Turmas — upsert por nome (preserva UUIDs existentes) ───
    setStatus('Atualizando turmas...');
    const turmasExistentes = await api.getTurmas();
    const nomeToTurmaId = new Map(turmasExistentes.map(t => [t.nome, t.id]));
    const turmasParaUpsert = turmas.map(t => ({
      ...(nomeToTurmaId.has(t.nome) ? { id: nomeToTurmaId.get(t.nome) } : {}),
      nome: t.nome,
      professora: t.professora,
    }));
    for (let i = 0; i < turmasParaUpsert.length; i += 80) {
      const { data: chunk } = await supabase
        .from('Turma')
        .upsert(turmasParaUpsert.slice(i, i + 80), { onConflict: 'id' })
        .select();
      if (chunk) {
        for (const t of chunk) nomeToTurmaId.set(t.nome, t.id);
      }
    }
    const serieToId = nomeToTurmaId;

    // ─── PASSO 2: Alunos — upsert por RA (preserva UUIDs → preserva faltas) ───
    setStatus('Atualizando cadastro de alunos...');
    const { data: existentes } = await supabase
      .from('Aluno').select('id, ra, nome');
    const raToExistingId = new Map<string, string>();
    const nomeToExistingId = new Map<string, string>();
    for (const e of (existentes ?? [])) {
      if (e.ra) raToExistingId.set(String(e.ra), e.id);
      nomeToExistingId.set(normalizeStr(e.nome), e.id);
    }

    const alunosParaUpsert = alunos.map(a => {
      const raStr = String(a.ra ?? '');
      const nomeNorm = a.nomeNorm;
      const existingId = (raStr ? raToExistingId.get(raStr) : undefined)
        ?? nomeToExistingId.get(nomeNorm);
      return {
        ...(existingId ? { id: existingId } : {}),
        nome: a.nome,
        turmaId: serieToId.get(a.serie) ?? null,
        ra: a.ra,
        numero: 0,
        data_nascimento: a.nascimento,
        data_inicio_matricula: a.dataInicioMatricula || null,
        data_fim_matricula: a.dataFimMatricula || null,
        data_movimentacao: a.dataMovimentacao || null,
        deficiencia: a.deficiencia,
        situacao: a.situacao,
        bolsa_familia: a.bolsaFamilia,
        professora: a.professora,
        nis: a.nis || null,
        responsavel: a.responsavel || null,
      };
    });

    for (let i = 0; i < alunosParaUpsert.length; i += 80) {
      const { error } = await supabase
        .from('Aluno')
        .upsert(alunosParaUpsert.slice(i, i + 80), { onConflict: 'id' });
      if (error) throw error;
      setProgresso(Math.min(i + 80, alunosParaUpsert.length));
      setStatus(`Atualizando alunos... ${Math.min(i + 80, alunosParaUpsert.length)}/${alunosParaUpsert.length}`);
    }

    // ─── PASSO 3: Mapear RA → ID (após upsert incluir novos) ───
    const { data: alunosDb } = await supabase.from('Aluno').select('id, ra, nome');
    const raToId = new Map<string, string>();
    const nomeToId = new Map<string, string>();
    for (const a of (alunosDb ?? [])) {
      if (a.ra) raToId.set(String(a.ra), a.id);
      nomeToId.set(normalizeStr(a.nome), a.id);
    }

    // ─── PASSO 4: Faltas — upsert por (alunoId, mes, ano) ───
    const faltasParaInserir: any[] = [];
    for (const a of alunos) {
      const alunoId = raToId.get(String(a.ra ?? '')) ?? nomeToId.get(a.nomeNorm);
      const turmaId = serieToId.get(a.serie);
      if (!alunoId || !turmaId) continue;
      for (const [mes, f] of Object.entries(a.faltas)) {
        faltasParaInserir.push({
          alunoId, turmaId,
          mes: Number(mes), ano: 2026,
          faltas: f.faltas, frequencia: f.frequencia,
        });
      }
    }

    setStatus(`Atualizando ${faltasParaInserir.length} registros de frequência...`);
    for (let i = 0; i < faltasParaInserir.length; i += 80) {
      const { error } = await supabase
        .from('Falta')
        .upsert(faltasParaInserir.slice(i, i + 80), { onConflict: 'alunoId,mes,ano' });
      if (error) throw error;
    }

    setStatus('');
    setSucesso(true);
  } catch (ex: any) {
    const msg = ex.message ?? String(ex);
    setErro(msg);
    setStatus('');
  }
};
```

### Linha 781-782 — Atualizar texto do botão de confirmação

Substituir:
```typescript
<button onClick={importar}
  style={{ ...btn('danger', { full: true }), fontWeight: 700, fontSize: 15 }}>
  ⚠️ Confirmar Importação (apaga dados anteriores)
</button>
```

Por:
```typescript
<button onClick={importar}
  style={{ ...btn('primary', { full: true }), fontWeight: 700, fontSize: 15 }}>
  ✅ Atualizar Cadastro (histórico de faltas preservado)
</button>
```

### Adicionar aviso de preservação no preview (após linha 776)

Inserir entre a div dos cards e a div dos botões (entre linhas 776 e 777):
```typescript
<div style={{
  marginTop: 12, padding: '10px 14px',
  background: theme.successLight,
  border: `1px solid ${theme.success}`,
  borderRadius: theme.radius,
  fontSize: 13, color: theme.successHover,
  fontWeight: 600,
}}>
  ✅ Faltas históricas serão PRESERVADAS.
  Apenas registros do mês correspondente serão atualizados.
</div>
```

---

## 🔴 CORREÇÃO ADICIONAL — Alunos.tsx: detalhes sempre visíveis

### Arquivo: `frontend/src/pages/Alunos.tsx`
### Linhas 295-299

Substituir:
```typescript
{a.data_inicio_matricula && <div><span>Início Matrícula:</span> {a.data_inicio_matricula}</div>}
{a.data_fim_matricula && <div><span>Fim Matrícula:</span> {a.data_fim_matricula}</div>}
{a.data_movimentacao && <div><span>Movimentação:</span> {a.data_movimentacao}</div>}
```

Por:
```typescript
<div>
  <span style={{ fontWeight: 600, color: theme.textSecondary }}>Início Matrícula:</span>
  {a.data_inicio_matricula
    ? <span style={{ color: theme.text }}>{a.data_inicio_matricula}</span>
    : <span style={{ color: theme.danger, fontWeight: 600 }}>
        ⚠️ não informado
      </span>
  }
</div>
<div>
  <span style={{ fontWeight: 600, color: theme.textSecondary }}>Fim Matrícula:</span>
  {a.data_fim_matricula
    ? <span style={{ color: theme.text }}>{a.data_fim_matricula}</span>
    : <span style={{ color: theme.warning, fontWeight: 600 }}>⚠️ não informado</span>
  }
</div>
<div>
  <span style={{ fontWeight: 600, color: theme.textSecondary }}>Movimentação:</span>
  {a.data_movimentacao
    ? <span style={{ color: theme.text }}>{a.data_movimentacao}</span>
    : <span style={{ color: theme.textMuted, fontStyle: 'italic' }}>—</span>
  }
</div>
```

---

## 🔴 VALIDAÇÃO FINAL

### Build
```bash
cd frontend && npm run build  # Zero erros TypeScript
```

### Testes manuais obrigatórios

```
1. Importar planilha SED → conferir ALANNA EMANUELLY (RA 000123981657)
   - Início Matrícula: 04/02/2026 ✓
   - Fim Matrícula: 18/12/2026 ✓

2. Lançar faltas em Fevereiro (5 alunos, valores diversos) → Salvar

3. Trocar para Março → lançar faltas DIFERENTES → Salvar

4. Voltar para Fevereiro → CONFERIR se as faltas de Fevereiro continuam lá ✓

5. Reimportar a MESMA planilha SED → CONFERIR:
   - Faltas de Fevereiro e Março ainda existem ✓
   - Nenhum aluno duplicado ✓

6. Dark mode → expandir detalhes de aluno → verificar contraste ✓
```

---

## 📦 ARQUIVOS MODIFICADOS (resumo)

| Arquivo | Linhas | Ação |
|---------|--------|------|
| `frontend/src/pages/Importar.tsx` | 254-256 | Substituir dataInicio/ Fim/ Movimentacao com fallback dinâmico |
| `frontend/src/pages/Importar.tsx` | 640-708 | Substituir função `importar()` (upsert em vez de delete+insert) |
| `frontend/src/pages/Importar.tsx` | 776-783 | Inserir aviso de preservação + trocar texto do botão |
| `frontend/src/pages/Alunos.tsx` | 295-299 | Substituir short-circuit por exibição permanente com ⚠️ |

---

## ✅ CRITÉRIO DE ACEITE

> Após aplicar TODAS as correções acima, reimportar o Excel SED. As datas de matrícula aparecem corretamente para a aluna ALANNA (e todos os outros). O histórico de faltas de todos os meses anteriores é preservado integralmente após a reimportação. Zero erros de TypeScript no build.

# PROMPT COMPLETO — Botão "Enriquecer CPF/Cor/Raça" na página Alunos

## Escola
**EMEIEF Luiz Gonzaga — Santo André/SP**  
Repo: `ricardojoliveira313/diario_classe`  
Stack: React 18 + TypeScript + Vite · Supabase · Deploy Render

---

## Problema

Na página **Alunos** (`frontend/src/pages/Alunos.tsx`), as colunas **CPF** e **Cor/Raça** aparecem como `—` para todos os alunos.

Esses campos são preenchidos durante a importação via `Importar.tsx`, usando dados da tabela `Educacenso` do Supabase. Quando o gestor refaz uma importação sem fornecer novamente o arquivo `.xlsx` do Educacenso, o cruzamento não encontra dados e os campos ficam vazios no banco.

**O gestor não quer refazer toda a importação** (processo demorado) só para repopular CPF e Cor/Raça. Ele precisa de um botão que faça isso de forma isolada.

---

## Tabelas envolvidas no Supabase

### Tabela `Educacenso`
Colunas relevantes:
- `nome` (text)
- `data_nascimento` (text — formato `DD/MM/YYYY`)
- `cpf` (text)
- `deficiencia` (text)
- `cor_raca` (text)

### Tabela `Aluno`
Colunas que precisam ser atualizadas:
- `cpf` (text, nullable)
- `cor_raca` (text)
- `deficiencia` (text)

---

## O que implementar

### 1. Botão "🔗 Educacenso" em `Alunos.tsx`

**Onde:** No cabeçalho da página, ao lado dos botões "📊 Excel" e "📄 PDF" — exibir **apenas para admin** (`role === 'admin'`, via `useAuth()`).

**Label:** `🔗 Educacenso`

**O que faz ao clicar:**

```typescript
async function enriquecerDoEducacenso() {
  setEnriquecendo(true);
  try {
    // 1. Carrega todos os alunos do banco
    const todosAlunos = await api.getAllAlunos();

    // 2. Carrega toda a tabela Educacenso
    const { data: educData, error } = await supabase
      .from('Educacenso')
      .select('nome, data_nascimento, cpf, deficiencia, cor_raca');
    if (error || !educData || educData.length === 0) {
      alert('Tabela Educacenso vazia ou inacessível. Importe o arquivo Educacenso primeiro.');
      return;
    }

    // 3. Monta mapa de cruzamento (mesmo algoritmo de Importar.tsx)
    const dbEduc = new Map<string, { cpf: string; deficiencia: string; corRaca: string }>();
    for (const rec of educData) {
      const entry = {
        cpf: rec.cpf || '',
        deficiencia: rec.deficiencia || '',
        corRaca: rec.cor_raca || '',
      };
      if (rec.cpf) dbEduc.set(`CPF:${rec.cpf}`, entry);
      if (rec.nome) {
        const nn = normalizeStr(rec.nome);
        dbEduc.set(`${nn}|${rec.data_nascimento || ''}`, entry);
        if (rec.data_nascimento) {
          const simp = nomeSignificativo(nn);
          if (simp.length >= 3) dbEduc.set(`~${simp}|${rec.data_nascimento}`, entry);
        }
      }
    }

    // 4. Para cada aluno sem CPF ou cor_raca, tenta cruzar
    let atualizados = 0;
    for (const a of todosAlunos) {
      if (a.cpf && a.cor_raca && a.deficiencia) continue; // já tem tudo

      const nomeNorm = normalizeStr(a.nome);
      const nasc = a.data_nascimento || '';
      const simp = nomeSignificativo(nomeNorm);

      const ecPorCPF = a.cpf ? dbEduc.get(`CPF:${a.cpf}`) : undefined;
      const ecExato = !ecPorCPF ? dbEduc.get(`${nomeNorm}|${nasc}`) : undefined;
      const ecFuzzy = (!ecPorCPF && nasc) ? dbEduc.get(`~${simp}|${nasc}`) : undefined;
      const ec = ecPorCPF ?? ecExato ?? ecFuzzy;

      if (ec) {
        const updates: any = {};
        if (!a.cpf && ec.cpf) updates.cpf = ec.cpf;
        if (!a.cor_raca && ec.corRaca) updates.cor_raca = ec.corRaca;
        if (!a.deficiencia && ec.deficiencia) updates.deficiencia = ec.deficiencia;
        if (Object.keys(updates).length > 0) {
          await api.updateAluno(a.id, updates);
          atualizados++;
        }
      }
    }

    // 5. Recarrega alunos na tela
    const atualizadosDB = await (turmaId === '__all__' ? api.getAllAlunos() : api.getAlunos(turmaId));
    setAlunos(atualizadosDB);

    alert(`✅ ${atualizados} aluno(s) enriquecido(s) com CPF/Cor/Raça do Educacenso.`);
  } catch (e: any) {
    alert('Erro: ' + (e.message ?? e));
  } finally {
    setEnriquecendo(false);
  }
}
```

**Estado extra necessário:**
```typescript
const [enriquecendo, setEnriquecendo] = useState(false);
```

**Funções auxiliares necessárias** — copiar de `Importar.tsx` para `Alunos.tsx` (ou mover para `utils.ts`):

```typescript
// Já existe em Importar.tsx — copiar para Alunos.tsx ou extrair para utils.ts
function normalizeStr(s: string): string {
  return (s ?? '').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function nomeSignificativo(norm: string): string {
  const STOP = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'A', 'O']);
  return norm.split(' ').filter(w => w.length >= 3 && !STOP.has(w)).join(' ');
}
```

**Import do supabase** — adicionar em `Alunos.tsx`:
```typescript
import { supabase } from '../api';
```

---

### 2. Botão no JSX (onde colocar)

```tsx
{/* Cabeçalho da página — ao lado dos botões Excel/PDF */}
{role === 'admin' && (
  <button
    onClick={enriquecerDoEducacenso}
    disabled={enriquecendo}
    style={btn('sky', { small: true, outline: true })}
  >
    {enriquecendo ? '⏳ Enriquecendo...' : '🔗 Educacenso'}
  </button>
)}
```

O `role` vem de `useAuth()` — já importado em `Alunos.tsx`:
```typescript
import { useAuth } from '../AuthContext';
// dentro do componente:
const { role } = useAuth();
```

---

### 3. Verificar: `Importar.tsx` enriquece SEMPRE

Em `Importar.tsx`, confirmar que o bloco de enriquecimento (linhas ~1238-1270) **não está** dentro de um `if (cpfMap.size > 0)` ou condição que só executa quando o arquivo Educacenso `.xlsx` foi fornecido.

O bloco já está correto no código atual — executa independentemente. **Não alterar.**

---

## Resumo das mudanças

| Arquivo | Mudança |
|---------|---------|
| `frontend/src/pages/Alunos.tsx` | + estado `enriquecendo` + função `enriquecerDoEducacenso()` + botão "🔗 Educacenso" + funções `normalizeStr` e `nomeSignificativo` + import `supabase` |
| `frontend/src/pages/Importar.tsx` | Nenhuma mudança necessária |

---

## Checklist

- [ ] Estado `enriquecendo` adicionado
- [ ] Função `enriquecerDoEducacenso()` implementada em `Alunos.tsx`
- [ ] Funções `normalizeStr` e `nomeSignificativo` disponíveis em `Alunos.tsx`
- [ ] Import `supabase` adicionado em `Alunos.tsx`
- [ ] Botão "🔗 Educacenso" visível apenas para admin
- [ ] Botão desabilitado (com spinner) enquanto processa
- [ ] Alert de resultado exibido ao usuário
- [ ] Lista de alunos recarregada após enriquecimento
- [ ] Commit em `main` + push

# Prompt Técnico Completo — Aba "Histórico Escolar" no Diário de Classe

**EMEIEF Luiz Gonzaga — Santo André/SP**  
Stack: React + TypeScript + Vite · Supabase · window.print()  
Repositório: `ricardojoliveira313/diario_classe`

> Este documento contém **todas as informações necessárias** para implementar a funcionalidade de emissão de Histórico Escolar diretamente no sistema Diário de Classe, sem necessidade de consultar arquivos adicionais.

---

## Índice

1. [Contexto do Projeto](#1-contexto-do-projeto)
2. [Arquivos a Criar / Editar](#2-arquivos-a-criar--editar)
3. [Passo 1 — Editar AuthContext.tsx](#3-passo-1--editar-authcontexttsx)
4. [Passo 2 — Editar main.tsx](#4-passo-2--editar-maintsx)
5. [Passo 3 — Criar Historico.tsx](#5-passo-3--criar-historicotsx)
6. [Queries Supabase](#6-queries-supabase)
7. [Campos do Documento Impresso](#7-campos-do-documento-impresso)
8. [Tabela HistoricoAluno no Supabase](#8-tabela-historicoaluno-no-supabase)
9. [Regras de Negócio](#9-regras-de-negócio)
10. [CSS de Impressão](#10-css-de-impressão)
11. [Restrições — O Que NÃO Alterar](#11-restrições--o-que-não-alterar)
12. [Critérios de Aceite](#12-critérios-de-aceite)
13. [Ajuste oficial de layout, notas e transferência](#13-ajuste-oficial-de-layout-notas-e-transferência)

---

## 1. Contexto do Projeto

O **Diário de Classe** é um sistema de gestão escolar (faltas, alunos, turmas) da EMEIEF Luiz Gonzaga, Santo André/SP. Stack: React + TypeScript + Vite no frontend, Supabase (PostgreSQL) como backend, deploy estático no Render.

Atualmente não existe funcionalidade de emissão de histórico escolar. A tarefa é criar a aba **"📜 Histórico"** no menu de navegação existente, com uma página onde o secretário busca um aluno pelo RA, preenche os dados dos anos cursados (inclusive em outras escolas) e gera o histórico oficial para impressão.

> ⚠️ **Atenção máxima:** O sistema está em produção e em uso diário. Não alterar o comportamento de nenhuma página existente. Criar apenas os arquivos novos e fazer adições mínimas nos dois arquivos indicados (AuthContext.tsx e main.tsx).

---

## 2. Arquivos a Criar / Editar

| Ação | Arquivo | O que fazer |
|------|---------|-------------|
| **CRIAR** | `frontend/src/pages/Historico.tsx` | Página completa (componente principal) |
| **EDITAR** | `frontend/src/AuthContext.tsx` | Adicionar `'historico'` em PAGINAS_VIEWER |
| **EDITAR** | `frontend/src/main.tsx` | Adicionar import, rota e item de menu |
| **SUPABASE** | Dashboard Supabase | Criar tabela `HistoricoAluno` (SQL na seção 8) |

✅ **Nada mais** — nenhum outro arquivo precisa ser modificado.

---

## 3. Passo 1 — Editar AuthContext.tsx

Arquivo: `frontend/src/AuthContext.tsx`

Localizar a constante `PAGINAS_VIEWER` (linha ~33) e adicionar a entrada de histórico ao final do array:

```typescript
export const PAGINAS_VIEWER = [
  { key: 'dashboard',   label: '📊 Dashboard' },
  { key: 'turmas',      label: '👩‍🏫 Turmas' },
  { key: 'alunos',      label: '👥 Alunos' },
  { key: 'faltas',      label: '📋 Faltas' },
  { key: 'ocorrencias', label: '📋 Ocorrências' },
  { key: 'distorcao',   label: '📐 Distorção' },
  { key: 'pendentes',   label: '📋 Ata de Resultados' },
  // ← ADICIONAR esta linha:
  { key: 'historico',   label: '📜 Histórico Escolar' },
] as const;
```

> ℹ️ O TypeScript irá inferir automaticamente `PageKey` incluindo `'historico'`. Não é necessário alterar mais nada neste arquivo.

> ⚠️ **Permissões para usuários existentes:** Adicionar `'historico'` ao `PAGINAS_VIEWER` só concede acesso automático a usuários do tipo `admin`. Usuários `viewer` com lista explícita de permissões (campo `permissoes` na tabela `Usuario`) precisam ter `'historico'` adicionado manualmente via página de Usuários ou via SQL:
> ```sql
> -- Adicionar 'historico' para todos os viewers que ainda não têm:
> UPDATE "Usuario"
> SET permissoes = array_append(permissoes, 'historico')
> WHERE tipo = 'viewer'
>   AND NOT ('historico' = ANY(permissoes));
> ```
> Se a intenção for restringir o histórico apenas a admin/secretaria, não executar o SQL acima e deixar o acesso liberado somente via concessão manual na página de Usuários.

---

## 4. Passo 2 — Editar main.tsx

Arquivo: `frontend/src/main.tsx`

**4a. Adicionar o import** junto aos outros imports de páginas (linha ~10):

```typescript
import Historico from './pages/Historico';
```

**4b. Adicionar item no array NAV_ITEMS** (após o item de `/pendentes`, antes de `/controle`):

```typescript
// No array NAV_ITEMS, adicionar após { to: '/pendentes', ... }:
{ to: '/historico', label: '📜 Histórico', pageKey: 'historico' as PageKey },
```

**4c. Adicionar a rota** dentro do bloco `<Routes>` (após a rota de `/pendentes`):

```tsx
<Route path="/historico" element={
  <ViewerRoute pageKey="historico">
    <Historico />
  </ViewerRoute>
} />
```

---

## 5. Passo 3 — Criar Historico.tsx

Criar o arquivo `frontend/src/pages/Historico.tsx`. A estrutura completa do componente deve ser:

```typescript
// frontend/src/pages/Historico.tsx
import React, { useState, useRef } from 'react';
import { supabase } from '../api';
import { theme, btn } from '../styles';

// Tipos internos
interface AlunoHistorico {
  id: string;
  ra: number;
  nome: string;
  data_nascimento: string | null;
  cpf: string | null;
  situacao: string | null;
  turmaId: string | null;
  data_inicio_matricula: string | null;
  data_fim_matricula: string | null;
  Turma: { nome: string; professora: string; periodo: string } | null;
}

interface LinhaCiclo {
  ciclo: number;           // 1 a 5
  label: string;           // "1º Ano / Inicial" etc.
  anoLetivo: string;
  cargaHoraria: string;
  escola: string;
  municipio: string;
  uf: string;
  resultado: string;       // para escolas com notas
}

const CICLOS_LABELS = [
  '1º Ano / Inicial',
  '2º Ano / Intermediário',
  '3º Ano / Final',
  '4º Ano / Final (2º ciclo)',
  '5º Ano / Final (2º ciclo)',
];

const ESCOLA_PADRAO = 'EMEIEF LUIZ GONZAGA';
const MUN_PADRAO    = 'Santo André';
const DIRETOR       = 'Terezinha Babichaka Squiavoni';
const CARGO_DIRETOR = 'Diretora de Unidade Escolar';
```

**Estados do componente:**

```typescript
// Dentro do componente Historico():
const [raInput, setRaInput] = useState('');
const [carregando, setCarregando] = useState(false);
const [aluno, setAluno] = useState<AlunoHistorico | null>(null);
const [erro, setErro] = useState<string | null>(null);
const [totalFaltas, setTotalFaltas] = useState(0);
const [linhas, setLinhas] = useState<LinhaCiclo[]>(
  CICLOS_LABELS.map((label, i) => ({
    ciclo: i + 1, label,
    anoLetivo: '', cargaHoraria: '1000',
    escola: ESCOLA_PADRAO, municipio: MUN_PADRAO,
    uf: 'SP', resultado: '',
  }))
);
const [dataEmissao, setDataEmissao] = useState(
  new Date().toLocaleDateString('pt-BR')
);
const printRef = useRef<HTMLDivElement>(null);
```

---

## 6. Queries Supabase

**Busca principal pelo RA:**

```typescript
const buscarPorRA = async () => {
  const ra = parseInt(raInput.trim());
  if (isNaN(ra)) { setErro('Digite um RA válido.'); return; }

  setCarregando(true); setErro(null); setAluno(null);

  // 1. Buscar aluno e histórico sem join embutido
  const [alunoResult, historicoResult] = await Promise.all([
    supabase
    .from('Aluno')
      .select('ra, nome, data_nascimento, cpf, situacao, turmaId, data_inicio_matricula, data_fim_matricula, id')
      .eq('ra', ra),
    supabase.from('HistoricoAluno').select('*').eq('ra', ra).order('ciclo'),
  ]);

  const rows = alunoResult.data ?? [];
  const hist = historicoResult.data ?? [];

  // 2. Buscar as turmas separadamente. O banco atual não possui FK
  // Aluno.turmaId -> Turma.id registrada no schema cache do PostgREST.
  const turmaIds = [...new Set(rows.map(row => row.turmaId).filter(Boolean))];
  const { data: turmas } = turmaIds.length
    ? await supabase.from('Turma').select('id, nome, professora, periodo').in('id', turmaIds)
    : { data: [] };
  const turmasPorId = new Map((turmas ?? []).map(turma => [turma.id, turma]));
  const alunosComTurma = rows.map(row => ({
    ...row,
    Turma: row.turmaId ? (turmasPorId.get(row.turmaId) ?? null) : null,
  }));

  // Preferir o registro ATIVO; ignorar REMA (origem)
  const isAtivo = (s: string | null) => !s || s === 'ATIVO';
  const ativo = alunosComTurma.find(r => isAtivo(r.situacao) && r.situacao !== 'REMA');
  const encontrado = ativo ?? alunosComTurma.find(r => r.situacao !== 'REMA') ?? alunosComTurma[0];

  // Se não houver cadastro atual, criar o aluno de tela com os dados já
  // salvos no histórico ou com campos vazios para digitação manual.
  const primeira = hist[0];
  const selecionado = encontrado ?? {
    id: '', ra, nome: primeira?.nome_aluno ?? '',
    data_nascimento: primeira?.data_nascimento ?? null,
    cpf: primeira?.cpf ?? null, situacao: primeira?.situacao ?? 'TRAN',
    turmaId: null,
    data_inicio_matricula: primeira?.data_inicio_matricula ?? null,
    data_fim_matricula: primeira?.data_fim_matricula ?? null,
    Turma: primeira?.turma_nome ? { nome: primeira.turma_nome } : null,
  };

  // 3. Total de faltas do aluno atual; no modo manual, usar o valor salvo
  const { data: faltas } = selecionado.id ? await supabase
    .from('Falta')
    .select('faltas')
    .eq('alunoId', selecionado.id) : { data: [] };
  const total = primeira?.total_faltas
    ?? (faltas ?? []).reduce((s, f) => s + (f.faltas ?? 0), 0);
  setTotalFaltas(total);

  const cicloAtual = detectarCiclo(selecionado.Turma?.nome ?? '');

  const novasLinhas: LinhaCiclo[] = CICLOS_LABELS.map((label, i) => {
    const ciclo = i + 1;
    const salva = hist?.find(h => h.ciclo === ciclo);
    if (salva) {
      return { ciclo, label, anoLetivo: salva.ano_letivo ?? '',
        cargaHoraria: salva.carga_horaria ?? '1000',
        escola: salva.escola ?? ESCOLA_PADRAO,
        municipio: salva.municipio ?? MUN_PADRAO,
        uf: salva.uf ?? 'SP',
        resultado: salva.resultado ?? '' };
    }
    // Ciclo atual: preencher escola/ano automaticamente
    const ehCicloAtual = ciclo === cicloAtual;
    // anoLetivo: usar ano de data_inicio_matricula, não o ano corrente do sistema
    const anoMatricula = selecionado.data_inicio_matricula?.slice(0, 4) ?? '';
    return { ciclo, label, anoLetivo: ehCicloAtual ? anoMatricula : '',
      cargaHoraria: '1000',
      escola: ehCicloAtual ? ESCOLA_PADRAO : '',
      municipio: ehCicloAtual ? MUN_PADRAO : '',
      uf: 'SP', resultado: '' };
  });

  setAluno(selecionado as AlunoHistorico);
  setLinhas(novasLinhas);
  setCarregando(false);
};
```

**Estados adicionais necessários para campos de certidão e cidade:**

```typescript
// Adicionar ao bloco de estados do componente:
const [certNum,      setCertNum]      = useState('');
const [certFolha,    setCertFolha]    = useState('');
const [certLivro,    setCertLivro]    = useState('');
const [certDistrito, setCertDistrito] = useState('');
const [cidadeNasc,   setCidadeNasc]   = useState('SANTO ANDRÉ');
const [estadoNasc,   setEstadoNasc]   = useState('SP');
```

Ao carregar o histórico salvo (`buscarPorRA`), restaurar esses campos da primeira linha disponível:

```typescript
// Dentro do bloco "if (hist && hist.length > 0)":
const primeira = hist[0]; // cert fields são iguais em todas as linhas do RA
if (primeira) {
  setCertNum(primeira.cert_num ?? '');
  setCertFolha(primeira.cert_folha ?? '');
  setCertLivro(primeira.cert_livro ?? '');
  setCertDistrito(primeira.cert_distrito ?? '');
  setCidadeNasc(primeira.cidade_nasc ?? 'SANTO ANDRÉ');
  setEstadoNasc(primeira.estado_nasc ?? 'SP');
}
```

**Salvar linhas na tabela HistoricoAluno (upsert por ra+ciclo):**

```typescript
const salvarHistorico = async () => {
  if (!aluno) return;
  // Campos de certidão e cidade são RA-nível mas armazenados em cada linha
  const certFields = {
    cert_num:      certNum      || null,
    cert_folha:    certFolha    || null,
    cert_livro:    certLivro    || null,
    cert_distrito: certDistrito || null,
    cidade_nasc:   cidadeNasc   || null,
    estado_nasc:   estadoNasc   || null,
  };
  const registros = linhas.map(l => ({
    ra: aluno.ra, ciclo: l.ciclo,
    ano_letivo:    l.anoLetivo    || null,
    carga_horaria: l.cargaHoraria || null,
    escola:        l.escola       || null,
    municipio:     l.municipio    || null,
    uf:            l.uf           || null,
    resultado:     l.resultado    || null,
    ...certFields,
  }));
  await supabase.from('HistoricoAluno')
    .upsert(registros, { onConflict: 'ra,ciclo' });
};
```

**Gerar PDF / Imprimir:**

```typescript
const imprimir = async () => {
  await salvarHistorico(); // salva antes de imprimir
  window.print();
};
```

---

## 7. Campos do Documento Impresso

O documento deve ser renderizado dentro de uma `div` com id `historico-doc` (alvo dos estilos de impressão).

### 7.1. Origem dos dados de ciclo — arquivo SED

> 🔑 **Dado crítico:** O arquivo SED importado diariamente contém uma coluna **"Série"** com valores numéricos **1, 2, 3, 4 ou 5**, que correspondem **diretamente** ao número do ciclo no histórico escolar. O nome da turma (ex: `"4° ANO C TARDE"`) codifica o mesmo número. Após a importação, a tabela `Aluno` tem `turmaId` → join `Turma.nome` → derivar o ciclo pelo nome da turma. **Não é necessário calcular manualmente — o ciclo = número do ano da turma.**

### 7.2. Função detectarCiclo

```typescript
// Detecta o número do ciclo (1–5) pelo nome da turma
// Exemplos de nomes: "1° ANO A MANHA", "4° ANO C TARDE", "5° ANO B INTEGRAL"
// O número antes de "ANO" = ciclo diretamente (mesma coluna "Série" do PDF SED)
function detectarCiclo(nomeTurma: string): number | null {
  const n = nomeTurma.toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove acentos
    .replace(/[°º]/g, ' ');                              // normaliza grau/ordinal
  const m = n.match(/\b([1-5])\b.*ANO/);
  if (m) return parseInt(m[1]);
  // EJA / Educação de Jovens e Adultos
  if (/ALFABET/.test(n) && !/POS.{0,5}ALFABET/.test(n)) return 1;
  if (/POS.{0,5}ALFABET/.test(n))                        return 2;
  if (/1.*(ETAPA|CICLO)|INICIAL/.test(n))                return 1;
  if (/2.*(ETAPA|CICLO)|INTERMEDIAR/.test(n))            return 2;
  return null;
}
```

Após detectar o ciclo, preencher `linhas[ciclo - 1]` com: `escola = ESCOLA_PADRAO`, `municipio = MUN_PADRAO`, `anoLetivo = ano extraído de data_inicio_matricula` (ex: `aluno.data_inicio_matricula?.slice(0, 4) ?? ''`). As demais linhas ficam em branco para preenchimento manual.

### 7.3. Cenário TRAN — aluno vindo de outra escola para Luiz Gonzaga no meio do ano

Quando um aluno fez parte do ano em outra escola (ex: EMEF Augusto Boal) e depois ingressou na Luiz Gonzaga no mesmo ano letivo, o sistema SED importa-o como **ATIVO** na Luiz Gonzaga com `data_inicio_matricula` = data de ingresso. Portanto:

- A linha do ciclo é **preenchida automaticamente** com Luiz Gonzaga e o ano de `data_inicio_matricula`
- O período anterior (na outra escola) **não existe no sistema** — requer entrada manual pelo secretário
- O secretário pode editar a linha para colocar os dados da escola anterior, ou deixar Luiz Gonzaga como escola principal do ano

**Cenário inverso — aluno que saiu da Luiz Gonzaga (TRAN para outra escola):** o registro terá `situacao = 'TRAN'` e `data_fim_matricula` = data de saída. Exibir a seção "Campo 05 — Transferência" com essa data.

### 7.4. Tabela de campos do documento

| Seção | Campo | Fonte | Editável? |
|-------|-------|-------|-----------|
| **Cabeçalho** | Nome da Secretaria | Texto fixo | Não |
| | Título "HISTÓRICO ESCOLAR" | Texto fixo | Não |
| | Dados da escola | Fixo: EMEIEF LUIZ GONZAGA · Rua Ipanema nº 253 · Parque Erasmo Assunção · Santo André · Fone: 3356-7961/3356-7962 | Não |
| **Dados do Aluno** | Nome | `aluno.nome` | Não |
| | R.A. | `aluno.ra` | Não |
| | Data de nascimento | `aluno.data_nascimento` (formatar DD/MM/AAAA) | Não |
| | Cidade de nascimento | Fixo "SANTO ANDRÉ" — editável se de outro município | Sim |
| | Estado (UF) | Fixo "SP" — editável | Sim |
| | Certidão de nascimento nº / Folha / Livro / Distrito | Não vem da importação SED — inputs editáveis. Salvar em `HistoricoAluno` com colunas: `cert_num`, `cert_folha`, `cert_livro`, `cert_distrito` | Sim |
| **Ciclos Escolares** | 1º Ano / Inicial | `linhas[0]` — ver lógica de autopreenchimento | Sim |
| | 2º Ano / Intermediário | `linhas[1]` | Sim |
| | 3º Ano / Final | `linhas[2]` | Sim |
| | 4º Ano / Final (2º ciclo) | `linhas[3]` | Sim |
| | 5º Ano / Final (2º ciclo) | `linhas[4]` | Sim |
| | Resultado/Nota | Campo extra por linha — texto livre ("Aprovado", "7,5"). Exibir coluna somente se ao menos uma linha tiver valor. | Sim |
| **Transferência** (condicional: TRAN) | Dias letivos | Fixo 200 | Não |
| | Faltas / Presenças | `totalFaltas` da tabela Falta. Presenças = 200 − totalFaltas | Não |
| | Data de saída | `aluno.data_fim_matricula` | Não |
| **Observações legais** | Texto institucional | Fixo — sempre exibido | Não |
| **Certificado** (condicional: ATIVO + `linhas[4].anoLetivo` preenchido) | Nome / escola / ano | `aluno.nome` · "EMEIEF LUIZ GONZAGA" · `linhas[4].anoLetivo` | Não |
| **Rodapé** | Data de emissão | `new Date()` formatado — editável | Sim |
| | Assinatura | Fixo: Terezinha Babichaka Squiavoni — Diretora de Unidade Escolar | Não |
| | Aviso final | Fixo: "ESTE DOCUMENTO NÃO CONTÉM EMENDA NEM RASURA" | Não |

### 7.5. Texto fixo das Observações Legais (Campo 06)

> O Sistema Continuado de Ensino, conforme deliberação CEE 9/97, indicação 22/97 das Escolas Municipais de Santo André prevê avaliação contínua, cumulativa e sistemática, através da síntese de desempenho do aluno. A verificação do rendimento escolar não prevê notas. O Curso de Ensino Fundamental Regular mantido pela Secretaria de Educação do Município de Santo André está organizado em dois ciclos: 1º ciclo (1º, 2º e 3º ano); 2º ciclo (4º e 5º ano). Carga Horária Anual mínima de 1000 horas, distribuídas em 200 dias letivos. A organização do 1º ao 5º ano foi adotada a partir de 2011 (Deliberação CME nº.03/2010). O referido curso equivale às cinco primeiras séries iniciais do Ensino Fundamental de 09 anos.

---

## 8. Tabela HistoricoAluno no Supabase

Executar o SQL abaixo no editor SQL do Supabase (Dashboard → SQL Editor):

```sql
CREATE TABLE IF NOT EXISTS "HistoricoAluno" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ra            bigint       NOT NULL,

  -- Dados do aluno usados no documento. Também permitem emitir o histórico
  -- quando o aluno já não está mais no cadastro atual da tabela Aluno.
  nome_aluno            text,
  data_nascimento       date,
  cpf                   text,
  situacao              text,
  data_inicio_matricula date,
  data_fim_matricula    date,
  turma_nome            text,
  total_faltas          integer CHECK (total_faltas IS NULL OR total_faltas >= 0),

  -- Campos de certidão de nascimento (não vêm da importação SED)
  cert_num      varchar(60),
  cert_folha    varchar(20),
  cert_livro    varchar(20),
  cert_distrito varchar(80),
  cidade_nasc   varchar(80),
  estado_nasc   varchar(2),

  -- Um registro por ciclo (1=1ºAno … 5=5ºAno)
  ciclo         smallint     NOT NULL CHECK (ciclo BETWEEN 1 AND 5),
  ano_letivo    varchar(4),
  carga_horaria varchar(10),
  escola        varchar(120),
  municipio     varchar(80),
  uf            varchar(2),
  resultado     varchar(30),  -- notas/resultado de escolas estaduais

  created_at    timestamptz  DEFAULT now(),
  updated_at    timestamptz  DEFAULT now(),
  UNIQUE (ra, ciclo)         -- upsert via ra+ciclo
);

-- RLS: política aberta (app usa autenticação própria via verificar_login,
-- chegando ao Supabase como role 'anon' — não usa Supabase Auth)
ALTER TABLE public."HistoricoAluno" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON public."HistoricoAluno";
DROP POLICY IF EXISTS "permitir_app_HistoricoAluno" ON public."HistoricoAluno";
CREATE POLICY "permitir_app_HistoricoAluno"
  ON public."HistoricoAluno"
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';
```

---

## 9. Regras de Negócio

- **RA inválido:** `parseInt()` retorna `NaN` → exibir mensagem "Digite um RA válido." Nunca fazer query com NaN.
- **RA não encontrado:** abrir automaticamente o formulário com o RA digitado e todos os dados do aluno editáveis. Exibir aviso de que o aluno não está no cadastro atual. Se já houver registros em `HistoricoAluno`, restaurar os dados salvos; caso contrário, iniciar os campos em branco.
- **Busca de turma:** consultar `Aluno` e `Turma` separadamente usando `Aluno.turmaId` e `Turma.id`. Não usar relacionamento embutido do PostgREST, pois o banco atual não possui uma foreign key entre essas colunas e o schema cache rejeita o join automático.
- **Modo manual:** nome, RA, nascimento, CPF, cidade/UF de nascimento, situação, início da matrícula, data de saída, última turma e faltas devem ser editáveis. Salvar esses valores apenas em `HistoricoAluno`; nunca alterar `Aluno`, `Turma` ou `Falta`.
- **Múltiplos registros para o mesmo RA:** preferir o que tem `situacao = 'ATIVO'` ou nulo. Ignorar registros com `situacao = 'REMA'` (são a turma de origem do remanejamento).
- **Aluno AEE:** se o único registro encontrado for de uma turma AEE (verificar pelo nome da turma contendo "AEE" ou "ATENDIMENTO"), exibir aviso ao usuário e permitir continuar.
- **isAtivo:** `const isAtivo = (s) => !s || s === 'ATIVO'`
- **Carga horária 2020:** se o usuário preencher `anoLetivo = '2020'` em qualquer linha, sugerir automaticamente carga horária `'800'` (pode ser sobrescrito).
- **Linhas vazias na impressão:** linhas onde `anoLetivo`, `escola` e `municipio` estão todos em branco devem ter classe CSS `linha-vazia`. No `@media print`, ocultar essas linhas.
- **Campo Resultado:** exibir coluna "Resultado" na tabela de ciclos somente se ao menos uma linha tiver o campo `resultado` preenchido.
- **Certificado de conclusão:** exibir se a situação for `ATIVO` ou começar com `CONCLUÍDO` **E** a linha do ciclo 5 tiver `anoLetivo` preenchido (`linhas[4].anoLetivo !== ''`). Isso permite reemitir o certificado de um ex-aluno concluinte. Texto: "O diretor da EMEIEF LUIZ GONZAGA, de acordo com o inciso VII do artigo 24 da lei 9394/96, certifica que [NOME], concluiu o 5º Ano do Ensino Fundamental, no ano letivo de [linhas[4].anoLetivo]."
- **Transferência (Campo 05):** exibir se a situação for `TRAN` ou `BXTR`. Período letivo: usar `aluno.data_fim_matricula` se disponível. No modo manual, faltas e data de saída são editáveis.
- **TRAN de outra escola PARA Luiz Gonzaga:** quando o aluno ingressou vindo de outra escola no mesmo ano, o sistema importa-o como ATIVO. O autopreenchimento preenche a linha do ciclo com Luiz Gonzaga. O secretário deve preencher manualmente a escola anterior se houver parte do ano lá. **O sistema não tem dados de outras escolas — só de Luiz Gonzaga.**
- **Série → Ciclo (regra crítica):** a coluna "Série" do arquivo SED (valores 1, 2, 3, 4, 5) corresponde diretamente ao número do ciclo no histórico. O nome da turma (ex: "4° ANO C TARDE") codifica o mesmo número. A função `detectarCiclo(nomeTurma)` extrai esse número com regex. **Ciclo = Série = Número do Ano no ensino fundamental.**
- **Campos nunca undefined/null na tela:** usar `valor ?? ''` ou `valor || '—'` em todo lugar. Nunca exibir "null", "undefined" ou "NaN".

---

## 10. CSS de Impressão

Incluir no componente (via tag `<style>` dentro do JSX ou arquivo CSS importado):

```css
@media print {
  /* Usa visibility (não display) para ocultar o restante da página.
     Com display:none no body>*, o React root (#root) some e o filho
     #historico-doc não consegue reaparecer (pai com display:none bloqueia filhos).
     Com visibility:hidden no body + visibility:visible no doc o filho
     pode sobrescrever o pai — esse é o padrão correto para este caso. */
  body { visibility: hidden; }
  #historico-doc {
    visibility: visible;
    position: fixed;
    top: 0; left: 0;
    font-family: Arial, sans-serif;
    font-size: 10pt;
    color: black;
    width: 180mm;
  }

  /* Tamanho A4, margens padrão */
  @page { size: A4; margin: 15mm 15mm 12mm 15mm; }

  /* Linhas sem dados: ocultar na impressão */
  .linha-vazia { display: none !important; }

  /* Não partir tabelas entre páginas */
  table { break-inside: avoid; }
  .sec-impressao { break-inside: avoid; }

  /* Campos editáveis: aparência de texto normal */
  input, select {
    border: none !important;
    outline: none !important;
    background: transparent !important;
    font-size: 10pt !important;
  }
}
```

> ⚠️ **Atenção:** NÃO usar `body > * { display: none }`. O `#root` (container do React) é filho direto do `body` — se ele receber `display: none`, nenhum filho seu pode sobrescrever com `display: block`, pois a renderização da subárvore para. A abordagem correta é `visibility: hidden` no body + `visibility: visible` no `#historico-doc`, pois a propriedade `visibility` pode ser revertida em descendentes.

---

## 11. Restrições — O Que NÃO Alterar

> 🚫 **Sistema em produção — seguir à risca**

- NÃO alterar `Importar.tsx`, `Faltas.tsx`, `Alunos.tsx`, `Dashboard.tsx`, `Turmas.tsx`
- NÃO alterar `api.ts` — fazer queries diretamente com `supabase` importado de `'../api'`
- NÃO alterar tabelas existentes (`Aluno`, `Turma`, `Falta`) — apenas leitura
- NÃO instalar bibliotecas de PDF pesadas (jsPDF, puppeteer) — usar `window.print()`
- NÃO deletar/alterar registros do banco — escrita apenas em `HistoricoAluno`
- Em `main.tsx`: apenas adicionar import, item no NAV_ITEMS e Route — nada mais

---

## 12. Critérios de Aceite

- [ ] Aba "📜 Histórico" aparece no menu de navegação para todos os usuários autenticados
- [ ] Busca por RA retorna o aluno correto ou mensagem de erro clara
- [ ] Se o RA não existir mais em `Aluno`, o formulário abre para preenchimento manual e impressão
- [ ] Dados pessoais digitados manualmente persistem em `HistoricoAluno` e reaparecem em uma nova busca pelo RA
- [ ] Linhas dos 5 ciclos aparecem pré-preenchidas com escola/ano do ciclo atual e vazias para os demais
- [ ] Todos os campos das linhas de ciclo são editáveis (ano, carga horária, escola, município, UF, resultado)
- [ ] Campo "Resultado" aparece na tabela somente se ao menos uma linha o tiver preenchido
- [ ] Dados editados são salvos na tabela `HistoricoAluno` ao imprimir (persistem para próxima vez)
- [ ] Linhas completamente em branco não aparecem na impressão
- [ ] Seção de Transferência (Campo 05) aparece para alunos com situação TRAN ou BXTR
- [ ] Certificado de conclusão aparece para alunos ATIVO ou CONCLUÍDO com o 5º ano preenchido
- [ ] Impressão via `window.print()` gera documento em A4 sem elementos de interface (menu, botões, etc.)
- [ ] Nenhuma página existente do sistema é afetada (zero regressões)
- [ ] Campos sem dados aparecem em branco — nunca "null", "undefined" ou "NaN"
- [ ] Aluno buscado por RA com múltiplos registros: seleciona automaticamente o ATIVO, ignora REMA
- [ ] Data de emissão preenchida automaticamente com a data atual, mas editável antes de imprimir

---

## 13. Ajuste oficial de layout, notas e transferência

> Esta seção registra a versão vigente da funcionalidade e prevalece sobre os
> exemplos anteriores deste documento quando houver divergência. A referência
> visual é o Histórico Escolar oficial da EMEIEF Luiz Gonzaga fornecido pela
> secretaria.

### 13.1. Documento impresso

- A impressão deve gerar **frente e verso em duas páginas A4**, sempre nesta ordem.
- Cada página usa dimensões físicas de `210 mm × 297 mm`, fonte Arial e margens
  internas equivalentes ao modelo: 13 mm superior, 10 mm direita, 14 mm inferior
  e 13 mm esquerda.
- A frente contém brasão/cabeçalho oficial, identificação do aluno, certidão,
  estudos realizados por ciclo e o quadro de resultados/notas.
- O verso contém, em posições fixas, o quadro de transferência, observações
  legais, certificado, data/assinatura da direção e o aviso final.
- A impressão usa `visibility` para ocultar a interface e páginas com quebra
  explícita; não usa elementos `fixed` para montar o documento.
- Se houver mais de dez disciplinas com notas, ou notas em mais de um ciclo,
  os quadros adicionais são impressos em páginas A4 de anexo sem comprimir o
  documento oficial.

### 13.2. Estabelecimento e transferência

- Cada ciclo possui o campo opcional `complemento_estabelecimento`.
- Quando preenchido com `TRANSFERE-SE`, o texto aparece **na mesma célula de
  Estabelecimento**, logo abaixo do nome da escola, como no documento oficial.
- O preenchimento de `TRANSFERE-SE` sugere automaticamente o ano/ciclo no quadro
  de transferência e o ano de prosseguimento, mas ambos continuam editáveis.
- O verso mantém editáveis: ano/ciclo, período cursado, dias letivos, presenças,
  ausências e ano em que o aluno deverá prosseguir os estudos.

### 13.3. Notas de outras redes

- As notas são opcionais e independentes para cada ciclo.
- O usuário pode adicionar, remover e editar livremente disciplina, nota e carga
  horária. A lista inicial oferece as disciplinas mais comuns, sem limitar nomes.
- Escolas municipais sem notas continuam usando normalmente o histórico: se
  nenhuma nota for informada, o quadro permanece vazio conforme o modelo.
- Os dados são persistidos como JSONB em `notas_disciplinas`, no formato:

```json
[
  { "disciplina": "Língua Portuguesa", "nota": "7", "cargaHoraria": "200" },
  { "disciplina": "Matemática", "nota": "5", "cargaHoraria": "200" }
]
```

### 13.4. Aluno fora do cadastro atual

- Um RA não localizado na tabela `Aluno` abre o modo manual; não bloqueia a tela.
- Nome, RA apresentado, nascimento, CPF, situação, datas de matrícula/saída,
  última turma, faltas, certidão, ciclos, notas e transferência permanecem
  editáveis e são salvos somente em `HistoricoAluno`.
- `ra` continua sendo a chave numérica de busca; `ra_exibicao` preserva zeros,
  pontuação ou outra forma necessária para o documento.
- O modo manual nunca cria ou altera registros em `Aluno`, `Turma` ou `Falta`.

### 13.5. Colunas adicionais

Executar `ADICIONAR_LAYOUT_OFICIAL_HISTORICO.sql`. A operação é aditiva,
idempotente e não modifica a política RLS vigente:

| Coluna | Tipo | Uso |
|---|---|---|
| `ra_exibicao` | `text` | RA exatamente como será impresso |
| `complemento_estabelecimento` | `text` | Ex.: `TRANSFERE-SE` |
| `notas_disciplinas` | `jsonb` | Disciplinas, notas e cargas do ciclo |
| `transferencia_ano_ciclo` | `text` | Ano/ciclo no quadro do verso |
| `transferencia_periodo` | `text` | Período cursado |
| `transferencia_dias_letivos` | `text` | Dias letivos |
| `transferencia_presencas` | `text` | Presenças |
| `transferencia_ausencias` | `text` | Ausências |
| `prosseguimento_ano` | `text` | Ano de prosseguimento dos estudos |
| `data_emissao` | `text` | Data apresentada no documento |

### 13.6. Critérios adicionais de aceite

- [ ] Frente e verso conservam o formato oficial em A4 e não cortam conteúdo.
- [ ] `TRANSFERE-SE` pode ser digitado em qualquer ciclo e sai abaixo da escola.
- [ ] É possível registrar notas e cargas por disciplina em qualquer ciclo.
- [ ] Histórico sem notas continua imprimindo normalmente.
- [ ] Todos os campos necessários a um ex-aluno são preenchíveis manualmente.
- [ ] Reabrir o mesmo RA restaura notas, transferência e demais dados salvos.
- [ ] Nenhuma tabela ou aba fora do Histórico é alterada.

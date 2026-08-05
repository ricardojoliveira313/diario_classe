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

  // 1. Busca o aluno com join na Turma
  const { data: rows } = await supabase
    .from('Aluno')
    .select(`ra, nome, data_nascimento, cpf, situacao,
             turmaId, data_inicio_matricula, data_fim_matricula, id,
             Turma:turmaId ( nome, professora, periodo )`)
    .eq('ra', ra);

  if (!rows || rows.length === 0) {
    setErro(`Aluno com RA ${ra} não encontrado.`);
    setCarregando(false); return;
  }

  // Preferir o registro ATIVO; ignorar REMA (origem)
  const isAtivo = (s: string | null) => !s || s === 'ATIVO';
  const ativo = rows.find(r => isAtivo(r.situacao) && r.situacao !== 'REMA');
  const selecionado = ativo ?? rows.find(r => r.situacao !== 'REMA') ?? rows[0];

  // 2. Total de faltas do aluno
  const { data: faltas } = await supabase
    .from('Falta')
    .select('faltas')
    .eq('alunoId', selecionado.id);
  const total = (faltas ?? []).reduce((s, f) => s + (f.faltas ?? 0), 0);
  setTotalFaltas(total);

  // 3. Carregar linhas salvas do histórico (se existirem)
  const { data: hist } = await supabase
    .from('HistoricoAluno')
    .select('*')
    .eq('ra', ra)
    .order('ciclo');

  const anoAtual = new Date().getFullYear().toString();
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
    return { ciclo, label, anoLetivo: ehCicloAtual ? anoAtual : '',
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

**Salvar linhas na tabela HistoricoAluno (upsert por ra+ciclo):**

```typescript
const salvarHistorico = async () => {
  if (!aluno) return;
  const registros = linhas.map(l => ({
    ra: aluno.ra, ciclo: l.ciclo,
    ano_letivo: l.anoLetivo || null,
    carga_horaria: l.cargaHoraria || null,
    escola: l.escola || null,
    municipio: l.municipio || null,
    uf: l.uf || null,
    resultado: l.resultado || null,
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

Após detectar o ciclo, preencher `linhas[ciclo - 1]` com: `escola = ESCOLA_PADRAO`, `municipio = MUN_PADRAO`, `anoLetivo = ano de data_inicio_matricula`. As demais linhas ficam em branco para preenchimento manual.

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
| **Certificado** (condicional: ATIVO + 5º ano) | Nome / escola / ano | `aluno.nome` · "EMEIEF LUIZ GONZAGA" · `new Date().getFullYear()` | Não |
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

-- RLS: permitir leitura e escrita autenticada
ALTER TABLE "HistoricoAluno" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON "HistoricoAluno"
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

## 9. Regras de Negócio

- **RA inválido:** `parseInt()` retorna `NaN` → exibir mensagem "Digite um RA válido." Nunca fazer query com NaN.
- **RA não encontrado:** `rows.length === 0` → exibir "Aluno com RA [X] não encontrado no sistema."
- **Múltiplos registros para o mesmo RA:** preferir o que tem `situacao = 'ATIVO'` ou nulo. Ignorar registros com `situacao = 'REMA'` (são a turma de origem do remanejamento).
- **Aluno AEE:** se o único registro encontrado for de uma turma AEE (verificar pelo nome da turma contendo "AEE" ou "ATENDIMENTO"), exibir aviso ao usuário e permitir continuar.
- **isAtivo:** `const isAtivo = (s) => !s || s === 'ATIVO'`
- **Carga horária 2020:** se o usuário preencher `anoLetivo = '2020'` em qualquer linha, sugerir automaticamente carga horária `'800'` (pode ser sobrescrito).
- **Linhas vazias na impressão:** linhas onde `anoLetivo`, `escola` e `municipio` estão todos em branco devem ter classe CSS `linha-vazia`. No `@media print`, ocultar essas linhas.
- **Campo Resultado:** exibir coluna "Resultado" na tabela de ciclos somente se ao menos uma linha tiver o campo `resultado` preenchido.
- **Certificado de conclusão:** exibir somente se `isAtivo(aluno.situacao)`. Texto: "O diretor da EMEIEF LUIZ GONZAGA, de acordo com o inciso VII do artigo 24 da lei 9394/96, certifica que [NOME], concluiu o 5º Ano do Ensino Fundamental, no ano letivo de [ANO]."
- **Transferência (Campo 05):** exibir somente se `aluno.situacao === 'TRAN'`. Período letivo: usar `aluno.data_fim_matricula` se disponível.
- **TRAN de outra escola PARA Luiz Gonzaga:** quando o aluno ingressou vindo de outra escola no mesmo ano, o sistema importa-o como ATIVO. O autopreenchimento preenche a linha do ciclo com Luiz Gonzaga. O secretário deve preencher manualmente a escola anterior se houver parte do ano lá. **O sistema não tem dados de outras escolas — só de Luiz Gonzaga.**
- **Série → Ciclo (regra crítica):** a coluna "Série" do arquivo SED (valores 1, 2, 3, 4, 5) corresponde diretamente ao número do ciclo no histórico. O nome da turma (ex: "4° ANO C TARDE") codifica o mesmo número. A função `detectarCiclo(nomeTurma)` extrai esse número com regex. **Ciclo = Série = Número do Ano no ensino fundamental.**
- **Campos nunca undefined/null na tela:** usar `valor ?? ''` ou `valor || '—'` em todo lugar. Nunca exibir "null", "undefined" ou "NaN".

---

## 10. CSS de Impressão

Incluir no componente (via tag `<style>` dentro do JSX ou arquivo CSS importado):

```css
@media print {
  /* Oculta tudo exceto o documento */
  body > * { display: none !important; }
  #historico-doc { display: block !important; }

  /* Tamanho A4, margens padrão */
  @page { size: A4; margin: 15mm 15mm 12mm 15mm; }

  #historico-doc {
    font-family: Arial, sans-serif;
    font-size: 10pt;
    color: black;
    width: 180mm;
    position: fixed;
    top: 0; left: 0;
  }

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

> 🖨️ A abordagem `body > * display:none + #historico-doc display:block` é mais robusta que ocultar elementos individualmente, porque cobre automaticamente qualquer elemento adicionado ao layout no futuro.

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
- [ ] Linhas dos 5 ciclos aparecem pré-preenchidas com escola/ano do ciclo atual e vazias para os demais
- [ ] Todos os campos das linhas de ciclo são editáveis (ano, carga horária, escola, município, UF, resultado)
- [ ] Campo "Resultado" aparece na tabela somente se ao menos uma linha o tiver preenchido
- [ ] Dados editados são salvos na tabela `HistoricoAluno` ao imprimir (persistem para próxima vez)
- [ ] Linhas completamente em branco não aparecem na impressão
- [ ] Seção de Transferência (Campo 05) aparece somente para alunos com situação TRAN
- [ ] Certificado de conclusão aparece somente para alunos ATIVO
- [ ] Impressão via `window.print()` gera documento em A4 sem elementos de interface (menu, botões, etc.)
- [ ] Nenhuma página existente do sistema é afetada (zero regressões)
- [ ] Campos sem dados aparecem em branco — nunca "null", "undefined" ou "NaN"
- [ ] Aluno buscado por RA com múltiplos registros: seleciona automaticamente o ATIVO, ignora REMA
- [ ] Data de emissão preenchida automaticamente com a data atual, mas editável antes de imprimir

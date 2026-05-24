# Relatório de Alterações — Diário de Classe

## Últimos commits (em ordem cronológica reversa)

| Commit | Descrição |
|--------|-----------|
| `5b01a26` | Faltas e API: ordena por data_inicio_matricula; N sequencial |
| `5b8c002` | Ordena alunos por data_inicio_matricula crescente; N sequencial 1-N |
| `755178b` | Remove ordenacao por situacao em Alunos — sort apenas por numero |
| `36fd07c` | PDF como fonte principal: mergeAluno prioriza numero do PDF; Alunos agrupa por turma |
| `8b6f142` | Educacenso: carrega dados da tabela fixa no import e enriquece alunos |
| `cf17fef` | fix: remanejamento — preservar data_inicio_matricula do destino |
| `ea0b208` | Correções diversas (props, tipos, null guards) |
| `bbff83f` | Aliases de data + preservar datas no ehRemaDuplo |

---

## 1. Importação — `Importar.tsx`

### parseExcels — Detecção de turmas diferentes (remanejamento)

**Problema original:** Quando o mesmo RA aparece em duas abas do Excel com turmas diferentes (ex: ATIVO na Solange + REMA na Angelita), a segunda aba sobrescrevia a primeira, perdendo o registro ATIVO.

**Correção:** Quando `seriesDiferentes` é detectado, em vez de sobrescrever, cria uma **entrada separada** com chave `RA:XXXXX|SERIE_NORMALIZADA`. Assim o `alunosMap` mantém ambos os registros.

```typescript
// parseExcels, dentro do if (alunosMap.has(key)):
if (seriesDiferentes) {
  const sufKey = `${key}|${normalizeStr(serie)}`;
  if (alunosMap.has(sufKey)) {
    // atualiza entrada existente (faltas, situacao...)
  } else {
    alunosMap.set(sufKey, {
      nome, ra, numero,
      serie, professora, situacao,
      // ... demais campos
    });
  }
  continue; // não sobrescreve a entrada original
}
```

### mergeAluno — Separação ATIVO + REMA

Quando `mergeAluno` encontra dois registros com o mesmo RA mas turmas diferentes e situações complementares (ATIVO + REMA):

1. Identifica qual é a origem (REMA) e qual é o destino (ATIVO)
2. Preserva AMBAS as entradas em `todosAlunos`:
   - Chave principal `RA:XXXXX` → entrada ATIVO (destino)
   - Chave `RA:XXXXX|REMA` → entrada REMA (origem)
3. Vincula os dados:
   - ATIVO recebe `turmaOrigem` e `professoraOrigem` (de onde veio)
   - REMA recebe `turmaDestino` e `professoraDestino` (pra onde foi)
4. Propaga dados complementares (bolsa família, NIS, CPF, deficiência, faltas)

```typescript
if (ehRemaDuplo) {
  const rema  = existente.situacao === 'REMA' ? existente : a;
  const ativo = existente.situacao === 'REMA' ? a : existente;
  ativo.turmaOrigem      = rema.serie;
  ativo.professoraOrigem = rema.professora;
  rema.turmaDestino      = ativo.serie;
  rema.professoraDestino = ativo.professora;
  todosAlunos.set(key, ativo);       // ATIVO na chave principal
  todosAlunos.set(`${key}|REMA`, rema); // REMA em chave separada
  return;
}
```

### mergeAluno — PDF manda no `numero` (Nº da chamada)

No merge normal, adicionado: o `numero` do PDF sobrescreve o do Excel, porque o PDF é processado por último:

```typescript
if (a.numero) existente.numero = a.numero;
```

Isso garante que o Nº da chamada venha sempre do SED/PDF, não do Excel.

---

## 2. EDUCACENSO — Tabela Fixa

**Problema original:** CPF, deficiência e cor/raça eram perdidos entre importações se o arquivo EDUCACENSO não fosse incluído.

**Correção:** Durante a importação (`importar()`), o sistema carrega todos os registros da tabela `Educacenso` do banco e enriquece os alunos que estão com CPF/deficiência/cor vazios:

```typescript
const { data: dbEducData } = await supabase
  .from('Educacenso')
  .select('nome, data_nascimento, cpf, deficiencia, cor_raca');
// Constrói mapa de busca (por CPF, por nome|data, fuzzy)
// Para cada aluno, preenche campos vazios a partir do mapa
```

**Resultado:** Basta importar o EDUCACENSO 1 vez. Nas importações seguintes (mesmo sem o arquivo), os dados persistem.

---

## 3. Remanejamento — Datas preservadas

No `ehRemaDuplo`, as datas de matrícula (início, fim, movimentação) são preservadas da entrada já existente no banco, evitando que o Excel sobrescreva com vazio:

```typescript
const existAtivo = todosAlunos.get(key);
if (existAtivo) {
  if (!ativo.dataInicioMatricula && existAtivo.dataInicioMatricula)
    ativo.dataInicioMatricula = existAtivo.dataInicioMatricula;
  // mesmo para dataFimMatricula e dataMovimentacao
}
```

---

## 4. Ordenação e Exibição — `Alunos.tsx`

### Agrupamento por turma em "Todas as turmas"

Quando o filtro é "Todas as turmas", os alunos são **agrupados por `turmaId`** e cada turma aparece com:
- Cabeçalho: `📚 Nome da Turma — Professora`
- Numeração independente (1, 2, 3... N)
- Ordenação por `numero` (Nº do SED)

```typescript
const renderRows = useMemo(() => {
  if (turmaId !== '__all__') {
    return alunosFiltrados.map((a, idx) => ({ tipo: 'aluno', a, idx }));
  }
  // Agrupa por turmaId
  const grupos = new Map<string, any[]>();
  for (const a of alunosFiltrados) {
    if (!grupos.has(a.turmaId)) grupos.set(a.turmaId, []);
    grupos.get(a.turmaId).push(a);
  }
  // Para cada turma: ordena por numero, adiciona cabeçalho
  const linhas = [];
  for (const [tid, arr] of grupos) {
    const t = turmaMap.get(tid);
    arr.sort((a, b) => (a.numero || 9999) - (b.numero || 9999));
    linhas.push({ tipo: 'header', nome: `${t.nome} — ${t.professora}`, key: tid });
    arr.forEach((a, idx) => linhas.push({ tipo: 'aluno', a, idx }));
  }
  return linhas;
}, [alunosFiltrados, turmaId, turmaMap]);
```

### Ordenação

```typescript
alunosFiltrados.sort((a, b) => (a.numero || 9999) - (b.numero || 9999));
```

- Ordena pelo `numero` do SED (Nº da chamada)
- Alunos sem `numero` (0) vão para o final
- Sem ordenação secundária por situação

### Exibição do Nº

- `Nº` exibido = `a.numero` (original do SED) ou fallback `i + 1` para alunos sem número

---

## 5. Arquivos modificados (últimos 10 commits)

| Arquivo | Alterações |
|---------|------------|
| `frontend/src/pages/Importar.tsx` | +137 linhas — mergeAluno, ehRemaDuplo, EDUCACENSO fix, numero do PDF |
| `frontend/src/pages/Alunos.tsx` | +503/-503 linhas — agrupamento por turma, ordenação, display |
| `frontend/src/pages/Faltas.tsx` | +22/-22 linhas — Nº sequencial |
| `frontend/src/api.ts` | +4/-4 linhas — ordenação na query |
| `frontend/src/pages/Dashboard.tsx` | Ajustes diversos |
| `frontend/src/pages/Distorcao.tsx` | Ajustes diversos |
| `frontend/src/pages/Turmas.tsx` | Ajustes diversos |
| `frontend/src/AuthContext.tsx` | Ajustes diversos |
| `frontend/tsconfig.json` | Ajustes diversos |

---

## 6. Pontos ainda pendentes / não resolvidos

- **Numeração de novos alunos**: quando um aluno é adicionado manualmente (sem SED), o `numero` fica 0. O fallback `i + 1` coloca no final da turma, mas não atribui um Nº fixo no banco.
- **REMA sem numero do PDF**: a entrada REMA (criada pelo `ehRemaDuplo`) só recebe `numero` do Excel, não do PDF. Se o Excel não tiver a coluna Nº, o REMA fica com `numero=0`.
- **Ordenação por data de matrícula**: foi testada mas revertida em favor da ordenação por `numero` do SED.

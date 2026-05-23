# PROMPT — Enriquecimento CPF / Cor & Raça sem Educacenso

## Contexto da escola

**EMEIEF Luiz Gonzaga — Santo André/SP**
Repositório: `ricardojoliveira313/diario_classe`
Stack: React 18 + TypeScript + Vite · Supabase (PostgreSQL) · deploy no Render

---

## Problema

Na página **Alunos** (`frontend/src/pages/Alunos.tsx`), as colunas **CPF** e **Cor/Raça** aparecem com traço (`—`) para todos os alunos, mesmo que o arquivo Educacenso (INEP) já tenha sido importado e exista a tabela `Educacenso` no Supabase com esses dados.

O único jeito atual de popular `cpf` e `cor_raca` no cadastro de cada aluno é refazer o processo completo de importação na página **Importar**, subindo novamente o arquivo `.xlsx` do Educacenso. O gestor faz isso apenas **2 vezes por ano** e não quer ter que refazer a importação inteira só para reter esses campos.

### O que já existe no código

| Local | O que faz |
|-------|-----------|
| `supabase.from('Educacenso')` | Tabela Supabase com colunas: `nome`, `data_nascimento`, `cpf`, `deficiencia`, `cor_raca` |
| `Importar.tsx` linha ~1238-1295 | Durante o import, lê a tabela `Educacenso` e enriquece alunos via cruzamento por nome+data_nascimento |
| `Alunos.tsx` linha ~489-511 | Já existe `<select>` com opções fixas (Branca/Preta/Parda/Amarela/Indígena/Não declarado) para editar `cor_raca` de **um aluno por vez** na linha expandida |
| `api.updateAluno(id, { cpf, cor_raca })` | Já existe no `api.ts` |

### Por que o enriquecimento do Educacenso não funciona automaticamente

O código de enriquecimento em `Importar.tsx` só é executado durante o fluxo completo de importação (que inclui `clearAlunos()` — apaga todos os alunos — e re-insere do zero). Após esse processo, os campos `cpf` e `cor_raca` ficam vazios porque a tabela `Educacenso` já existe no banco mas o cruzamento pode falhar se os nomes não baterem perfeitamente, **ou** porque o usuário fez a importação dos alunos sem fornecer o arquivo Educacenso naquela sessão.

---

## O que precisa ser implementado

### Requisito 1 — Botão "🔗 Enriquecer do Educacenso" na página Alunos

Adicionar, no cabeçalho da página **Alunos** (próximo ao botão de Excel e PDF), um botão com o label **"🔗 Educacenso"** que:

1. Lê **todos** os registros da tabela `Educacenso` do Supabase:
   ```typescript
   supabase.from('Educacenso').select('nome, data_nascimento, cpf, deficiencia, cor_raca')
   ```

2. Para cada aluno carregado na tela (`alunos` state), tenta cruzar com um registro do Educacenso usando a função de matching já existente no `Importar.tsx` (normalização de nome + data de nascimento, fuzzy match com threshold):
   - Mesma lógica de `normalizeNome()` e `matchScore()` já implementada em `Importar.tsx`

3. Para cada aluno que tiver match com confiança **alta** (`matchScore >= 0.85`):
   - Se `aluno.cpf` estiver vazio E `educacenso.cpf` não estiver: faz `api.updateAluno(id, { cpf })`
   - Se `aluno.cor_raca` estiver vazio E `educacenso.cor_raca` não estiver: faz `api.updateAluno(id, { cor_raca })`
   - Se `aluno.deficiencia` estiver vazio E `educacenso.deficiencia` não estiver: faz `api.updateAluno(id, { deficiencia })`

4. Ao terminar, mostra toast/alert: `"✅ X alunos enriquecidos com CPF/Cor/Raça do Educacenso"` (ou `"Nenhum aluno correspondido"` se não encontrou matches)

5. Recarrega a lista de alunos após o enriquecimento.

> **Nota:** O botão deve estar disponível apenas para usuários com `role === 'admin'`. Usar `useAuth()` de `../AuthContext`.

### Requisito 2 — Tornar CPF e Cor/Raça editáveis diretamente na grid principal

Atualmente, para editar CPF/cor_raca o usuário precisa clicar no aluno para expandir a linha de detalhes, depois clicar em "+ adicionar". Tornar mais visível:

- Na coluna **CPF** do grid principal: se `a.cpf` for nulo, mostrar `+ cpf` em azul clicável (igual ao que já existe na linha de detalhes expandida). O clique deve expandir diretamente a seção de detalhes (`toggleDetalhes(a.id)`) **e** definir `editandoCpf` para esse aluno.

- Na coluna **Cor/Raça** do grid principal: se `a.cor_raca` for nulo, mostrar `+ raça` em azul clicável. O clique deve expandir a seção de detalhes e definir `editandoCor`.

### Requisito 3 — Enriquecimento automático durante importação (já existe, verificar se funciona)

Em `Importar.tsx`, na função que executa o passo de importação, verificar se o trecho abaixo está sendo executado **sempre** (mesmo quando não há arquivo Educacenso `.xlsx` fornecido):

```typescript
// ─── Carrega EDUCACENSO do banco (tabela fixa) e enriquece alunos ───
const { data: educacensoDb } = await supabase
  .from('Educacenso')
  .select('nome, data_nascimento, cpf, deficiencia, cor_raca');
```

Se esse trecho estiver dentro de um bloco `if (cpfMap.size > 0)` ou similar (ou seja, só executado quando o usuário enviou o arquivo Educacenso), **mover para sempre executar**, usando o banco como fallback mesmo quando nenhum arquivo foi enviado.

---

## Arquivo de referência: lógica de matching (de Importar.tsx)

```typescript
// Normalização de nomes para cruzamento
function normalizeNome(s: string): string {
  return s.toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Score de similaridade entre dois nomes
function matchScore(a: string, b: string): number {
  const na = normalizeNome(a).split(' ');
  const nb = normalizeNome(b).split(' ');
  const intersect = na.filter(w => nb.includes(w)).length;
  return intersect / Math.max(na.length, nb.length);
}
```

Cruzamento principal: `nome + data_nascimento` (formato `DD/MM/YYYY`). Match de alta confiança = score ≥ 0.85. Match de média confiança = score ≥ 0.6.

---

## Turma especial: EJA I - PÓS-ALFABETIZAÇÃO

A professora **Elaine Aparecida da Silva Figueiredo** leciona a turma chamada exatamente:
```
EJA I - PÓS-ALFABETIZAÇÃO
```

Esta turma é noturna/EJA mas é Pós-Alfabetização (não EJA regular). O usuário reportou que esta turma foi cadastrada mas sumiu. **Verificar se a turma existe no banco** e, se não, instruir o usuário a recadastrar via Turmas → Nova Turma com exatamente este nome e professora.

Além disso: a função `ordemTurma()` em `styles.ts` foi corrigida para que "EJA I - PÓS-ALFABETIZAÇÃO" seja classificada no grupo `09` (Pós-Alfabetização) e não no grupo `08` (EJA), pois o padrão `/POS.{0,5}ALFABET/` é verificado **antes** de `/\bEJA\b/`.

---

## Lista completa de turmas (2026)

```
1ª ETAPA PRÉ-ESCOLA A MANHA ANUAL   — Profª Maria Lucia
1ª ETAPA PRÉ-ESCOLA B MANHA ANUAL   — Profª Denise
1ª ETAPA PRÉ-ESCOLA C MANHA ANUAL   — Profª Fernanda
1ª ETAPA PRÉ-ESCOLA D MANHA ANUAL   — Profª Celina
1ª ETAPA PRÉ-ESCOLA E TARDE ANUAL   — Profª Debora
1ª ETAPA PRÉ-ESCOLA F TARDE ANUAL   — Profª Andressa
1ª ETAPA PRÉ-ESCOLA G TARDE ANUAL   — Profª Rosangela
1ª ETAPA PRÉ-ESCOLA H TARDE ANUAL   — Profª Adriana Zenoides
2ª ETAPA A   — Profª Liliane
2ª ETAPA B   — Profª Silvana
2ª ETAPA C   — Profª Michele
2ª ETAPA D   — Profª Solange
2ª ETAPA E   — Profª Sabrina
2ª ETAPA F   — Profª Angelita
2ª ETAPA G   — Profª Kamila
2ª ETAPA H   — Profª Danielle
1° ANO A MANHA ANUAL   — Profª Roseli Pereira
1° ANO B MANHA ANUAL   — Profª Bruna
1° ANO C TARDE ANUAL   — Profª Luciany
1° ANO D TARDE ANUAL   — Profª Silene
1° ANO E TARDE ANUAL   — Profª Bianca
2º ANO A   — Profª Ione
2º ANO B   — Profª Sandra
2º ANO C   — Profª Gilmara
2º ANO D   — Profª Paula
2º ANO E   — Profª Marta
3º ANO A   — Profº Magnus
3º ANO B   — Profª Thabata
3º ANO C   — Profª Cátia
3º ANO D   — Profª Adriana Caetano
4º ANO A   — Profª Juliana
4º ANO B   — Profª Camila P
4º ANO C   — Profª Cida Drigo
4º ANO D   — Profª Karine
5º ANO A   — Profª Roseli Zamana
5º ANO B   — Profª Jessica
5º ANO C   — Profª Alessandra
5º ANO D   — Profª Raquel
EJA I - ALFABETIZAÇÃO   — Profª Maria dos Anjos Ferreira do Carmo
EJA I - PÓS-ALFABETIZAÇÃO   — Profª Elaine Aparecida da Silva Figueiredo
```

---

## Checklist de entrega

- [ ] Botão "🔗 Educacenso" em `Alunos.tsx` — enriquecer CPF/Cor/Raça/Deficiência em batch
- [ ] Colunas CPF e Cor/Raça clicáveis no grid principal (quando vazias)
- [ ] `Importar.tsx`: enriquecimento do banco Educacenso roda **sempre**, não só quando há XLSX
- [ ] Verificar tabela `Educacenso` no Supabase — existe com dados?
- [ ] Commit em `main` + push

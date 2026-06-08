# Correções de Duplicatas — Diário de Classe

## Problemas Identificados

### 🔴 1. `nomeToExistingId` sobrescrevia homônimos
- **Antes**: `Map<string, string>` — só guardava 1 ID por chave `nome|dataNascimento`
- **Problema**: Gêmeos ou alunos com mesmo nome e data de nascimento (sem RA) tinham o primeiro registro sobrescrito no mapa, gerando UUID novo duplicado na importação
- **Solução**: `Map<string, string[]>` acumula múltiplos IDs; `resolveNomeId()` retorna `undefined` quando há 2+ candidatos, deixando a dedup final unificar

### 🔴 2. Nenhuma constraint UNIQUE no banco
- **Antes**: Sem proteção a nível de banco contra RA duplicado ou turma com mesmo nome
- **Solução**: 
  - `aluno_ra_uniq`: UNIQUE INDEX parcial (`WHERE ra IS NOT NULL AND situacao <> 'REMA'`)
  - `turma_nome_uniq`: UNIQUE INDEX parcial (`WHERE nome <> ''`)

### 🟡 3. Sem rollback em falha de importação
- **Antes**: Se a importação caísse no meio (rede, refresh), registros deletados na pré-limpeza eram perdidos
- **Solução**: `snapAlunosDeletados` salva snapshot de todos os registros deletados e restaura no `catch`

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `SUPABASE_SQL.sql` | UNIQUE INDEX em `Aluno(ra)` e `Turma(nome)` |
| `backend/prisma/schema.prisma` | `@@unique([nome])` em Turma |
| `frontend/src/pages/Importar.tsx` | `nomeToExistingId` como `Map<string, string[]>`, `resolveNomeId()`, rollback |

## Para Aplicar

Execute o SQL abaixo no Supabase SQL Editor (idempotente):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS aluno_ra_uniq
  ON "Aluno" (ra) WHERE ra IS NOT NULL AND situacao <> 'REMA';

CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq
  ON "Turma" (nome) WHERE nome <> '';
```

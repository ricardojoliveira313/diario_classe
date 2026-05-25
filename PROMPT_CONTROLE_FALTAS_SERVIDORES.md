# 🏫 CONTROLE DE FALTAS — SERVIDORES
## Sistema de Frequência do Quadro de Pessoal Escolar
### EMEIEF Luiz Gonzaga | Santo André/SP | Prefeitura Municipal

---

## 🧠 VISÃO GERAL

**Nome do sistema:** Controle de Faltas — Servidores  
**Finalidade:** Registro, controle e relatório de frequência mensal de todos os servidores (professores, funcionários, estagiários, gestão) da unidade escolar  
**Escola:** EMEIEF Luiz Gonzaga (CR 61015) — Parque Erasmo, Santo André/SP  
**Stack:** React + TypeScript + Vite + Supabase (PostgREST) + TailwindCSS  
**Projeto base:** DiárioClasse (`https://diario.jroapp.com.br`)  
**Supabase Project ID:** `hxmwpleyhagwcukuhzxg`

---

## 🗂 ESTRUTURA DO BANCO DE DADOS

Todas as tabelas estão no schema `public` do Supabase, com:
- **RLS desabilitado** (autenticação própria via tabela `Usuario`)
- **GRANT ALL** para roles `anon` e `authenticated`

### Tabelas do módulo

| Tabela | Descrição |
|--------|-----------|
| `Servidor` | Quadro de pessoal (RF, nome, cargo, período) — 90 servidores |
| `Escola` | Dados da escola (CR 61015, EMEIEF Luiz Gonzaga) |
| `Vinculo` | Vínculo empregatício (efetivo, substituto, contratado, readaptado) |
| `TipoAfastamento` | Tabela de códigos: P, F, AF, LM, LT, ABO, FÉRIAS, DSR, etc. |
| `Afastamento` | Afastamentos individuais com data de início/fim e documento |
| `FrequenciaMensal` | Frequência diária em JSON: `{"1":"P","2":"F","3":"AF",...}` |
| `Parametro` | Dias úteis + feriados por mês (2026 pré-populado) |
| `AuditLog` | Histórico de alterações no sistema |
| `Usuario` | Login (compartilhado com DiárioClasse) |

---

## 👥 QUADRO DE SERVIDORES (extraído das folhas de maio/2026)

**90 servidores** cadastrados com RF (Registro Funcional), nome, cargo e período:

- **54 Manhã** / **32 Tarde** / **4 Noite**
- Cargos: Professor Ed. Infantil/Fundamental, Prof. Ed. Física, Prof. AEE (Atendimento Educacional Especializado), Assistente Pedagógico, Agente de Inclusão Escolar, Diretor, Vice-Diretor, Merendeira, Servente Geral, Estagiário de Pedagogia, Auxiliar Administrativo, Monitor de Inclusão Digital

---

## 📋 FUNCIONALIDADES REQUERIDAS

### 1. Dashboard
- Total de servidores por período (Manhã / Tarde / Noite)
- Total de faltas no mês atual
- Alertas: servidores com excesso de faltas (> X dias/mês)
- Calendário do mês com dias úteis e feriados

### 2. Cadastro de Servidores
- Listar, buscar, filtrar por cargo/período
- Editar cargo, período, turma atribuída, sala, ativo/inativo
- RF é único e imutável

### 3. Registro de Frequência Mensal
- Grid de dias do mês × servidores
- Células clicáveis: P (Presente) → F (Falta) → AF (Afastamento) → [limpar]
- Fins de semana e feriados marcados automaticamente (cinza)
- Salvamento automático por célula (sem botão "salvar")
- Indicadores de presença/falta por linha e por coluna
- Filtro por período (Manhã / Tarde / Noite)

### 4. Afastamentos
- Cadastrar afastamento: servidor, tipo (LM, LT, ABO, etc.), data início/fim
- Upload de documento (Supabase Storage)
- Afastamentos aparecem automaticamente na grade de frequência

### 5. Relatórios
- **Folha de Frequência Mensal** (PDF/print): igual ao modelo da Prefeitura
  - Cabeçalho: servidor, RF, cargo, mês/ano
  - Grid com dias do mês, horários, assinaturas
  - Totais de presença, falta e afastamento
- **Resumo Mensal**: todos os servidores, total de faltas/presenças
- **Relatório por Cargo**: média de frequência por categoria
- Exportar Excel

### 6. Parâmetros
- Definir dias úteis por mês
- Cadastrar feriados
- Definir tolerância máxima de faltas

### 7. Usuários
- Perfis: `admin` (gestão total), `diretor` (visualizar + aprovar), `secretario` (lançar frequência), `visualizador` (só leitura)

---

## 🎨 DESIGN & UX

- **Paleta:** Azul escuro (#1e3a5f) + Branco + Cinza claro — visual institucional/sério
- **Responsivo:** funciona em celular (professores lançam pelo celular)
- **Acessibilidade:** contraste AAA, fonte mínima 16px
- **Modo impressão:** folhas de frequência otimizadas para A4
- **Toast notifications** para confirmação de lançamentos
- **Skeleton loading** durante carregamento

---

## 🔐 AUTENTICAÇÃO

Mesma lógica do DiárioClasse:
```
1. Verifica VITE_USERS (env var) — formato: "user1:senha1:perfil1,user2:senha2:perfil2"
2. Fallback: tabela "Usuario" no Supabase
3. Token JWT local (localStorage)
4. Sessão expira em 8h
```

---

## 🏗 ESTRUTURA DE PASTAS SUGERIDA

```
src/
├── pages/
│   ├── Dashboard.tsx          # Visão geral + KPIs
│   ├── Servidores.tsx         # Lista + cadastro de servidores
│   ├── Frequencia.tsx         # Grid de frequência mensal ← PRINCIPAL
│   ├── Afastamentos.tsx       # Gestão de afastamentos
│   ├── Relatorios.tsx         # Folha de frequência PDF + resumos
│   ├── Parametros.tsx         # Dias úteis, feriados
│   └── Usuarios.tsx           # Gestão de usuários
├── components/
│   ├── FrequenciaGrid.tsx     # Grade de frequência (coração do sistema)
│   ├── FolhaFrequenciaPDF.tsx # Template de impressão
│   ├── ServidorCard.tsx
│   └── AfastamentoModal.tsx
├── hooks/
│   ├── useFrequencia.ts
│   └── useServidor.ts
└── api.ts                     # Supabase client (reutilizar do DiárioClasse)
```

---

## 📌 REGRAS DE NEGÓCIO

1. **Fins de semana** (sáb/dom) → automático: `DSR` (Descanso Semanal Remunerado)
2. **Feriados** cadastrados em `Parametro` → automático: `FER`
3. **Faltas injustificadas (`F`)** → contam para o total de faltas
4. **Afastamentos legais (`AF`, `LM`, `LT`)** → NÃO contam como falta
5. **Abono (`ABO`)** → não conta como falta
6. **Limite de faltas** → configurável em `Parametro` (padrão: 3/mês = aviso; 6/mês = alerta vermelho)
7. **RF único por servidor** — não pode ser editado depois do cadastro
8. **Dois servidores podem ter o mesmo nome** (ex: SABRINA MARIA MACARIO aparece 2x com RFs diferentes: 583766 e 1310445)

---

## ⚡ REFERÊNCIA TÉCNICA

### Conexão Supabase
```typescript
const supabase = createClient(
  'https://hxmwpleyhagwcukuhzxg.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY
);
```

### Buscar frequência de um servidor
```typescript
const { data } = await supabase
  .from('FrequenciaMensal')
  .select('*')
  .eq('servidor_id', id)
  .eq('mes', mes)
  .eq('ano', ano)
  .single();
```

### Atualizar um dia específico
```typescript
const diasAtualizado = { ...frequencia.dias, [dia]: codigo }; // ex: {"15": "F"}
await supabase
  .from('FrequenciaMensal')
  .upsert({
    servidor_id: id, mes, ano,
    dias: diasAtualizado,
    updated_at: new Date().toISOString()
  }, { onConflict: 'servidor_id,mes,ano' });
```

---

## 🚀 ENTREGÁVEL

Um app React completo, funcional, responsivo e pronto para produção com:
- [ ] CRUD de servidores
- [ ] Grade de frequência mensal interativa
- [ ] Registro de afastamentos
- [ ] Geração de folha de frequência PDF (modelo Prefeitura)
- [ ] Dashboard com KPIs
- [ ] Autenticação com perfis
- [ ] Deploy pronto (Vercel / Render)

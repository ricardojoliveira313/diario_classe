# PROMPT — Segurança de Sessões + Alerta de 3º Dispositivo
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA
**Arquivos-alvo:** `frontend/src/AuthContext.tsx`, Supabase SQL Editor, Supabase Edge Functions
**Branch:** `claude/bold-hamilton-a1Oj6`

---

## CONTEXTO

O sistema permite login simultâneo em múltiplos dispositivos (comportamento atual e aceitável).
O que precisa ser implementado:

- Até **2 dispositivos simultâneos** → normal, sem alarme
- **3º dispositivo** tentando logar → enviar **e-mail de alerta** para o administrador
- O 3º dispositivo ainda pode entrar (não bloquear) — apenas alertar
- E-mail de destino: `ricardodeoliveiraj@gmail.com`

---

## PASSO 1 — Criar tabela `Sessao` no Supabase

Executar no **SQL Editor** do Supabase:

```sql
CREATE TABLE IF NOT EXISTS "Sessao" (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario       text NOT NULL,
  device_id     text NOT NULL,
  ultimo_acesso timestamptz DEFAULT now(),
  ip            text,
  user_agent    text,
  UNIQUE (usuario, device_id)
);

-- Índice para consultas rápidas por usuário
CREATE INDEX IF NOT EXISTS idx_sessao_usuario ON "Sessao" (usuario);

-- RLS: apenas service_role pode escrever (o frontend usa anon key com política aberta)
ALTER TABLE "Sessao" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_sessao" ON "Sessao" FOR ALL USING (true) WITH CHECK (true);
```

---

## PASSO 2 — Criar Supabase Edge Function para envio de e-mail

No painel do Supabase → **Edge Functions** → **New Function** → nome: `alerta-sessao`

Código da função (`index.ts`):

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_DESTINO  = 'ricardodeoliveiraj@gmail.com';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { usuario, device_id, ip, user_agent, sessoes_ativas } = await req.json();

  const corpo = `
    <h2>⚠️ Alerta de Segurança — Diário de Classe</h2>
    <p>Um <strong>3º dispositivo não reconhecido</strong> fez login no sistema.</p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td style="padding:4px 12px;color:#666">Usuário:</td><td><strong>${usuario}</strong></td></tr>
      <tr><td style="padding:4px 12px;color:#666">IP:</td><td>${ip ?? '—'}</td></tr>
      <tr><td style="padding:4px 12px;color:#666">Dispositivo:</td><td style="font-size:12px">${user_agent ?? '—'}</td></tr>
      <tr><td style="padding:4px 12px;color:#666">Sessões ativas:</td><td>${sessoes_ativas}</td></tr>
      <tr><td style="padding:4px 12px;color:#666">Horário:</td><td>${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td></tr>
    </table>
    <p style="color:#666;font-size:12px;margin-top:16px">
      Se foi você, ignore este e-mail.<br>
      Se não foi, acesse o sistema e verifique os acessos ativos.
    </p>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Diário de Classe <alerta@jroapp.com.br>',
      to: [EMAIL_DESTINO],
      subject: `⚠️ 3º dispositivo logado — usuário ${usuario}`,
      html: corpo,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

### Configurar variável de ambiente na Edge Function:
No painel do Supabase → Edge Functions → `alerta-sessao` → **Secrets**:
- `RESEND_API_KEY` = (chave da conta Resend — criar conta gratuita em https://resend.com)

> **Conta Resend gratuita:** 100 e-mails/dia. Suficiente para alertas de segurança.
> Criar conta, verificar domínio ou usar `onboarding@resend.dev` para testes.

---

## PASSO 3 — Atualizar `AuthContext.tsx`

### 3a. Adicionar imports necessários no topo do arquivo:

```typescript
// Adicionar após os imports existentes
const DEVICE_KEY = 'diario_device_id';

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
```

### 3b. Na função `login`, após autenticação bem-sucedida (onde chama `setState`):

Localizar o trecho onde o login é bem-sucedido (após `setState(s)`). Adicionar chamada à função de rastreamento:

```typescript
// Após setState(s) e sessionStorage.setItem(...)
rastrearSessao(usuario.trim(), s.role).catch(() => {});
```

### 3c. Adicionar função `rastrearSessao` logo antes da função `login`:

```typescript
const SUPABASE_URL        = (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY   = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? '';
const EDGE_ALERTA_URL     = `${SUPABASE_URL}/functions/v1/alerta-sessao`;
const SESSOES_SIMULTANEAS = 2; // máximo permitido sem alerta

async function rastrearSessao(usuario: string, _role: string): Promise<void> {
  const deviceId  = getDeviceId();
  const userAgent = navigator.userAgent;
  const agora     = new Date().toISOString();

  // 1. Upsert sessão atual (cria ou atualiza ultimo_acesso)
  await fetch(`${SUPABASE_URL}/rest/v1/Sessao`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ usuario, device_id: deviceId, ultimo_acesso: agora, user_agent: userAgent }),
  });

  // 2. Limpar sessões antigas (sem acesso há mais de 4 horas)
  const limite = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  await fetch(`${SUPABASE_URL}/rest/v1/Sessao?usuario=eq.${encodeURIComponent(usuario)}&ultimo_acesso=lt.${limite}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  // 3. Contar sessões ativas do usuário
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/Sessao?usuario=eq.${encodeURIComponent(usuario)}&select=id`,
    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const sessoes: { id: string }[] = resp.ok ? await resp.json() : [];

  // 4. Se há mais de SESSOES_SIMULTANEAS dispositivos → disparar alerta
  if (sessoes.length > SESSOES_SIMULTANEAS) {
    await fetch(EDGE_ALERTA_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usuario,
        device_id: deviceId,
        ip: null, // IP não disponível no frontend — Edge Function pode capturar pelo header
        user_agent: userAgent,
        sessoes_ativas: sessoes.length,
      }),
    }).catch(() => {}); // não bloquear o login se o alerta falhar
  }
}
```

### 3d. No `logout`, remover sessão do banco:

Localizar a função `logout`:
```typescript
const logout = () => {
  setState(null);
  sessionStorage.removeItem(SESSION_KEY);
};
```

Substituir por:
```typescript
const logout = () => {
  setState(null);
  sessionStorage.removeItem(SESSION_KEY);
  // Remover sessão do banco ao fazer logout
  const deviceId = getDeviceId();
  const stateAtual = state; // captura antes de limpar
  if (stateAtual?.username) {
    fetch(`${SUPABASE_URL}/rest/v1/Sessao?usuario=eq.${encodeURIComponent(stateAtual.username)}&device_id=eq.${deviceId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }).catch(() => {});
  }
};
```

---

## PASSO 4 — Variáveis de ambiente no Render (Frontend)

Verificar se já existem no Render → **diario_classe** → **Environment**:
- `VITE_SUPABASE_URL` — URL do projeto Supabase (ex: `https://xxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` — chave anon do Supabase

Se não existirem, adicionar. Elas já são usadas pelo `api.ts`, então provavelmente já estão lá.

---

## FLUXO COMPLETO

```
Usuário faz login
      ↓
Sistema autentica (VITE_USERS ou tabela Usuario)
      ↓
rastrearSessao() chamada em background
      ↓
Upsert na tabela Sessao (device_id único por aparelho)
      ↓
Limpa sessões > 4h sem acesso
      ↓
Conta sessões ativas
      ↓
≤ 2 dispositivos → tudo normal
> 2 dispositivos → Edge Function dispara e-mail para ricardodeoliveiraj@gmail.com
      ↓
Login concluído normalmente (alerta não bloqueia o acesso)
```

---

## RESUMO DAS TAREFAS

| # | Onde | O que fazer |
|---|---|---|
| 1 | Supabase SQL Editor | Criar tabela `Sessao` |
| 2 | Supabase Edge Functions | Criar função `alerta-sessao` com código acima |
| 3 | Supabase Edge Functions → Secrets | Adicionar `RESEND_API_KEY` |
| 4 | Resend.com | Criar conta gratuita e obter API key |
| 5 | `frontend/src/AuthContext.tsx` | Adicionar `getDeviceId`, `rastrearSessao`, atualizar `login` e `logout` |
| 6 | Render → Environment | Confirmar que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` existem |

---

*Prompt gerado pelo CEREBRO — Branch: claude/bold-hamilton-a1Oj6*

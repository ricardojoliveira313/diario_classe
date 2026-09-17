const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const dig = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const norm = (v: unknown) => String(v ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function origemPermitida(origin: string) {
  if (!origin) return true;
  if (origin === 'https://diario.jroapp.com.br' || origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') return true;
  try {
    const u = new URL(origin);
    return u.protocol === 'https:' && u.hostname.endsWith('.onrender.com');
  } catch {
    return false;
  }
}

function headers(req: Request) {
  const origin = req.headers.get('origin') || '';
  const h: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-censo-token',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'Origin',
    'cache-control': 'no-store',
    'pragma': 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
  if (origemPermitida(origin) && origin) h['access-control-allow-origin'] = origin;
  return h;
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: headers(req) });
}

async function rest(path: string, init: RequestInit = {}) {
  const h = new Headers(init.headers || {});
  h.set('apikey', SERVICE_KEY);
  h.set('authorization', `Bearer ${SERVICE_KEY}`);
  if (init.body && !h.has('content-type')) h.set('content-type', 'application/json');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: h });
  const t = await r.text();
  if (!r.ok) throw new Error(`Banco ${r.status}: ${t.slice(0, 180)}`);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return t; }
}

async function sha256(v: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  return [...h].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function validateToken(raw: string | null) {
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) return null;
  const hash = await sha256(raw);
  const rows = await rest(`CensoSessaoToken?token_hash=eq.${encodeURIComponent(hash)}&select=usuario,expira_em&limit=1`) as any[];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || norm(row.usuario) !== 'RICOJOLIVEIRA' || new Date(row.expira_em).getTime() <= Date.now()) return null;
  return row;
}

function comprovanteUrl(resposta: any) {
  const valor = resposta?.resultado;
  return typeof valor === 'string' && /^https?:\/\//i.test(valor) ? valor : '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== 'POST') return json(req, { ok: false, erro: 'Método não permitido.' }, 405);
  if (!origemPermitida(req.headers.get('origin') || '')) return json(req, { ok: false, erro: 'Origem não autorizada.' }, 403);

  try {
    const session = await validateToken(req.headers.get('x-censo-token'));
    if (!session) return json(req, { ok: false, erro: 'Sessão segura do Censo expirada. Desbloqueie novamente.' }, 401);

    const body = await req.json().catch(() => ({}));
    if (body?.action !== 'list') return json(req, { ok: false, erro: 'Ação não suportada.' }, 400);

    const inicio = '2026-01-01T00:00:00.000Z';
    const rows = await rest(`CensoEnvioLog?status=eq.enviado&criado_em=gte.${encodeURIComponent(inicio)}&select=rf,modalidade,status,criado_em,resposta&order=criado_em.desc&limit=500`) as any[];
    const latest = new Map<string, any>();
    for (const row of Array.isArray(rows) ? rows : []) {
      const rf = dig(row?.rf);
      const modalidade = String(row?.modalidade || '');
      const key = `${rf}|||${modalidade}`;
      if (!rf || latest.has(key)) continue;
      latest.set(key, {
        rf,
        modalidade,
        status: 'enviado',
        criadoEm: String(row?.criado_em || ''),
        comprovanteUrl: comprovanteUrl(row?.resposta),
        confirmadoSecretaria: Boolean(row?.resposta?.reconciliacao_oficial),
        confirmacaoMensagem: String(row?.resposta?.mensagem || ''),
      });
    }

    return json(req, { ok: true, envios: [...latest.values()] });
  } catch (e) {
    console.error('censo-status-envios', e);
    return json(req, { ok: false, erro: 'Não foi possível consultar o histórico de envios do Censo.' }, 500);
  }
});

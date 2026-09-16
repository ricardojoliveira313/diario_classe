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

function dataKey(v: unknown) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}${br[2].padStart(2,'0')}${br[1].padStart(2,'0')}`;
  return dig(s).slice(0, 8);
}

function identidadeFichaValida(dados: any, registro: any, cpf: string) {
  if (!dados) return false;
  const nomeFicha = String(dados.nome ?? '').trim();
  const nomeEdu = String(registro?.nome ?? '').trim();
  const cpfFicha = dig(dados.cpf);
  const nascFicha = dataKey(dados.dataNascimento);
  const nascEdu = dataKey(registro?.data_nascimento);
  if (nomeFicha && nomeEdu && norm(nomeFicha) !== norm(nomeEdu)) return false;
  if (cpfFicha && cpfFicha !== cpf) return false;
  if (nascFicha && nascEdu && nascFicha !== nascEdu) return false;
  return true;
}

function areaPosLocal(curso: unknown) {
  const n = norm(curso);
  if (!n) return '';
  if (
    n.includes('PSICOPEDAG') || n.includes('NEUROPSICOPEDAG') || n.includes('LUDOPEDAG') ||
    n.includes('PEDAGOG') || n.includes('EDUCAC') || n.includes('LIBRAS') ||
    n.includes('DOCENCIA') || n.includes('ALFABET') || n.includes('ENSINO')
  ) return 'Educação';
  return '';
}

async function fichaPorCpf(cpf: string, registro: any) {
  let rows = await rest(`CensoFichaServidor?ano=eq.2026&cpf=eq.${encodeURIComponent(cpf)}&select=rf,nome,cpf,fonte_timestamp,metodo_match,dados&order=fonte_timestamp.desc&limit=2`) as any[];
  let ficha = Array.isArray(rows) ? rows.find((x:any) => identidadeFichaValida(x?.dados, registro, cpf)) || null : null;
  if (ficha) return ficha;

  const profiles = await rest(`profiles?cpf=eq.${encodeURIComponent(cpf)}&select=registro_funcional_rf,nome,cpf,data_nascimento&order=updated_at.desc&limit=2`) as any[];
  const profile = Array.isArray(profiles) ? profiles.find((p:any) => {
    if (registro?.nome && norm(p?.nome) !== norm(registro.nome)) return false;
    if (registro?.data_nascimento && dataKey(p?.data_nascimento) !== dataKey(registro.data_nascimento)) return false;
    return true;
  }) : null;
  if (!profile?.registro_funcional_rf) return null;

  rows = await rest(`CensoFichaServidor?ano=eq.2026&rf=eq.${encodeURIComponent(dig(profile.registro_funcional_rf))}&select=rf,nome,cpf,fonte_timestamp,metodo_match,dados&order=fonte_timestamp.desc&limit=1`) as any[];
  ficha = Array.isArray(rows) ? rows[0] || null : null;
  return ficha && identidadeFichaValida(ficha.dados, registro, cpf) ? ficha : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== 'POST') return json(req, { ok: false, erro: 'Método não permitido.' }, 405);
  if (!origemPermitida(req.headers.get('origin') || '')) return json(req, { ok: false, erro: 'Origem não autorizada.' }, 403);

  try {
    const session = await validateToken(req.headers.get('x-censo-token'));
    if (!session) return json(req, { ok: false, erro: 'Sessão segura do Censo expirada. Desbloqueie novamente.' }, 401);

    const body = await req.json().catch(() => ({}));
    if (body?.action !== 'lookup') return json(req, { ok: false, erro: 'Ação não suportada.' }, 400);

    const cpf = dig(body?.cpf);
    if (cpf.length !== 11) return json(req, { ok: false, erro: 'CPF inválido para consulta da base Educacenso.' }, 400);

    const select = [
      'identificacao_unica','nome','data_nascimento','cpf','nacionalidade_oficial','cor_raca_oficial','sexo',
      'deficiencia_raw','grau_formacao_oficial','pos_graduacao_raw','formacao_complementacao_raw',
      'cursos_especificos_raw','referencia_data','arquivo_nome','importado_em'
    ].join(',');
    const rows = await rest(`EducacensoProfissionalAtual?cpf=eq.${encodeURIComponent(cpf)}&select=${select}&limit=2`) as any[];
    const encontrados = Array.isArray(rows) ? rows : [];

    if (encontrados.length > 1) {
      return json(req, { ok: false, erro: 'Mais de um profissional foi localizado para o mesmo CPF na fotografia atual do Educacenso.' }, 409);
    }

    let registro = encontrados[0] || null;
    let posFonte: 'educacenso' | 'ficha_cadastral' | null = registro ? 'educacenso' : null;

    if (registro && (!String(registro.pos_graduacao_raw ?? '').trim() || String(registro.pos_graduacao_raw).trim() === '-')) {
      const ficha = await fichaPorCpf(cpf, registro);
      const dados = ficha?.dados || null;
      const possui = norm(dados?.posPossui) === 'SIM';
      const cursos = Array.isArray(dados?.posCursos) ? dados.posCursos : [];
      if (possui && cursos.length) {
        const linhas = cursos.map((curso:any) => areaPosLocal(curso)).filter(Boolean).map((area:string) => `Especialização - ${area}`);
        if (linhas.length) {
          registro = { ...registro, pos_graduacao_raw: linhas.join(' | '), pos_graduacao_fonte: 'ficha_cadastral', pos_graduacao_ficha_data: ficha?.fonte_timestamp || null };
          posFonte = 'ficha_cadastral';
        }
      }
    }

    return json(req, {
      ok: true,
      registro,
      match: registro ? 'cpf' : null,
      referenciaData: registro?.referencia_data || null,
      arquivoNome: registro?.arquivo_nome || null,
      posFonte,
    });
  } catch (e) {
    console.error('censo-educacenso-base', e);
    return json(req, { ok: false, erro: 'Não foi possível consultar a base histórica do Educacenso.' }, 500);
  }
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = 'https://diario.jroapp.com.br';

const dig = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const txt = (v: unknown) => String(v ?? '').trim();
const norm = (v: unknown) => txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function origemPermitida(origin: string) {
  if (!origin) return true;
  if (origin === APP_URL || origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') return true;
  try { const u = new URL(origin); return u.protocol === 'https:' && u.hostname.endsWith('.onrender.com'); } catch { return false; }
}

function headers(req: Request) {
  const origin = req.headers.get('origin') || '';
  const h: Record<string,string> = {
    'content-type':'application/json; charset=utf-8',
    'access-control-allow-headers':'authorization, x-client-info, apikey, content-type, x-censo-token',
    'access-control-allow-methods':'POST, OPTIONS',
    'vary':'Origin','cache-control':'no-store','pragma':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  };
  if (origemPermitida(origin) && origin) h['access-control-allow-origin'] = origin;
  return h;
}
function json(req: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: headers(req) }); }
async function rest(path: string, init: RequestInit = {}) {
  const h = new Headers(init.headers || {});
  h.set('apikey', SERVICE_KEY); h.set('authorization', `Bearer ${SERVICE_KEY}`);
  if (init.body && !h.has('content-type')) h.set('content-type','application/json');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers:h });
  const t = await r.text();
  if (!r.ok) throw new Error(`Banco ${r.status}: ${t.slice(0,240)}`);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return t; }
}
async function sha256(v: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  return [...h].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function validateAdmin(raw: string | null) {
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) return null;
  const hash = await sha256(raw);
  const rows = await rest(`CensoSessaoToken?token_hash=eq.${encodeURIComponent(hash)}&select=usuario,expira_em&limit=1`) as any[];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || norm(row.usuario) !== 'RICOJOLIVEIRA' || new Date(row.expira_em).getTime() <= Date.now()) return null;
  return row;
}
async function ultimaCompetencia() {
  const rows=await rest('CensoFrequenciaServidor?select=ano,mes&order=ano.desc,mes.desc&limit=1') as any[];
  return Array.isArray(rows)&&rows[0]?{ano:Number(rows[0].ano),mes:Number(rows[0].mes)}:{ano:2026,mes:9};
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
  if(req.method!=='POST')return json(req,{ok:false,erro:'Método não permitido.'},405);
  if(!origemPermitida(req.headers.get('origin')||''))return json(req,{ok:false,erro:'Origem não autorizada.'},403);
  try{
    const admin=await validateAdmin(req.headers.get('x-censo-token'));
    if(!admin)return json(req,{ok:false,erro:'Sessão segura do Censo expirada. Desbloqueie novamente.'},401);
    const body=await req.json().catch(()=>({}));
    if(txt(body?.action)!=='list')return json(req,{ok:false,erro:'Ação não suportada.'},400);

    const comp=await ultimaCompetencia();
    const [convRows,envRows]=await Promise.all([
      rest(`CensoProfessorConvite?ano=eq.${comp.ano}&select=id,rf,nome,turma,periodo,status,campos,respostas,criado_em,expira_em,respondido_em,conferido_em&order=criado_em.desc&limit=500`),
      rest(`CensoEnvioLog?criado_em=gte.${comp.ano}-01-01T00:00:00.000Z&status=in.(enviado,confirmado_secretaria)&select=rf,status,criado_em&order=criado_em.desc&limit=500`),
    ]) as any[];

    const latestConv=new Map<string,any>();
    for(const c of Array.isArray(convRows)?convRows:[]){const rf=dig(c.rf);if(rf&&!latestConv.has(rf))latestConv.set(rf,c)}
    const latestEnv=new Map<string,any>();
    for(const e of Array.isArray(envRows)?envRows:[]){const rf=dig(e.rf);if(rf&&!latestEnv.has(rf))latestEnv.set(rf,e)}

    const processados:any[]=[];
    for(const [rf,convite] of latestConv){
      const envio=latestEnv.get(rf); if(!envio)continue;
      processados.push({
        rf,
        rfExibicao:txt(convite.rf),
        nome:txt(convite.nome),
        turma:txt(convite.turma),
        periodo:txt(convite.periodo),
        camposPendentes:0,
        campos:[],
        convite,
        envioOficial:{status:txt(envio.status),criado_em:txt(envio.criado_em)},
      });
    }
    processados.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
    return json(req,{ok:true,competencia:comp,processados});
  }catch(e){console.error('censo-professor-status-oficial',e);return json(req,{ok:false,erro:e instanceof Error?e.message:'Falha ao consultar o status oficial da coleta.'},500)}
});

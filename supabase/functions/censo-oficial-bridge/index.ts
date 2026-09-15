const DEPLOYMENT_ID = 'AKfycbxRAI9YowrLP1ffKAV7URQaXWPKaOOV3dqDbxVouD7Q4Jq-lRFJDmVbzbeRahNpDv6STg';
const OFFICIAL_BASE = `https://script.google.com/macros/s/${DEPLOYMENT_ID}`;
const SCHOOL = 'EMEIEF LUIZ GONZAGA';

const MODALIDADES = new Set(['Educação Infantil','Ensino Fundamental Regular','Educação Básica I','Educação Básica II','Educação Física','Arte – Regular','EJA I','EJA II – Arte','EJA II – História','EJA II – Geografia','EJA II – Língua Portuguesa','EJA II – Matemática','EJA II – Ciências','EJA II – Inglês']);
const SEXOS = new Set(['Feminino','Masculino','Não declarado']);
const CORES_RACAS = new Set(['Branca','Preta','Parda','Amarela','Indígena','Não declarada']);
const NACIONALIDADES = new Set(['Brasileiro(a)','Estrangeiro(a)']);
const GRAUS = new Set(['Magistério','Ensino Superior']);
const TIPOS_SUPERIOR = new Set(['Bacharelado','Licenciatura','Sequencial/Curta Duração','Tecnológico']);
const UFS = new Set(['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']);
const TIPOS_POS = new Set(['Especialização','Mestrado','Doutorado']);
const DEFICIENCIAS = new Set(['Baixa Visão','Cegueira','Surdez','Surdocegueira','Deficiência Auditiva','Deficiência Física','Deficiência Intelectual','Deficiência Múltipla','TEA','Visão Monocular','Altas Habilidades / Superdotação','Não possuo deficiência']);
const CURSOS_ESPECIFICOS = new Set(['Creche (0 a 3 anos)','Pré-escola (4 e 5 anos)','Alfabetização','Anos iniciais do ensino fundamental','Anos finais do ensino fundamental','Ensino médio','Educação de jovens e adultos','Educação especial','Educação indígena','Educação do campo','Educação ambiental','Educação em direitos humanos','Educação bilíngue de surdos','Educação e Tecnologia de Informação e Comunicação (TIC)','Educação integral em tempo integral','Gênero e diversidade sexual','Direitos da criança e do adolescente','Educação para as relações étnico-raciais e história e cultura afro-brasileira e africana','Gestão escolar','Outros','Nenhum']);

// Fallback conservador para quando a lista oficial de graduação falhar temporariamente.
// Mantém Pedagogia preenchível a partir da ficha cadastrada sem impedir os demais tipos.
const GRADUACAO_FALLBACK = [
  {tipo:'Licenciatura',area:'Educação',curso:'Pedagogia'},
  {tipo:'Bacharelado',area:'',curso:''},
  {tipo:'Sequencial/Curta Duração',area:'',curso:''},
  {tipo:'Tecnológico',area:'',curso:''},
];
const MUNICIPIO_UF: Record<string,string> = {
  'SANTO ANDRE':'SP','SAO PAULO':'SP','SAO CAETANO DO SUL':'SP','DIADEMA':'SP','MAUA':'SP','POCAO':'PE'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const dig = (v: unknown) => String(v ?? '').replace(/\D/g,'');
const tokenHex = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); return [...b].map(x=>x.toString(16).padStart(2,'0')).join(''); };
async function sha256(v:string){ const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))); return [...h].map(x=>x.toString(16).padStart(2,'0')).join(''); }

function origemPermitida(origin:string){
  if (!origin) return true;
  if (origin === 'https://diario.jroapp.com.br' || origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') return true;
  try { const u = new URL(origin); return u.protocol === 'https:' && u.hostname.endsWith('.onrender.com'); } catch { return false; }
}
function headers(req:Request){
  const origin=req.headers.get('origin')||'';
  const h:Record<string,string>={
    'content-type':'application/json; charset=utf-8',
    'access-control-allow-headers':'authorization, x-client-info, apikey, content-type, x-censo-token',
    'access-control-allow-methods':'POST, OPTIONS',
    'vary':'Origin','cache-control':'no-store','pragma':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer'
  };
  if(origemPermitida(origin)&&origin)h['access-control-allow-origin']=origin;
  return h;
}
function json(req:Request,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:headers(req)})}

async function rest(path:string,init:RequestInit={}){
  const h=new Headers(init.headers||{});h.set('apikey',SERVICE_KEY);h.set('authorization',`Bearer ${SERVICE_KEY}`);if(init.body&&!h.has('content-type'))h.set('content-type','application/json');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...init,headers:h});const t=await r.text();if(!r.ok)throw new Error(`Banco ${r.status}: ${t.slice(0,180)}`);if(!t)return null;try{return JSON.parse(t)}catch{return t}
}
function parseAppsScript(text:string){
  const clean=text.replace(/^\)\]\}'\s*/,'').trim();let arr:any;try{arr=JSON.parse(clean)}catch{throw new Error('Resposta oficial em formato inesperado.')}
  if(!Array.isArray(arr))throw new Error('Resposta oficial inválida.');if(arr.find((x:any)=>Array.isArray(x)&&x[0]==='er'))throw new Error('O formulário oficial recusou a operação.');
  const op=arr.find((x:any)=>Array.isArray(x)&&x[0]==='op.exec');if(!op||!Array.isArray(op[1]))throw new Error('O formulário oficial não retornou resultado.');const p=op[1][1];if(typeof p!=='string')return p;try{return JSON.parse(p)}catch{return p}
}
async function officialCall(fn:string,args:unknown[]=[]){
  const request=[fn,JSON.stringify(args),null,[0],null,null,true,0];const body=`request=${encodeURIComponent(JSON.stringify(request))}`;const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),25000);
  try{const r=await fetch(`${OFFICIAL_BASE}/callback?nocache_id=${Date.now()}_${crypto.randomUUID()}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','x-same-domain':'1'},body,signal:ctrl.signal});const t=await r.text();if(!r.ok)throw new Error(`Formulário oficial HTTP ${r.status}.`);return parseAppsScript(t)}finally{clearTimeout(timer)}
}
async function retryOfficial<T>(call:()=>Promise<T>,attempts=3):Promise<T>{let last:any;for(let i=0;i<attempts;i++){try{return await call()}catch(e){last=e;if(i<attempts-1)await new Promise(r=>setTimeout(r,250*(i+1)))}}throw last}
let optionsCache:{at:number,value:{graduacao:any[];instituicoes:any[];pos:any[]}}|null=null;
async function officialOptions(){
  if(optionsCache&&Date.now()-optionsCache.at<10*60*1000)return optionsCache.value;
  const [graduacao,instituicoes,pos]=await Promise.all([
    retryOfficial(()=>officialCall('obterOpcoesGraduacao')).catch(()=>[]),
    retryOfficial(()=>officialCall('obterOpcoesInstituicoes')).catch(()=>[]),
    retryOfficial(()=>officialCall('obterOpcoesPosGraduacao')).catch(()=>[]),
  ]);
  const grad=Array.isArray(graduacao)&&graduacao.length?graduacao:GRADUACAO_FALLBACK;
  const value={graduacao:grad,instituicoes:Array.isArray(instituicoes)?instituicoes:[],pos:Array.isArray(pos)?pos:[]};
  optionsCache={at:Date.now(),value};return value;
}

async function authenticate(username:string,password:string){
  if(norm(username)!=='RICOJOLIVEIRA'||!password||password.length>256)return null;
  const rows=await rest('rpc/verificar_login_censo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({p_nome:username.trim(),p_senha:password})}) as any[];
  const row=Array.isArray(rows)?rows[0]:null;if(!row||row.bloqueado===true||row.perfil!=='admin'||norm(row.nome)!=='RICOJOLIVEIRA')return null;
  await rest(`CensoSessaoToken?usuario=eq.${encodeURIComponent(username.trim())}`,{method:'DELETE'});
  const raw=tokenHex();const hash=await sha256(raw);const expira=new Date(Date.now()+8*60*60*1000).toISOString();
  await rest('CensoSessaoToken',{method:'POST',headers:{'content-type':'application/json','prefer':'return=minimal'},body:JSON.stringify({token:hash,token_hash:hash,usuario:username.trim(),expira_em:expira})});
  return {token:raw,usuario:username.trim(),expiraEm:expira};
}
async function validateToken(raw:string|null){
  if(!raw||!/^[0-9a-f]{64}$/i.test(raw))return null;const hash=await sha256(raw);const rows=await rest(`CensoSessaoToken?token_hash=eq.${encodeURIComponent(hash)}&select=usuario,expira_em&limit=1`) as any[];const row=Array.isArray(rows)?rows[0]:null;if(!row||norm(row.usuario)!=='RICOJOLIVEIRA'||new Date(row.expira_em).getTime()<=Date.now())return null;return row;
}
function ehDocente(cargo:unknown){const c=norm(cargo);return c.includes('PROFESSOR')||/^PROF\b/.test(c)}
async function attendance(rf:string){const rows=await rest(`CensoFrequenciaServidor?ano=eq.2026&mes=eq.9&rf=eq.${encodeURIComponent(dig(rf))}&select=rf,nome,cargo,lotacao,carga_horaria,pagina_pdf,local_trabalho&limit=2`) as any[];return Array.isArray(rows)?rows.find(x=>dig(x.rf)===dig(rf)&&ehDocente(x.cargo))||null:null}
let profilesCache:{at:number,rows:any[]}|null=null;
async function profiles(){if(profilesCache&&Date.now()-profilesCache.at<300000)return profilesCache.rows;const rows=await rest('profiles?select=id,nome,email,data_nascimento,cpf,endereco,bairro,cep,municipio,estado,telefone_celular_1,telefone_celular_2,telefone_fixo,cargo_funcao,horario_trabalho,registro_funcional_rf,etnia,nome_mae,nome_pai,municipio_nascimento,updated_at&limit=500') as any[];profilesCache={at:Date.now(),rows:Array.isArray(rows)?rows:[]};return profilesCache.rows}
function latest(rows:any[]){return[...rows].sort((a,b)=>new Date(b.updated_at||0).getTime()-new Date(a.updated_at||0).getTime())[0]||null}
async function localSources(rf:string,official:any){
  const all=await profiles();let profile=latest(all.filter(p=>dig(p.registro_funcional_rf)===dig(rf))),profileMatch=profile?'rf':'';
  if(!profile){profile=latest(all.filter(p=>official?.cpf&&dig(p.cpf)===dig(official.cpf)));if(profile)profileMatch='cpf'}
  if(!profile){profile=latest(all.filter(p=>norm(p.nome)===norm(official?.nome)));if(profile)profileMatch='nome'}
  let fichaRows=await rest(`CensoFichaServidor?ano=eq.2026&rf=eq.${encodeURIComponent(dig(rf))}&select=rf,nome,cpf,fonte_timestamp,metodo_match,dados&limit=1`) as any[];
  if((!fichaRows||!fichaRows.length)&&official?.cpf)fichaRows=await rest(`CensoFichaServidor?ano=eq.2026&cpf=eq.${encodeURIComponent(dig(official.cpf))}&select=rf,nome,cpf,fonte_timestamp,metodo_match,dados&limit=1`) as any[];
  let ficha=Array.isArray(fichaRows)?fichaRows[0]||null:null;
  if(ficha?.dados&&!String(ficha.dados.ufNascimento||'').trim()){
    const cidade=norm(ficha.dados.municipioNascimento||profile?.municipio_nascimento||'');const ufNascimento=MUNICIPIO_UF[cidade]||'';
    if(ufNascimento)ficha={...ficha,dados:{...ficha.dados,ufNascimento}};
  }
  let formacoes:any[]=[];if(profile?.id){const f=await rest(`formacoes?profile_id=eq.${encodeURIComponent(profile.id)}&select=tipo,curso,universidade,rede_ensino,modalidade,inicio,termino&order=created_at.asc`) as any[];formacoes=Array.isArray(f)?f:[]}
  return {profile,profileMatch,ficha,formacoes};
}
function arraySomentePermitidos(v:unknown,permitidos:Set<string>){return Array.isArray(v)&&v.every(x=>permitidos.has(String(x)))}
function tupleGradValida(c:any,graduacao:any[]){return graduacao.some((x:any)=>String(x?.tipo||'')===String(c?.tipo||'')&&String(x?.area||'')===String(c?.area||'')&&String(x?.curso||'')===String(c?.curso||''))}
function instValida(c:any,instituicoes:any[]){if(!String(c?.instituicao||'').trim())return true;return instituicoes.some((x:any)=>String(x?.uf||'')===String(c?.ufInstituicao||'')&&String(x?.nome||'')===String(c?.instituicao||'')&&(String(x?.categoria||x?.org||'')===String(c?.categoriaOrg||'')))}
function required(d:any,opcoes:{graduacao:any[];instituicoes:any[];pos:any[]}){
  const p:string[]=[];
  if(d.unidadeEscolar!==SCHOOL)p.push('Unidade Escolar');
  if(!MODALIDADES.has(String(d.modalidade||'')))p.push('Modalidade');
  if(!String(d.cpf||'').trim()||dig(d.cpf).length!==11)p.push('CPF');
  if(!String(d.dataNasc||'').trim())p.push('Data Nasc.');
  if(!String(d.email||'').trim())p.push('E-mail');
  if(!GRAUS.has(String(d.grauFormacao||'')))p.push('Grau de Formação');
  if(String(d.sexo||'')&&!SEXOS.has(String(d.sexo)))p.push('Sexo inválido');
  if(String(d.corRaca||'')&&!CORES_RACAS.has(String(d.corRaca)))p.push('Cor/Raça inválida');
  if(String(d.nacionalidade||'')&&!NACIONALIDADES.has(String(d.nacionalidade)))p.push('Nacionalidade inválida');
  if(String(d.uf||'')&&!UFS.has(String(d.uf)))p.push('UF inválida');
  if(String(d.ufNascimento||'')&&!UFS.has(String(d.ufNascimento)))p.push('UF Nascimento inválida');
  if(Array.isArray(d.deficiencias)&&d.deficiencias.length){if(!arraySomentePermitidos(d.deficiencias,DEFICIENCIAS))p.push('Deficiência inválida');if(d.deficiencias.includes('Não possuo deficiência')&&d.deficiencias.length>1)p.push('Deficiência inconsistente')}
  if(Array.isArray(d.cursosEspecificos)&&d.cursosEspecificos.length){if(!arraySomentePermitidos(d.cursosEspecificos,CURSOS_ESPECIFICOS))p.push('Curso específico inválido');if(d.cursosEspecificos.includes('Nenhum')&&d.cursosEspecificos.length>1)p.push('Cursos específicos inconsistentes')}
  if(Array.isArray(d.cursosSuperiores)){if(d.cursosSuperiores.length>3)p.push('Máximo de 3 cursos superiores');d.cursosSuperiores.forEach((c:any,i:number)=>{if(!(c?.tipo||c?.area||c?.curso))return;if(!TIPOS_SUPERIOR.has(String(c.tipo||'')))p.push(`Tipo do ${i+1}º curso`);if(opcoes.graduacao.length&&!tupleGradValida(c,opcoes.graduacao))p.push(`Combinação do ${i+1}º curso`);if(String(c.ufInstituicao||'')&&!UFS.has(String(c.ufInstituicao)))p.push(`UF instituição do ${i+1}º curso`);if(opcoes.instituicoes.length&&!instValida(c,opcoes.instituicoes))p.push(`Instituição do ${i+1}º curso`)})}
  if(Array.isArray(d.posGraduacoes)){if(d.posGraduacoes.length>6)p.push('Máximo de 6 pós-graduações');const areas=new Set(opcoes.pos.map((x:any)=>String(x?.area||'')).filter(Boolean));d.posGraduacoes.forEach((x:any,i:number)=>{if(!(x?.tipo||x?.area))return;if(!TIPOS_POS.has(String(x.tipo||'')))p.push(`Tipo da ${i+1}ª pós`);if(areas.size&&!areas.has(String(x.area||'')))p.push(`Área da ${i+1}ª pós`)})}
  return [...new Set(p)];
}
async function audit(rf:string,nome:string,usuario:string,status:string,resposta:any,modalidade?:string,requestId?:string){try{await rest('CensoEnvioLog',{method:'POST',headers:{'content-type':'application/json','prefer':'return=minimal'},body:JSON.stringify({rf:dig(rf),nome:String(nome||'').slice(0,200),usuario,status,resposta,modalidade:modalidade||null,request_id:/^[0-9a-f-]{36}$/i.test(String(requestId||''))?requestId:null})})}catch{}}
async function duplicate(rf:string,modalidade:string){const since=new Date(Date.now()-5*60*1000).toISOString();const rows=await rest(`CensoEnvioLog?rf=eq.${encodeURIComponent(dig(rf))}&modalidade=eq.${encodeURIComponent(modalidade)}&status=eq.enviado&criado_em=gte.${encodeURIComponent(since)}&select=id&limit=1`) as any[];return Array.isArray(rows)&&rows.length>0}

Deno.serve(async(req)=>{
  const origin=req.headers.get('origin')||'';if(!origemPermitida(origin))return json(req,{ok:false,erro:'Origem não autorizada.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});if(req.method!=='POST')return json(req,{ok:false,erro:'Método não permitido.'},405);
  try{
    const body=await req.json().catch(()=>({}));const action=String(body?.action||'');
    if(action==='auth'){const session=await authenticate(String(body.username||''),String(body.password||''));if(!session)return json(req,{ok:false,erro:'Senha não reconhecida para o canal do Censo ou acesso temporariamente bloqueado.'},401);return json(req,{ok:true,...session})}
    const session=await validateToken(req.headers.get('x-censo-token'));if(!session)return json(req,{ok:false,erro:'Sessão segura do Censo expirada. Desbloqueie novamente.'},401);
    if(action==='status')return json(req,{ok:true,modo:'direto-seguro',usuario:session.usuario});
    if(action==='logout'){const hash=await sha256(req.headers.get('x-censo-token')||'');await rest(`CensoSessaoToken?token_hash=eq.${encodeURIComponent(hash)}`,{method:'DELETE'});return json(req,{ok:true})}
    if(action==='lookup'||action==='prepare'){
      const rf=dig(body.rf);if(!rf)return json(req,{ok:false,erro:'RF obrigatório.'},400);const freq=await attendance(rf);if(!freq)return json(req,{ok:false,erro:'RF não consta como vínculo docente na frequência oficial de setembro/2026.'},403);const official=await officialCall('buscarServidorCenso',[rf]);if(!official?.sucesso)return json(req,{ok:false,erro:official?.mensagem||'RF não localizado no formulário oficial.'},404);if(action==='lookup')return json(req,{ok:true,official,attendance:freq});
      const [local,opcoesOficiais]=await Promise.all([localSources(rf,official),officialOptions()]);return json(req,{ok:true,official,attendance:freq,local,unidadeEscolar:SCHOOL,opcoesOficiais});
    }
    if(action==='submit'){
      if(body.confirmacaoFinal!==true)return json(req,{ok:false,erro:'A confirmação final é obrigatória.'},400);const d=body.dados||{};const opcoes=await officialOptions();const problems=required(d,opcoes);if(problems.length)return json(req,{ok:false,erro:`Revise os campos: ${problems.join(', ')}.`,campos:problems},400);
      const freq=await attendance(d.rf);if(!freq)return json(req,{ok:false,erro:'RF não consta como vínculo docente na frequência de setembro/2026. Nada foi enviado.'},403);if(body.reenviar!==true&&await duplicate(d.rf,d.modalidade))return json(req,{ok:false,erro:'Este vínculo/modalidade já foi enviado nos últimos 5 minutos. Aguarde antes de reenviar.',duplicado:true},409);
      const official=await officialCall('buscarServidorCenso',[dig(d.rf)]);if(!official?.sucesso)return json(req,{ok:false,erro:'RF deixou de ser reconhecido pelo formulário oficial.'},409);if(norm(official.nome)!==norm(d.nome)||dig(official.cpf)!==dig(d.cpf)){await audit(d.rf,d.nome,session.usuario,'bloqueado_identidade',{motivo:'identidade_divergente'},d.modalidade,body.requestId);return json(req,{ok:false,erro:'Nome/CPF não correspondem ao RF retornado pela Secretaria. Nada foi enviado.'},409)}
      const cursosSuperiores=Array.isArray(d.cursosSuperiores)?d.cursosSuperiores.slice(0,3).filter((c:any)=>c?.tipo||c?.area||c?.curso).map((c:any)=>({tipo:c.tipo||'',area:c.area||'',curso:c.curso||'',instituicao:c.instituicao||'',ano:c.ano||'',entregue:Boolean(c.entregue)})):[];
      const posGraduacoes=Array.isArray(d.posGraduacoes)?d.posGraduacoes.slice(0,6).filter((p:any)=>p?.tipo||p?.area).map((p:any)=>({tipo:p.tipo||'',area:p.area||'',ano:p.ano||'',entregue:Boolean(p.entregue)})):[];
      const payload={rf:dig(d.rf),nome:d.nome,unidadeEscolar:SCHOOL,cpf:d.cpf,dataNasc:d.dataNasc,sexo:d.sexo||'',corRaca:d.corRaca||'',telefone:d.telefone||'',email:d.email,filiacao1:d.nomeMae||'',filiacao2:d.nomePai||'',nacionalidade:d.nacionalidade||'Brasileiro(a)',paisEstrangeiro:d.paisEstrangeiro||'',naturalidade:d.naturalidade||'',ufNascimento:d.ufNascimento||'',deficiencias:(d.deficiencias||[]).join(', '),cep:d.cep||'',rua:d.rua||'',numero:d.numero||'',bairro:d.bairro||'',municipio:d.municipio||'',uf:d.uf||'',modalidades:d.modalidade,grauFormacao:d.grauFormacao,cursosSuperiores,naoPossuiPos:!Boolean(d.possuiPos),posGraduacoes,cursosEspecificos:(d.cursosEspecificos||[]).join(', ')};
      const result=await officialCall('processarFormularioCenso',[payload]);await audit(payload.rf,payload.nome,session.usuario,'enviado',{resultado:result},d.modalidade,body.requestId);return json(req,{ok:true,result,requestId:body.requestId||null});
    }
    return json(req,{ok:false,erro:'Ação desconhecida.'},400);
  }catch(e){return json(req,{ok:false,erro:e instanceof Error?e.message:String(e)},500)}
});
const DEPLOYMENT_ID = 'AKfycbxRAI9YowrLP1ffKAV7URQaXWPKaOOV3dqDbxVouD7Q4Jq-lRFJDmVbzbeRahNpDv6STg';
const OFFICIAL_BASE = `https://script.google.com/macros/s/${DEPLOYMENT_ID}`;
const SCHOOL = 'EMEIEF LUIZ GONZAGA';

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
function graduacaoNormalizada(rows:any[]){
  const base=Array.isArray(rows)?rows.filter(Boolean):[];
  if(!base.length)return [...GRADUACAO_FALLBACK];
  const pedagogia=base.filter((x:any)=>norm(x?.curso)==='PEDAGOGIA'||norm(x?.curso).includes('PEDAGOGIA'));
  const preferida=pedagogia.find((x:any)=>norm(x?.tipo)==='LICENCIATURA'&&norm(x?.area).includes('EDUCACAO'))
    ||pedagogia.find((x:any)=>norm(x?.tipo)==='LICENCIATURA')||pedagogia[0]||null;
  const semPedagogiaExata=base.filter((x:any)=>norm(x?.curso)!=='PEDAGOGIA');
  const canonica=preferida
    ? {tipo:String(preferida.tipo||'Licenciatura'),area:String(preferida.area||'Educação'),curso:'Pedagogia'}
    : {tipo:'Licenciatura',area:'Educação',curso:'Pedagogia'};
  return [...semPedagogiaExata,canonica];
}
let optionsCache:{at:number,value:{graduacao:any[];instituicoes:any[];pos:any[]}}|null=null;
async function officialOptions(){
  if(optionsCache&&Date.now()-optionsCache.at<10*60*1000)return optionsCache.value;
  const [graduacao,instituicoes,pos]=await Promise.all([
    retryOfficial(()=>officialCall('obterOpcoesGraduacao')).catch(()=>[]),
    retryOfficial(()=>officialCall('obterOpcoesInstituicoes')).catch(()=>[]),
    retryOfficial(()=>officialCall('obterOpcoesPosGraduacao')).catch(()=>[]),
  ]);
  const grad=graduacaoNormalizada(Array.isArray(graduacao)?graduacao:[]);
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
type Competencia = {ano:number;mes:number};
function competenciaValida(value:any):Competencia|null{const ano=Number(value?.ano),mes=Number(value?.mes);return Number.isInteger(ano)&&ano>=2020&&ano<=2100&&Number.isInteger(mes)&&mes>=1&&mes<=12?{ano,mes}:null}
async function competenciaMaisRecente(){const rows=await rest('CensoFrequenciaServidor?select=ano,mes&order=ano.desc,mes.desc&limit=1') as any[];return competenciaValida(Array.isArray(rows)?rows[0]:null)}
async function resolveCompetencia(value:any){return competenciaValida(value)||await competenciaMaisRecente()}
function competenciaLabel(c:Competencia){return `${String(c.mes).padStart(2,'0')}/${c.ano}`}
async function attendance(rf:string,c:Competencia){const rows=await rest(`CensoFrequenciaServidor?ano=eq.${c.ano}&mes=eq.${c.mes}&rf=eq.${encodeURIComponent(dig(rf))}&select=ano,mes,rf,nome,cargo,lotacao,carga_horaria,pagina_pdf,local_trabalho&limit=2`) as any[];return Array.isArray(rows)?rows.find(x=>dig(x.rf)===dig(rf)&&ehDocente(x.cargo))||null:null}
let profilesCache:{at:number,rows:any[]}|null=null;
async function profiles(){if(profilesCache&&Date.now()-profilesCache.at<300000)return profilesCache.rows;const rows=await rest('profiles?select=id,nome,email,data_nascimento,cpf,endereco,bairro,cep,municipio,estado,telefone_celular_1,telefone_celular_2,telefone_fixo,cargo_funcao,horario_trabalho,registro_funcional_rf,etnia,nome_mae,nome_pai,municipio_nascimento,updated_at&limit=500') as any[];profilesCache={at:Date.now(),rows:Array.isArray(rows)?rows:[]};return profilesCache.rows}
function latest(rows:any[]){return[...rows].sort((a,b)=>new Date(b.updated_at||0).getTime()-new Date(a.updated_at||0).getTime())[0]||null}
function valorPresente(v:unknown){return String(v??'').trim()!==''}
function dadosPerfilParaFicha(profile:any){
  if(!profile)return{};
  const map:Record<string,unknown>={
    nome:profile.nome,cpf:dig(profile.cpf),email:profile.email,dataNascimento:profile.data_nascimento,
    endereco:profile.endereco,bairro:profile.bairro,cep:profile.cep,municipio:profile.municipio,estado:profile.estado,
    telefone1:profile.telefone_celular_1,telefone2:profile.telefone_celular_2,telefoneFixo:profile.telefone_fixo,
    nomeMae:profile.nome_mae,nomePai:profile.nome_pai,municipioNascimento:profile.municipio_nascimento,etniaReferencia:profile.etnia,
    cargoFuncao:profile.cargo_funcao,horarioTrabalho:profile.horario_trabalho,
  };
  return Object.fromEntries(Object.entries(map).filter(([,v])=>valorPresente(v)));
}
function dataKey(v:unknown){
  const s=String(v??'').trim();if(!s)return'';
  const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(iso)return `${iso[1]}${iso[2]}${iso[3]}`;
  const br=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(br)return `${br[3]}${br[2].padStart(2,'0')}${br[1].padStart(2,'0')}`;
  return dig(s).slice(0,8);
}
function identidadeCompativel(dados:any,official:any){
  if(!dados)return false;
  const nome=String(dados.nome??'').trim(),nomeOficial=String(official?.nome??'').trim();
  const cpf=dig(dados.cpf),cpfOficial=dig(official?.cpf);
  const nasc=dataKey(dados.dataNascimento??dados.data_nascimento),nascOficial=dataKey(official?.dataNascimento);
  if(nome&&nomeOficial&&norm(nome)!==norm(nomeOficial))return false;
  if(cpf&&cpfOficial&&cpf!==cpfOficial)return false;
  if(nasc&&nascOficial&&nasc!==nascOficial)return false;
  return true;
}
function perfilCompativel(profile:any,official:any){return identidadeCompativel({nome:profile?.nome,cpf:profile?.cpf,dataNascimento:profile?.data_nascimento},official)}
function normalizarAcademicoParaCenso(dados:any){
  if(!dados||!Array.isArray(dados.academicoReferencia))return dados;
  const entries=dados.academicoReferencia.map((e:any)=>({...e}));
  const segunda=entries.find((e:any)=>norm(e?.campo).includes('POSSUI 2')&&norm(e?.campo).includes('FORMACAO'));
  if(norm(segunda?.valor)==='SIM'){
    const fimSegundaFormacao=entries.find((e:any)=>Number(e?.coluna)===43);
    const fimSegundaPos=entries.find((e:any)=>Number(e?.coluna)===45);
    if(fimSegundaPos){if(fimSegundaFormacao)fimSegundaFormacao.coluna=143;fimSegundaPos.coluna=43}
  }
  return {...dados,academicoReferencia:entries};
}
function removerAcademicoInseguro(dados:any){
  if(!dados)return dados;const copia={...dados};
  for(const k of ['formacaoPrincipal','universidades','posCursos','posPossui','mestradoPossui','ensinoMedioMagisterio','academicoReferencia'])delete copia[k];
  copia._academico_bloqueado='identidade divergente entre ficha histórica e cadastro oficial';return copia;
}
async function localSources(rf:string,official:any){
  const mestreRows=await rest(`CensoDocenteMestre?ano=eq.2026&rf=eq.${encodeURIComponent(dig(rf))}&select=ano,rf,nome,fonte_arquivo,fonte_timestamp,dados&limit=1`) as any[];
  const mestre=Array.isArray(mestreRows)?mestreRows[0]||null:null;
  const all=await profiles();
  let profile=latest(all.filter(p=>official?.cpf&&dig(p.cpf)===dig(official.cpf)&&perfilCompativel(p,official))),profileMatch=profile?'cpf':'';
  if(!profile){profile=latest(all.filter(p=>dig(p.registro_funcional_rf)===dig(rf)&&perfilCompativel(p,official)));if(profile)profileMatch='rf'}
  if(!profile){profile=latest(all.filter(p=>norm(p.nome)===norm(official?.nome)&&perfilCompativel(p,official)));if(profile)profileMatch='nome'}
  let fichaRows=await rest(`CensoFichaServidor?ano=eq.2026&rf=eq.${encodeURIComponent(dig(rf))}&select=rf,nome,cpf,fonte_timestamp,metodo_match,dados&order=fonte_timestamp.desc&limit=1`) as any[];
  if((!fichaRows||!fichaRows.length)&&official?.cpf)fichaRows=await rest(`CensoFichaServidor?ano=eq.2026&cpf=eq.${encodeURIComponent(dig(official.cpf))}&select=rf,nome,cpf,fonte_timestamp,metodo_match,dados&order=fonte_timestamp.desc&limit=1`) as any[];
  let ficha=Array.isArray(fichaRows)?fichaRows[0]||null:null;
  if(ficha?.dados){
    const origem=ficha.dados._origem_ficha_importada;
    const origemIncompativel=!!origem&&!identidadeCompativel(origem,official);
    const atualIncompativel=!identidadeCompativel(ficha.dados,official);
    if(origemIncompativel||atualIncompativel)ficha={...ficha,metodo_match:`${ficha.metodo_match||'ficha'}:academico_bloqueado`,dados:removerAcademicoInseguro(ficha.dados)};
    else ficha={...ficha,dados:normalizarAcademicoParaCenso(ficha.dados)};
  }
  const fichaData=ficha?.fonte_timestamp?new Date(ficha.fonte_timestamp).getTime():0;
  const perfilData=profile?.updated_at?new Date(profile.updated_at).getTime():0;
  const perfilMaisRecente=!!profile&&perfilData>fichaData;
  if(profile&&(!ficha||perfilMaisRecente)){
    const dados={...(ficha?.dados||{}),...dadosPerfilParaFicha(profile)};
    ficha={...(ficha||{}),rf:dig(rf),nome:profile.nome||official?.nome||ficha?.nome||'',cpf:dig(profile.cpf||official?.cpf||ficha?.cpf),fonte_timestamp:profile.updated_at||ficha?.fonte_timestamp||null,metodo_match:`cadastro_mais_recente:${profileMatch||'perfil'}`,dados};
  }
  if(ficha?.dados&&!String(ficha.dados.ufNascimento||'').trim()){
    const cidade=norm(ficha.dados.municipioNascimento||profile?.municipio_nascimento||'');const ufNascimento=MUNICIPIO_UF[cidade]||'';
    if(ufNascimento)ficha={...ficha,dados:{...ficha.dados,ufNascimento}};
  }
  let formacoes:any[]=[];if(profile?.id){const f=await rest(`formacoes?profile_id=eq.${encodeURIComponent(profile.id)}&status_validacao=in.(validado,importado_confiavel)&select=tipo,curso,universidade,rede_ensino,modalidade,inicio,termino,tipo_oficial,area_oficial,curso_oficial,instituicao_oficial,uf_instituicao,categoria_org,copia_entregue_ue,status_validacao&order=created_at.asc`) as any[];formacoes=Array.isArray(f)?f:[]}
  const fonteCadastro=perfilMaisRecente||(!fichaData&&perfilData)?{tipo:'perfil',data:profile?.updated_at||null}:{tipo:ficha?'ficha':profile?'perfil':'nenhuma',data:ficha?.fonte_timestamp||profile?.updated_at||null};
  return {profile,profileMatch,ficha,formacoes,fonteCadastro,mestre};
}
async function audit(rf:string,nome:string,usuario:string,status:string,resposta:any,modalidade?:string,requestId?:string){try{await rest('CensoEnvioLog',{method:'POST',headers:{'content-type':'application/json','prefer':'return=minimal'},body:JSON.stringify({rf:dig(rf),nome:String(nome||'').slice(0,200),usuario,status,resposta,modalidade:modalidade||null,request_id:/^[0-9a-f-]{36}$/i.test(String(requestId||''))?requestId:null})})}catch{}}

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
      const rf=dig(body.rf);if(!rf)return json(req,{ok:false,erro:'RF obrigatório.'},400);const competencia=await resolveCompetencia(body.competencia);if(!competencia)return json(req,{ok:false,erro:'Não há competência de frequência disponível.'},409);const freq=await attendance(rf,competencia);if(!freq)return json(req,{ok:false,erro:`RF não consta como vínculo docente na frequência oficial de ${competenciaLabel(competencia)}.`},403);const official=await officialCall('buscarServidorCenso',[rf]);if(!official?.sucesso)return json(req,{ok:false,erro:official?.mensagem||'RF não localizado no formulário oficial.'},404);if(action==='lookup')return json(req,{ok:true,official,attendance:freq,competencia});
      const [local,opcoesOficiais]=await Promise.all([localSources(rf,official),officialOptions()]);return json(req,{ok:true,official,attendance:freq,competencia,local,unidadeEscolar:SCHOOL,opcoesOficiais});
    }
    if(action==='submit'){
      const d=body.dados||{};
      const cursosSuperiores=Array.isArray(d.cursosSuperiores)?d.cursosSuperiores.slice(0,3).filter((c:any)=>c?.tipo||c?.area||c?.curso).map((c:any)=>({tipo:c.tipo||'',area:c.area||'',curso:c.curso||'',instituicao:c.instituicao||'',ano:c.ano||'',entregue:Boolean(c.entregue)})):[];
      const posGraduacoes=Array.isArray(d.posGraduacoes)?d.posGraduacoes.slice(0,6).filter((p:any)=>p?.tipo||p?.area).map((p:any)=>({tipo:p.tipo||'',area:p.area||'',ano:p.ano||'',entregue:Boolean(p.entregue)})):[];
      const payload={rf:dig(d.rf),nome:d.nome,unidadeEscolar:SCHOOL,cpf:d.cpf,dataNasc:d.dataNasc,sexo:d.sexo||'',corRaca:d.corRaca||'',telefone:d.telefone||'',email:d.email,filiacao1:d.nomeMae||'',filiacao2:d.nomePai||'',nacionalidade:d.nacionalidade||'Brasileiro(a)',paisEstrangeiro:d.paisEstrangeiro||'',naturalidade:d.naturalidade||'',ufNascimento:d.ufNascimento||'',deficiencias:(d.deficiencias||[]).join(', '),cep:d.cep||'',rua:d.rua||'',numero:d.numero||'',bairro:d.bairro||'',municipio:d.municipio||'',uf:d.uf||'',modalidades:d.modalidade,grauFormacao:d.grauFormacao,cursosSuperiores,naoPossuiPos:d.possuiPos===false,posGraduacoes,cursosEspecificos:(d.cursosEspecificos||[]).join(', ')};
      const dadosCensitariosEnviados={modalidade:payload.modalidades,sexo:payload.sexo,corRaca:payload.corRaca,deficiencias:payload.deficiencias,grauFormacao:payload.grauFormacao,cursosSuperiores:payload.cursosSuperiores,naoPossuiPos:payload.naoPossuiPos,posGraduacoes:payload.posGraduacoes,cursosEspecificos:payload.cursosEspecificos};
      const result=await officialCall('processarFormularioCenso',[payload]);await audit(payload.rf,payload.nome,session.usuario,'enviado',{resultado:result,dadosCensitariosEnviados},d.modalidade,body.requestId);return json(req,{ok:true,result,requestId:body.requestId||null});
    }
    return json(req,{ok:false,erro:'Ação desconhecida.'},400);
  }catch(e){return json(req,{ok:false,erro:e instanceof Error?e.message:String(e)},500)}
});

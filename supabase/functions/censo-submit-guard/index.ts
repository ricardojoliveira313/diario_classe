const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function origemPermitida(origin:string){
  if(!origin)return true;
  if(origin==='https://diario.jroapp.com.br'||origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173')return true;
  try{const u=new URL(origin);return u.protocol==='https:'&&u.hostname.endsWith('.onrender.com')}catch{return false}
}
function headers(req:Request){
  const origin=req.headers.get('origin')||'';
  const h:Record<string,string>={'content-type':'application/json; charset=utf-8','access-control-allow-headers':'authorization, x-client-info, apikey, content-type, x-censo-token','access-control-allow-methods':'POST, OPTIONS','vary':'Origin','cache-control':'no-store'};
  if(origemPermitida(origin)&&origin)h['access-control-allow-origin']=origin;
  return h;
}
function json(req:Request,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:headers(req)})}

function camposAcademicosFaltantes(d:any){
  const faltam:string[]=[];
  if(String(d?.grauFormacao||'')!=='Ensino Superior')return faltam;
  const cursos=Array.isArray(d?.cursosSuperiores)?d.cursosSuperiores:[];
  const informados=cursos.filter((c:any)=>String(c?.tipo||c?.area||c?.curso||c?.ano||c?.ufInstituicao||c?.categoriaOrg||c?.instituicao||'').trim());
  if(!informados.length)return['Curso Superior'];
  informados.forEach((c:any,i:number)=>{
    if(!String(c?.tipo||'').trim())faltam.push(`Tipo do ${i+1}º curso`);
    if(!String(c?.area||'').trim())faltam.push(`Área do ${i+1}º curso`);
    if(!String(c?.curso||'').trim())faltam.push(`Curso do ${i+1}º curso`);
  });
  return[...new Set(faltam)];
}

function camposObrigatoriosFaltantes(d:any){
  const faltam:string[]=[];
  if(!String(d?.unidadeEscolar||'').trim())faltam.push('Unidade Escolar');
  if(!String(d?.modalidade||'').trim())faltam.push('Modalidade');
  if(String(d?.cpf||'').replace(/\D/g,'').length!==11)faltam.push('CPF');
  if(!String(d?.dataNasc||'').trim())faltam.push('Data Nasc.');
  if(!String(d?.email||'').trim())faltam.push('E-mail');
  if(!Array.isArray(d?.deficiencias)||!d.deficiencias.length)faltam.push('Deficiência / TEA / Altas Habilidades');
  if(!String(d?.grauFormacao||'').trim())faltam.push('Grau de Formação');
  faltam.push(...camposAcademicosFaltantes(d));

  if(typeof d?.possuiPos!=='boolean')faltam.push('Situação da Pós-Graduação');
  if(d?.possuiPos===true){
    const pos=Array.isArray(d?.posGraduacoes)?d.posGraduacoes:[];
    if(!pos.length)faltam.push('Pós-Graduação');
    pos.forEach((p:any,i:number)=>{
      if(!String(p?.tipo||'').trim())faltam.push(`Tipo da ${i+1}ª pós`);
      if(!String(p?.area||'').trim())faltam.push(`Área da ${i+1}ª pós`);
      if(!/^\d{4}$/.test(String(p?.ano||'')))faltam.push(`Ano da ${i+1}ª pós`);
    });
  }

  if(!Array.isArray(d?.cursosEspecificos)||!d.cursosEspecificos.length)faltam.push('Cursos específicos de 80h');
  return[...new Set(faltam)];
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
  if(req.method!=='POST')return json(req,{ok:false,erro:'Método não permitido.'},405);
  if(!origemPermitida(req.headers.get('origin')||''))return json(req,{ok:false,erro:'Origem não autorizada.'},403);
  try{
    const body=await req.json().catch(()=>({}));
    if(String(body?.action||'')!=='submit')return json(req,{ok:false,erro:'Ação não suportada por esta proteção.'},400);
    if(body?.confirmacaoFinal!==true)return json(req,{ok:false,erro:'Marque a declaração de conferência antes do envio.',campos:['Declaração de conferência']},400);
    const faltam=camposObrigatoriosFaltantes(body?.dados||{});
    if(faltam.length)return json(req,{ok:false,erro:`Antes de enviar, revise: ${faltam.join(', ')}.`,campos:faltam},400);
    const token=req.headers.get('x-censo-token')||'';
    if(!token)return json(req,{ok:false,erro:'Sessão segura do Censo não informada.'},401);
    const r=await fetch(`${SUPABASE_URL}/functions/v1/censo-oficial-bridge`,{method:'POST',headers:{'content-type':'application/json','apikey':SERVICE_KEY,'authorization':`Bearer ${SERVICE_KEY}`,'x-censo-token':token},body:JSON.stringify(body)});
    const text=await r.text();
    let data:any;try{data=JSON.parse(text)}catch{data={ok:false,erro:text||'Falha na integração oficial.'}}
    return json(req,data,r.status);
  }catch(e){return json(req,{ok:false,erro:e instanceof Error?e.message:String(e)},500)}
});

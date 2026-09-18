import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../api';
import { btn, input, theme } from '../styles';
import { Loading } from '../components';

type Campo = {
  key:string;
  label:string;
  section:string;
  type:'text'|'email'|'date'|'year'|'select'|'boolean'|'textarea';
  options?:string[];
  dependsOn?:{key:string;equals:string};
};
type FormData = {
  nome:string;
  rf:string;
  turma:string;
  periodo:string;
  campos:Campo[];
  respostas:Record<string,any>;
  expiraEm:string;
  status:string;
};

const txt=(v:unknown)=>String(v??'').trim();
function formatRf(rf:string){const d=rf.replace(/\D/g,'');return d.length===6?`${d.slice(0,2)}.${d.slice(2,5)}-${d.slice(5)}`:rf}
function formatDataHora(v:string){const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}

export default function CensoProfessorFormulario(){
  const {token=''}=useParams();
  const[data,setData]=useState<FormData|null>(null),[loading,setLoading]=useState(true),[erro,setErro]=useState(''),[enviando,setEnviando]=useState(false),[concluido,setConcluido]=useState(false),[mensagem,setMensagem]=useState('');
  const[respostas,setRespostas]=useState<Record<string,any>>({});

  const invoke=async(body:Record<string,any>)=>{
    const{data,error}=await supabase.functions.invoke('censo-professor-formulario',{body});
    if(error){let msg=error.message||'Não foi possível abrir o formulário.';const ctx=(error as any).context;try{if(ctx&&typeof ctx.json==='function'){const detail=await ctx.json();if(detail?.erro)msg=detail.erro}}catch{}throw new Error(msg)}
    if(!data?.ok)throw new Error(data?.erro||'Operação não autorizada.');return data;
  };

  useEffect(()=>{let ativo=true;(async()=>{setLoading(true);setErro('');try{const r=await invoke({action:'public-load',token});if(!ativo)return;if(r.concluido){setConcluido(true);setMensagem('Este formulário já foi conferido pela escola. Obrigado.');return}const d:FormData={nome:r.nome||'',rf:r.rf||'',turma:r.turma||'',periodo:r.periodo||'',campos:Array.isArray(r.campos)?r.campos:[],respostas:r.respostas||{},expiraEm:r.expiraEm||'',status:r.status||'aberto'};setData(d);setRespostas(d.respostas)}catch(e:any){if(ativo)setErro(e?.message||'Link inválido ou expirado.')}finally{if(ativo)setLoading(false)}})();return()=>{ativo=false}},[token]);

  const keysSolicitadas=useMemo(()=>new Set((data?.campos||[]).map(c=>c.key)),[data]);
  const visivel=(c:Campo)=>!c.dependsOn||!keysSolicitadas.has(c.dependsOn.key)||txt(respostas[c.dependsOn.key])===c.dependsOn.equals;
  const camposVisiveis=useMemo(()=>data?.campos.filter(visivel)||[],[data,respostas,keysSolicitadas]);
  const secoes=useMemo(()=>[...new Set(camposVisiveis.map(c=>c.section))],[camposVisiveis]);
  const set=(key:string,value:any)=>setRespostas(r=>({...r,[key]:value}));

  const enviar=async()=>{
    if(!data)return;
    const faltando=camposVisiveis.filter(c=>c.type==='boolean'?typeof respostas[c.key]!=='boolean':!txt(respostas[c.key]));
    if(faltando.length){setErro(`Preencha os campos restantes: ${faltando.slice(0,3).map(c=>c.label).join(', ')}${faltando.length>3?'…':''}`);return}
    setEnviando(true);setErro('');try{const r=await invoke({action:'public-submit',token,respostas});setConcluido(true);setMensagem(r.mensagem||'Informações enviadas com sucesso.')}catch(e:any){setErro(e?.message||'Não foi possível enviar as informações.')}finally{setEnviando(false)}
  };

  if(loading)return<div style={{maxWidth:760,margin:'40px auto',padding:20}}><Loading/></div>;
  if(erro&&!data&&!concluido)return<div style={{maxWidth:680,margin:'45px auto',padding:24,background:theme.card,border:`1px solid ${theme.danger}55`,borderRadius:theme.radiusMd,boxShadow:theme.shadow}}><h1 style={{fontSize:21,color:theme.text,marginTop:0}}>Censo Docentes 2026</h1><div style={{color:theme.danger,fontWeight:800}}>{erro}</div><p style={{color:theme.textSecondary,lineHeight:1.5}}>Solicite à escola um novo link individual.</p></div>;
  if(concluido)return<div style={{maxWidth:680,margin:'45px auto',padding:24,background:theme.card,border:`1px solid ${theme.success}55`,borderRadius:theme.radiusMd,boxShadow:theme.shadow,textAlign:'center'}}><div style={{fontSize:42}}>✅</div><h1 style={{fontSize:22,color:theme.text}}>Informações recebidas</h1><p style={{color:theme.textSecondary,lineHeight:1.6}}>{mensagem}</p><p style={{color:theme.textMuted,fontSize:12}}>Nada é enviado ao formulário oficial automaticamente. A escola fará a conferência primeiro.</p></div>;
  if(!data)return null;

  return<div style={{minHeight:'100vh',background:theme.bg,padding:'24px 14px'}}><main style={{maxWidth:780,margin:'0 auto'}}>
    <section style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:theme.radiusMd,boxShadow:theme.shadow,padding:20,marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:900,color:theme.primaryText}}>EMEIEF LUIZ GONZAGA</div>
      <h1 style={{margin:'5px 0 6px',fontSize:24,color:theme.text}}>👩‍🏫 Complemento cadastral — Censo Docentes 2026</h1>
      <p style={{margin:0,color:theme.textSecondary,lineHeight:1.55}}>Preencha somente as informações que ainda estão faltando no cadastro da escola. As respostas serão conferidas pela administração antes de qualquer envio oficial.</p>
      <div style={{marginTop:14,padding:12,borderRadius:9,background:'var(--ghost-bg)',border:`1px solid ${theme.border}`}}><div style={{color:theme.text,fontWeight:900}}>{data.nome}</div><div style={{color:theme.textSecondary,fontSize:12,marginTop:4}}>RF {formatRf(data.rf)}{data.turma?` · ${data.turma}`:''}{data.periodo?` · ${data.periodo}`:''}</div><div style={{color:theme.textMuted,fontSize:10.5,marginTop:5}}>Link válido até {formatDataHora(data.expiraEm)}.</div></div>
    </section>

    {erro&&<div style={{marginBottom:12,padding:11,borderRadius:8,background:`${theme.danger}10`,border:`1px solid ${theme.danger}55`,color:theme.danger,fontSize:12,fontWeight:800}}>{erro}</div>}

    {camposVisiveis.length===0?<section style={{background:theme.card,border:`1px solid ${theme.success}55`,borderRadius:theme.radiusMd,padding:18,color:theme.success,fontWeight:850}}>✓ Não há informação pendente neste link.</section>:secoes.map(secao=><section key={secao} style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:theme.radiusMd,boxShadow:theme.shadow,padding:16,marginBottom:12}}><h2 style={{fontSize:15,color:theme.text,margin:'0 0 11px'}}>{secao}</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:10}}>{camposVisiveis.filter(c=>c.section===secao).map(c=><label key={c.key} style={{display:'grid',gap:5,gridColumn:c.type==='textarea'?'1 / -1':undefined}}><span style={{color:theme.textSecondary,fontSize:11,fontWeight:850}}>{c.label} *</span>{c.type==='select'?<select style={{...input,width:'100%'}} value={txt(respostas[c.key])} onChange={e=>set(c.key,e.target.value)}><option value="">Selecione...</option>{(c.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>:c.type==='boolean'?<div style={{display:'flex',gap:10,alignItems:'center',minHeight:38}}><label style={{display:'flex',gap:6,alignItems:'center',color:theme.textSecondary}}><input type="radio" name={c.key} checked={respostas[c.key]===true} onChange={()=>set(c.key,true)}/>Sim</label><label style={{display:'flex',gap:6,alignItems:'center',color:theme.textSecondary}}><input type="radio" name={c.key} checked={respostas[c.key]===false} onChange={()=>set(c.key,false)}/>Não</label></div>:c.type==='textarea'?<textarea style={{...input,width:'100%',minHeight:88,resize:'vertical'}} value={txt(respostas[c.key])} onChange={e=>set(c.key,e.target.value)} placeholder="Informe conforme seu certificado ou documentação."/>:<input style={{...input,width:'100%'}} type={c.type==='year'?'number':c.type} min={c.type==='year'?1950:undefined} max={c.type==='year'?new Date().getFullYear()+1:undefined} value={txt(respostas[c.key])} onChange={e=>set(c.key,e.target.value)} />}</label>)}</div></section>)}

    {camposVisiveis.length>0&&<section style={{background:theme.card,border:`1px solid ${theme.success}55`,borderRadius:theme.radiusMd,padding:16,marginBottom:30}}><div style={{color:theme.textSecondary,fontSize:12,lineHeight:1.5}}>Ao enviar, suas informações ficarão <strong>aguardando conferência da escola</strong>. Elas não são encaminhadas automaticamente à Secretaria.</div><button style={{...btn('success'),width:'100%',marginTop:12,padding:'11px 14px'}} disabled={enviando} onClick={enviar}>{enviando?'Enviando...':'✅ Enviar informações para conferência'}</button></section>}
  </main></div>;
}

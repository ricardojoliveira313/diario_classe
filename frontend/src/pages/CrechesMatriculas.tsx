import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { supabase } from '../api';
import { useAuth } from '../AuthContext';

type Registro = {
  creche: string; nome: string; ra: string; data_nascimento: string;
  periodo: string; deficiencia_sinalizada: boolean; ordem_combo: number;
};
type Modelo = 'completo' | 'gestao' | 'gestao1';

const PAGINAS: Record<Modelo, number> = { completo: 16, gestao: 8, gestao1: 10 };
const ROTULOS: Record<Modelo, string> = {
  completo: 'Combo completo', gestao: 'Combo Gestão',
  gestao1: 'Combo Gestão 1 — com autorização de retirada',
};
const CHAVE = 'creches_matriculas_2027_token';

function dataBR(valor: string) {
  const m = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

function validar(valor: unknown): Registro[] {
  const lista = Array.isArray(valor) ? valor : (valor as any)?.registros;
  if (!Array.isArray(lista) || !lista.length || lista.length > 500) throw new Error('Arquivo de importação inválido.');
  const ordem = new Set<number>();
  return lista.map((r: any, i: number) => {
    const item = {
      creche: String(r.creche || '').trim(), nome: String(r.nome || '').trim(),
      ra: String(r.ra || '').trim(), data_nascimento: String(r.data_nascimento || r.dataNascimento || '').trim(),
      periodo: String(r.periodo || '').trim(), deficiencia_sinalizada: Boolean(r.deficiencia_sinalizada ?? r.deficienciaSinalizada),
      ordem_combo: Number(r.ordem_combo),
    };
    if (!item.creche || !item.nome || !item.ra || !/^\d{2}\/\d{2}\/\d{4}$/.test(item.data_nascimento) ||
      !['Manhã', 'Manha', 'Tarde'].includes(item.periodo) || !Number.isInteger(item.ordem_combo) || ordem.has(item.ordem_combo)) {
      throw new Error(`Confira o registro ${i + 1} da base.`);
    }
    ordem.add(item.ordem_combo);
    if (item.periodo === 'Manha') item.periodo = 'Manhã';
    return item;
  });
}

export default function CrechesMatriculas() {
  const { username } = useAuth();
  const [token, setToken] = useState(() => sessionStorage.getItem(CHAVE) || '');
  const [senha, setSenha] = useState('');
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [creche, setCreche] = useState('');
  const [modelo, setModelo] = useState<Modelo>('gestao1');
  const [pdf, setPdf] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.rpc('listar_creche_matricula_2027', { p_token: token })
      .then(({ data, error }) => {
        if (error) {
          sessionStorage.removeItem(CHAVE);
          setToken('');
          setErro('A sessão venceu. Confirme sua senha novamente.');
          return;
        }
        setRegistros(data || []);
      });
  }, [token]);

  const creches = useMemo(() => [...new Set(registros.map(r => r.creche))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [registros]);
  const alunos = useMemo(() => registros.filter(r => r.creche === creche).sort((a,b) => a.ordem_combo - b.ordem_combo), [registros, creche]);

  const carregar = async (sessao = token) => {
    const { data, error } = await supabase.rpc('listar_creche_matricula_2027', { p_token: sessao });
    if (error) throw error;
    setRegistros(data || []);
  };

  const entrar = async () => {
    setErro(''); setCarregando(true);
    try {
      const { data, error } = await supabase.rpc('iniciar_sessao_creches_2027', { p_usuario: username || '', p_senha: senha });
      if (error || !data?.token) throw error || new Error('Sessão não criada.');
      sessionStorage.setItem(CHAVE, data.token); setToken(data.token); setSenha('');
      await carregar(data.token); setStatus('Área protegida liberada.');
    } catch { setErro('Senha inválida ou usuário sem autorização para esta área.'); }
    finally { setCarregando(false); }
  };

  const importar = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]; if (!arquivo) return;
    setErro(''); setCarregando(true);
    try {
      const itens = validar(JSON.parse(await arquivo.text()));
      const { error } = await supabase.rpc('substituir_creche_matricula_2027', { p_token: token, p_registros: itens, p_origem_nome: arquivo.name });
      if (error) throw error;
      await carregar(); setCreche(''); setStatus(`${itens.length} alunos importados com segurança.`);
    } catch (x: any) { setErro(x?.message || 'Não foi possível importar a base.'); }
    finally { setCarregando(false); e.target.value = ''; }
  };

  const imprimirLista = () => {
    const linhas = alunos.map((a, i) => `<tr><td>${i+1}</td><td>${a.nome}${a.deficiencia_sinalizada ? ' ♥' : ''}</td><td>${a.ra}</td><td></td><td></td><td></td></tr>`).join('');
    const w = window.open('', '_blank'); if (!w) return setErro('Autorize pop-ups para imprimir.');
    w.opener = null;
    w.document.write(`<!doctype html><title>Controle — ${creche}</title><style>@page{size:A4;margin:13mm}body{font-family:Arial}h2,p{text-align:center;margin:4px}table{border-collapse:collapse;width:100%;margin-top:15px;font-size:11px}th,td{border:1px solid #111;padding:8px}th{background:#e8eef5;font-size:9px}</style><h2>EMEIEF LUIZ GONZAGA</h2><p><b>CONTROLE DE MATRÍCULA E UNIFORME — 2027</b><br>${creche}</p><table><thead><tr><th>Nº</th><th>Nome da criança</th><th>RA</th><th>Nº uniforme</th><th>Data atendimento</th><th>Assinatura do responsável</th></tr></thead><tbody>${linhas}</tbody></table><script>window.onload=()=>window.print()<\/script>`);
    w.document.close();
  };

  const gerar = async () => {
    if (!pdf || !alunos.length) return;
    setErro(''); setCarregando(true);
    try {
      const origem = await PDFDocument.load(await pdf.arrayBuffer());
      const saida = await PDFDocument.create(); const porAluno = PAGINAS[modelo];
      for (const aluno of alunos) {
        const inicio = aluno.ordem_combo * porAluno;
        const paginas = Array.from({ length: porAluno }, (_, i) => inicio + i);
        if (paginas[paginas.length - 1] >= origem.getPageCount()) throw new Error('O PDF mestre não corresponde ao modelo escolhido.');
        (await saida.copyPages(origem, paginas)).forEach(p => saida.addPage(p));
      }
      const blob = new Blob([await saida.save() as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `${creche.replace(/[^a-z0-9]+/gi, '_')}_${modelo}_2027.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus(`PDF gerado: ${alunos.length} combos de ${creche}.`);
    } catch (x: any) { setErro(x?.message || 'Falha ao montar o PDF.'); }
    finally { setCarregando(false); }
  };

  const caixa: React.CSSProperties = { background:'#fff', border:'1px solid #d7e0ea', borderRadius:10, padding:18, marginBottom:16 };
  const botao: React.CSSProperties = { background:'#1e4d75', color:'#fff', border:0, borderRadius:7, padding:'10px 13px', fontWeight:700, cursor:'pointer' };

  if (!token) return <div style={{ ...caixa, maxWidth:540, margin:'40px auto' }}>
    <h2>🏫 Creches — Matrículas 2027</h2><p>Confirme sua senha para acessar a base protegida.</p>
    <label>Usuário</label><input value={username || ''} disabled style={{width:'100%',padding:9,boxSizing:'border-box',margin:'6px 0 12px'}} />
    <label>Senha</label><input autoFocus type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==='Enter'&&entrar()} style={{width:'100%',padding:9,boxSizing:'border-box',margin:'6px 0 12px'}} />
    {erro && <p style={{color:'#b42318'}}>{erro}</p>}<button onClick={entrar} disabled={carregando || !senha} style={{...botao,width:'100%'}}>{carregando ? 'Acessando...' : 'Acessar área protegida'}</button>
  </div>;

  return <div>
    <h1 style={{color:'#1e4d75'}}>🏫 Creches — Matrículas 2027</h1>
    <p>Base conferida dos ofícios em PDF e impressão por creche.</p>
    {erro && <p style={{color:'#b42318',fontWeight:700}}>{erro}</p>}{status && <p style={{color:'#166534',fontWeight:700}}>{status}</p>}
    <section style={caixa}><h2 style={{fontSize:17,marginTop:0}}>1. Base oficial em PDF</h2><p>A base conferida dos ofícios em PDF já está carregada no sistema. Não há arquivo JSON para você importar.</p><p>{registros.length ? `${registros.length} alunos em ${creches.length} creches, extraídos e conferidos a partir dos ofícios.` : 'Carregando a base oficial...'}</p></section>
    <section style={caixa}><h2 style={{fontSize:17,marginTop:0}}>2. Imprimir por creche</h2>
      <select value={creche} onChange={e=>setCreche(e.target.value)} disabled={!registros.length} style={{padding:10,minWidth:300}}><option value="">Selecione a creche...</option>{creches.map(c=><option key={c}>{c}</option>)}</select>
      {creche && <><p><b>{creche}</b> — {alunos.length} aluno(s)</p><div style={{maxHeight:220,overflow:'auto',border:'1px solid #d7e0ea'}}>{alunos.map((a,i)=><div key={a.ra} style={{padding:7,borderBottom:'1px solid #e7edf3'}}>{i+1}. {a.nome}{a.deficiencia_sinalizada?' ♥':''} — RA {a.ra} — {dataBR(a.data_nascimento)} — {a.periodo}</div>)}</div><button style={{...botao,marginTop:12}} onClick={imprimirLista}>🖨 Imprimir lista de controle</button></>}
    </section>
    <section style={caixa}><h2 style={{fontSize:17,marginTop:0}}>3. Combos individuais</h2><p>Selecione o PDF mestre já gerado. O Diário separará somente os combos da creche escolhida, sem alterar sua qualidade.</p>
      <select value={modelo} onChange={e=>setModelo(e.target.value as Modelo)} style={{padding:9,marginRight:10}}>{(Object.keys(ROTULOS) as Modelo[]).map(m=><option key={m} value={m}>{ROTULOS[m]}</option>)}</select>
      <input type="file" accept=".pdf,application/pdf" onChange={e=>setPdf(e.target.files?.[0] || null)} disabled={!creche}/>
      <div><button style={{...botao,marginTop:12}} onClick={gerar} disabled={!pdf || !alunos.length || carregando}>{carregando?'Montando...':'📄 Gerar todos os combos desta creche'}</button></div>
    </section>
  </div>;
}
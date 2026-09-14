import { useEffect, useMemo, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { supabase } from '../api';
import { useAuth } from '../AuthContext';

type Registro = {
  creche: string; nome: string; ra: string; data_nascimento: string;
  periodo: string; deficiencia_sinalizada: boolean; ordem_combo: number;
};
type Modelo = 'completo' | 'gestao' | 'gestao1';
type InfoPdf = {
  arquivo_nome: string; tamanho: number; atualizado_por: string; atualizado_em: string;
};

const PAGINAS: Record<Modelo, number> = { completo: 16, gestao: 8, gestao1: 10 };
const ROTULOS: Record<Modelo, string> = {
  completo: 'Combo completo', gestao: 'Combo Gestão',
  gestao1: 'Combo Gestão 1 — com autorização de retirada',
};
const MODELOS = Object.keys(ROTULOS) as Modelo[];
const CHAVE = 'creches_matriculas_2027_token';
const BUCKET = 'creches-matriculas-2027';

function dataBR(valor: string) {
  const m = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

function tamanhoBR(bytes: number) {
  if (!bytes) return '';
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export default function CrechesMatriculas() {
  const { username } = useAuth();
  const [token, setToken] = useState(() => sessionStorage.getItem(CHAVE) || '');
  const [senha, setSenha] = useState('');
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [creche, setCreche] = useState('');
  const [modelo, setModelo] = useState<Modelo>('gestao1');
  const [pdfs, setPdfs] = useState<Partial<Record<Modelo, InfoPdf>>>({});
  const [podeImportar, setPodeImportar] = useState(false);
  const [arquivosAdmin, setArquivosAdmin] = useState<Partial<Record<Modelo, File>>>({});
  const [enviando, setEnviando] = useState<Modelo | null>(null);
  const [status, setStatus] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const chamarPdfs = async (corpo: Record<string, unknown>, sessao = token) => {
    const { data, error } = await supabase.functions.invoke('creches-pdfs-2027', {
      body: corpo,
      headers: { 'x-creches-token': sessao },
    });
    if (error || data?.erro) throw new Error(data?.erro || error?.message || 'Falha ao acessar os PDFs.');
    return data;
  };

  const consultarPdfs = async (sessao = token) => {
    const data = await chamarPdfs({ acao: 'status' }, sessao);
    setPdfs(data.modelos || {});
    setPodeImportar(Boolean(data.pode_importar));
  };

  const carregar = async (sessao = token) => {
    const [{ data, error }] = await Promise.all([
      supabase.rpc('listar_creche_matricula_2027', { p_token: sessao }),
      consultarPdfs(sessao),
    ]);
    if (error) throw error;
    setRegistros(data || []);
  };

  useEffect(() => {
    if (!token) return;
    carregar(token).catch(() => {
      sessionStorage.removeItem(CHAVE);
      setToken('');
      setErro('A sessão venceu ou a base não pôde ser carregada. Confirme sua senha novamente.');
    });
  }, [token]);

  const creches = useMemo(() => [...new Set(registros.map(r => r.creche))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [registros]);
  const alunos = useMemo(() => registros.filter(r => r.creche === creche)
    .sort((a, b) => a.ordem_combo - b.ordem_combo), [registros, creche]);

  const entrar = async () => {
    setErro(''); setCarregando(true);
    try {
      const { data, error } = await supabase.rpc('iniciar_sessao_creches_2027', {
        p_usuario: username || '', p_senha: senha,
      });
      if (error || !data?.token) throw error || new Error('Sessão não criada.');
      sessionStorage.setItem(CHAVE, data.token);
      setToken(data.token); setSenha('');
      await carregar(data.token);
      setStatus('Área protegida liberada.');
    } catch {
      setErro('Senha inválida ou usuário sem autorização para esta área.');
    } finally { setCarregando(false); }
  };

  const imprimirLista = () => {
    const linhas = alunos.map((a, i) => `<tr><td>${i + 1}</td><td>${a.nome}${a.deficiencia_sinalizada ? ' ♥' : ''}</td><td>${a.ra}</td><td></td><td></td><td></td></tr>`).join('');
    const w = window.open('', '_blank');
    if (!w) return setErro('Autorize pop-ups para imprimir.');
    w.opener = null;
    w.document.write(`<!doctype html><title>Controle — ${creche}</title><style>@page{size:A4;margin:13mm}body{font-family:Arial}h2,p{text-align:center;margin:4px}table{border-collapse:collapse;width:100%;margin-top:15px;font-size:11px}th,td{border:1px solid #111;padding:8px}th{background:#e8eef5;font-size:9px}</style><h2>EMEIEF LUIZ GONZAGA</h2><p><b>CONTROLE DE MATRÍCULA E UNIFORME — 2027</b><br>${creche}</p><table><thead><tr><th>Nº</th><th>Nome da criança</th><th>RA</th><th>Nº uniforme</th><th>Data atendimento</th><th>Assinatura do responsável</th></tr></thead><tbody>${linhas}</tbody></table><script>window.onload=()=>window.print()<\/script>`);
    w.document.close();
  };

  const gerar = async () => {
    if (!alunos.length || !pdfs[modelo]) return;
    setErro(''); setCarregando(true);
    try {
      setStatus('Carregando o PDF mestre armazenado...');
      const liberacao = await chamarPdfs({ acao: 'url', modelo });
      const resposta = await fetch(liberacao.url);
      if (!resposta.ok) throw new Error('Não foi possível baixar o PDF mestre armazenado.');
      const origem = await PDFDocument.load(await resposta.arrayBuffer());
      const saida = await PDFDocument.create();
      const porAluno = PAGINAS[modelo];
      for (const aluno of alunos) {
        const inicio = aluno.ordem_combo * porAluno;
        const paginas = Array.from({ length: porAluno }, (_, i) => inicio + i);
        if (paginas[paginas.length - 1] >= origem.getPageCount()) {
          throw new Error('O PDF mestre armazenado não corresponde ao modelo escolhido.');
        }
        (await saida.copyPages(origem, paginas)).forEach(p => saida.addPage(p));
      }
      const blob = new Blob([await saida.save() as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${creche.replace(/[^a-z0-9]+/gi, '_')}_${modelo}_2027.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus(`PDF gerado: ${alunos.length} combos de ${creche}.`);
    } catch (x: any) {
      setErro(x?.message || 'Falha ao montar o PDF.');
      setStatus('');
    } finally { setCarregando(false); }
  };

  const enviarMestre = async (m: Modelo) => {
    const arquivo = arquivosAdmin[m];
    if (!arquivo) return;
    setErro(''); setEnviando(m);
    try {
      const cabecalho = new TextDecoder().decode(await arquivo.slice(0, 5).arrayBuffer());
      if (!arquivo.name.toLowerCase().endsWith('.pdf') || cabecalho !== '%PDF-') {
        throw new Error('Selecione um arquivo PDF válido.');
      }
      setStatus(`Enviando ${ROTULOS[m]}...`);
      const preparo = await chamarPdfs({
        acao: 'upload_url', modelo: m, arquivo_nome: arquivo.name, tamanho: arquivo.size,
      });
      const { error: erroUpload } = await supabase.storage.from(BUCKET)
        .uploadToSignedUrl(preparo.caminho, preparo.upload_token, arquivo, {
          contentType: 'application/pdf',
          cacheControl: '3600',
        });
      if (erroUpload) throw erroUpload;
      await chamarPdfs({
        acao: 'confirmar_upload', modelo: m, caminho: preparo.caminho,
        arquivo_nome: arquivo.name, tamanho: arquivo.size,
      });
      setArquivosAdmin(v => ({ ...v, [m]: undefined }));
      await consultarPdfs();
      setStatus(`${ROTULOS[m]} atualizado. A nova versão já está disponível para todos.`);
    } catch (x: any) {
      setErro(x?.message || 'Não foi possível armazenar o PDF.');
      setStatus('');
    } finally { setEnviando(null); }
  };

  const caixa: React.CSSProperties = {
    background: '#fff', color: '#111827', border: '1px solid #d7e0ea',
    borderRadius: 10, padding: 18, marginBottom: 16,
  };
  const botao: React.CSSProperties = {
    background: '#1e4d75', color: '#fff', border: 0, borderRadius: 7,
    padding: '10px 13px', fontWeight: 700, cursor: 'pointer',
  };

  if (!token) return <div style={{ ...caixa, maxWidth: 540, margin: '40px auto' }}>
    <h2>🏫 Creches — Matrículas 2027</h2>
    <p>Confirme sua senha para acessar a base protegida.</p>
    <label>Usuário</label>
    <input value={username || ''} disabled style={{ width: '100%', padding: 9, boxSizing: 'border-box', margin: '6px 0 12px' }} />
    <label>Senha</label>
    <input autoFocus type="password" value={senha} onChange={e => setSenha(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && entrar()}
      style={{ width: '100%', padding: 9, boxSizing: 'border-box', margin: '6px 0 12px' }} />
    {erro && <p style={{ color: '#b42318' }}>{erro}</p>}
    <button onClick={entrar} disabled={carregando || !senha} style={{ ...botao, width: '100%' }}>
      {carregando ? 'Acessando...' : 'Acessar área protegida'}
    </button>
  </div>;

  return <div>
    <h1 style={{ color: '#f8fafc', marginBottom: 6 }}>🏫 Creches — Matrículas 2027</h1>
    <p style={{ color: '#f8fafc', marginTop: 0 }}>Base conferida dos ofícios em PDF e impressão por creche.</p>
    {erro && <p style={{ color: '#ffb4ab', fontWeight: 700 }}>{erro}</p>}
    {status && <p style={{ color: '#86efac', fontWeight: 700 }}>{status}</p>}

    <section style={caixa}>
      <h2 style={{ fontSize: 17, marginTop: 0, color: '#1e4d75' }}>1. Base oficial</h2>
      <p>A base conferida dos ofícios já está carregada no sistema. Os funcionários não precisam importar arquivos.</p>
      <p>{registros.length
        ? `${registros.length} alunos em ${creches.length} creches, extraídos e conferidos a partir dos ofícios.`
        : 'Carregando a base oficial...'}</p>
    </section>

    <section style={caixa}>
      <h2 style={{ fontSize: 17, marginTop: 0, color: '#1e4d75' }}>2. Imprimir por creche</h2>
      <select value={creche} onChange={e => setCreche(e.target.value)} disabled={!registros.length}
        style={{ padding: 10, minWidth: 300 }}>
        <option value="">Selecione a creche...</option>
        {creches.map(c => <option key={c}>{c}</option>)}
      </select>
      {creche && <>
        <p><b>{creche}</b> — {alunos.length} aluno(s)</p>
        <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #d7e0ea' }}>
          {alunos.map((a, i) => <div key={a.ra} style={{ padding: 7, borderBottom: '1px solid #e7edf3' }}>
            {i + 1}. {a.nome}{a.deficiencia_sinalizada ? ' ♥' : ''} — RA {a.ra} — {dataBR(a.data_nascimento)} — {a.periodo}
          </div>)}
        </div>
        <button style={{ ...botao, marginTop: 12 }} onClick={imprimirLista}>🖨 Imprimir lista de controle</button>
      </>}
    </section>

    <section style={caixa}>
      <h2 style={{ fontSize: 17, marginTop: 0, color: '#1e4d75' }}>3. Combos individuais</h2>
      <p>Escolha a creche e o modelo. O PDF mestre já fica armazenado no sistema; não é necessário importar.</p>
      <select value={modelo} onChange={e => setModelo(e.target.value as Modelo)}
        style={{ padding: 9, marginRight: 10 }}>
        {MODELOS.map(m => <option key={m} value={m}>{ROTULOS[m]}{pdfs[m] ? '' : ' — aguardando administrador'}</option>)}
      </select>
      <div>
        <button style={{ ...botao, marginTop: 12 }} onClick={gerar}
          disabled={!pdfs[modelo] || !alunos.length || carregando}>
          {carregando ? 'Montando...' : '📄 Gerar todos os combos desta creche'}
        </button>
      </div>
      {!pdfs[modelo] && <p style={{ color: '#9a3412', fontWeight: 700 }}>
        Este modelo ficará disponível assim que o administrador enviar o PDF mestre uma única vez.
      </p>}
    </section>

    {podeImportar && <section style={{ ...caixa, border: '2px solid #1e4d75' }}>
      <h2 style={{ fontSize: 17, marginTop: 0, color: '#1e4d75' }}>4. Administração dos PDFs — acesso exclusivo</h2>
      <p>Envie cada PDF mestre uma única vez. Use esta área somente quando precisar substituir uma versão.</p>
      {MODELOS.map(m => <div key={m} style={{ padding: '12px 0', borderTop: '1px solid #d7e0ea' }}>
        <div style={{ marginBottom: 7 }}><b>{ROTULOS[m]}</b><br />
          {pdfs[m]
            ? <small>Armazenado: {pdfs[m]!.arquivo_nome} — {tamanhoBR(pdfs[m]!.tamanho)} — atualizado em {new Date(pdfs[m]!.atualizado_em).toLocaleString('pt-BR')}</small>
            : <small style={{ color: '#9a3412' }}>Ainda não enviado.</small>}
        </div>
        <input key={pdfs[m]?.atualizado_em || m} type="file" accept=".pdf,application/pdf"
          onChange={e => setArquivosAdmin(v => ({ ...v, [m]: e.target.files?.[0] }))} />
        <button style={{ ...botao, marginLeft: 8, opacity: arquivosAdmin[m] ? 1 : .55 }}
          onClick={() => enviarMestre(m)} disabled={!arquivosAdmin[m] || enviando !== null}>
          {enviando === m ? 'Enviando...' : pdfs[m] ? 'Substituir PDF' : 'Enviar PDF'}
        </button>
      </div>)}
    </section>}
  </div>;
}

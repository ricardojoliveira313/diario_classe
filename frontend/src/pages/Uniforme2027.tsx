import { useEffect, useMemo, useState } from 'react';
import { api, supabase } from '../api';
import { useAuth } from '../AuthContext';

type Turma = { id: string; nome: string; professora?: string; periodo?: string; tipo?: string };
type Aluno = {
  id: string; turmaId: string; nome: string; numero?: number; ra: string | number;
  situacao?: string; turma_destino?: string; rematricula?: boolean;
};
type Registro = {
  aluno_ra: string | number; aluno_id: string; aluno_nome: string;
  turma_2026_id: string; turma_2026: string; turma_2027: string;
  professora: string; periodo: string; permanente: boolean;
  tamanho_verao: string; tamanho_inverno: string; data_solicitacao: string;
  responsavel: string; servidor_coleta: string;
  entregue_verao: boolean; data_entrega_verao: string;
  entregue_inverno: boolean; data_entrega_inverno: string;
  observacoes: string;
};

const CHAVE = 'uniforme_2027_token';
const TAMANHOS = ['1', '2', '4', '6', '8', '10', '12', '14', '16', 'P', 'M', 'G', 'GG', 'EG'];

function turmaRegular(nome: string) {
  return /^(1ª ETAPA|2ª ETAPA|[1-5]º ano)\b/i.test(nome.trim());
}

function turmaDemanda(nome: string) {
  return /^2ª ETAPA\b/i.test(nome.trim());
}

function turmaQuintoAno(nome: string) {
  return /^5º ano\b/i.test(nome.trim());
}

function demandaConfirmada(aluno: Aluno) {
  return aluno.rematricula === true && Boolean(aluno.turma_destino?.trim());
}

function turmaSeguinte(nome: string) {
  const atual = nome.trim();
  if (/^1ª ETAPA\b/i.test(atual)) return atual.replace(/^1ª ETAPA/i, '2ª ETAPA');
  if (/^2ª ETAPA\b/i.test(atual)) return 'Aguardando definição de demanda';
  const m = atual.match(/^([1-5])º ano/i);
  if (m) {
    const ano = Number(m[1]);
    if (ano < 5) return atual.replace(/^[1-5]º ano/i, `${ano + 1}º ano`);
  }
  return atual;
}

function esc(valor: unknown) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] || c));
}

function dataBR(valor: string) {
  if (!valor) return '____/____/________';
  const [a, m, d] = valor.split('-');
  return a && m && d ? `${d}/${m}/${a}` : valor;
}

export default function Uniforme2027() {
  const { username } = useAuth();
  const [token, setToken] = useState(() => sessionStorage.getItem(CHAVE) || '');
  const [senha, setSenha] = useState('');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [salvos, setSalvos] = useState<Record<string, any>>({});
  const [dados, setDados] = useState<Record<string, Registro>>({});
  const [turmaId, setTurmaId] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregar = async (sessao = token) => {
    setCarregando(true);
    try {
      const [listaTurmas, listaAlunos, uniforme] = await Promise.all([
        api.getTurmas(),
        api.getAllAlunos(),
        supabase.rpc('listar_uniforme_2027', { p_token: sessao }),
      ]);
      if (uniforme.error) throw uniforme.error;
      setTurmas((listaTurmas || []).filter((t: Turma) => turmaRegular(t.nome)));
      setAlunos((listaAlunos || []).filter((a: Aluno) => (a.situacao || '').toUpperCase() === 'ATIVO'));
      const mapa: Record<string, any> = {};
      for (const r of uniforme.data || []) mapa[String(r.aluno_ra)] = r;
      setSalvos(mapa);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    carregar(token).catch(() => {
      sessionStorage.removeItem(CHAVE);
      setToken('');
      setErro('A sessão venceu. Confirme sua senha novamente.');
    });
  }, [token]);

  const entrar = async () => {
    setErro(''); setMensagem(''); setCarregando(true);
    try {
      const { data, error } = await supabase.rpc('iniciar_sessao_uniforme_2027', {
        p_usuario: username || '', p_senha: senha,
      });
      if (error || !data?.token) throw error || new Error('Sessão não criada.');
      sessionStorage.setItem(CHAVE, data.token);
      setToken(data.token); setSenha('');
      await carregar(data.token);
      setMensagem('Controle de uniformes liberado.');
    } catch {
      setErro('Senha inválida ou usuário sem permissão para Uniforme 2027.');
    } finally {
      setCarregando(false);
    }
  };

  const turma = turmas.find(t => t.id === turmaId);
  const alunosTurma = useMemo(() => alunos
    .filter(a => a.turmaId === turmaId)
    .sort((a, b) => (a.numero || 999) - (b.numero || 999) || a.nome.localeCompare(b.nome, 'pt-BR')),
  [alunos, turmaId]);

  useEffect(() => {
    if (!turma) { setDados({}); return; }
    const novos: Record<string, Registro> = {};
    for (const aluno of alunosTurma) {
      const chave = String(aluno.ra);
      const salvo = salvos[chave];
      novos[chave] = {
        aluno_ra: aluno.ra, aluno_id: aluno.id, aluno_nome: aluno.nome,
        turma_2026_id: turma.id, turma_2026: turma.nome,
        turma_2027: turmaDemanda(turma.nome) && demandaConfirmada(aluno)
          ? aluno.turma_destino!.trim()
          : salvo?.turma_2027 || turmaSeguinte(turma.nome),
        professora: salvo?.professora || turma.professora || '',
        periodo: salvo?.periodo || turma.periodo || '',
        permanente: Boolean(salvo?.permanente),
        tamanho_verao: salvo?.tamanho_verao || '',
        tamanho_inverno: salvo?.tamanho_inverno || '',
        data_solicitacao: salvo?.data_solicitacao || '',
        responsavel: salvo?.responsavel || '',
        servidor_coleta: salvo?.servidor_coleta || '',
        entregue_verao: Boolean(salvo?.entregue_verao),
        data_entrega_verao: salvo?.data_entrega_verao || '',
        entregue_inverno: Boolean(salvo?.entregue_inverno),
        data_entrega_inverno: salvo?.data_entrega_inverno || '',
        observacoes: salvo?.observacoes || '',
      };
    }
    setDados(novos);
  }, [turmaId, turma, alunosTurma, salvos]);

  const atualizar = (ra: string | number, campo: keyof Registro, valor: any) => {
    const chave = String(ra);
    setDados(atual => ({ ...atual, [chave]: { ...atual[chave], [campo]: valor } }));
  };

  const aguardandoDemanda = turma ? turmaDemanda(turma.nome) : false;
  const quintoAno = turma ? turmaQuintoAno(turma.nome) : false;
  const incluidos = alunosTurma.filter(a =>
    aguardandoDemanda ? demandaConfirmada(a) :
    quintoAno ? dados[String(a.ra)]?.permanente :
    true
  );
  const pendentesDemanda = aguardandoDemanda ? alunosTurma.length - incluidos.length : 0;
  const preenchidosVerao = incluidos.filter(a => dados[String(a.ra)]?.tamanho_verao).length;
  const preenchidosInverno = incluidos.filter(a => dados[String(a.ra)]?.tamanho_inverno).length;

  const salvar = async () => {
    if (!turma || !alunosTurma.length) return;
    setErro(''); setMensagem(''); setSalvando(true);
    try {
      const registros = alunosTurma
        .filter(a => !aguardandoDemanda && !quintoAno ||
          demandaConfirmada(a) ||
          dados[String(a.ra)]?.permanente ||
          Boolean(salvos[String(a.ra)]))
        .map(a => dados[String(a.ra)])
        .filter(Boolean);
      const { data, error } = await supabase.rpc('salvar_uniforme_2027', {
        p_token: token, p_registros: registros,
      });
      if (error) throw error;
      await carregar();
      setMensagem(`${data || registros.length} registro(s) da turma salvos com segurança.`);
    } catch (x: any) {
      setErro(x?.message || 'Não foi possível salvar os uniformes.');
    } finally {
      setSalvando(false);
    }
  };

  const gradeTamanhos = (selecionado: string) => TAMANHOS
    .map(t => `<td>${selecionado === t ? 'X' : ''}</td>`).join('');

  const imprimirTermos = () => {
    if (!turma || !incluidos.length) return;
    const paginas = incluidos.map(aluno => {
      const r = dados[String(aluno.ra)];
      const vias = ['VIA ESCOLA — ENTREGA DO UNIFORME DE VERÃO', 'VIA ESCOLA — ENTREGA DO UNIFORME DE INVERNO', 'VIA RESPONSÁVEL']
        .map(titulo => `<div class="via"><div class="via-titulo">${titulo}</div><b>Aluno(a):</b> ${esc(aluno.nome)}<br>
          <b>Turma 2027:</b> ${esc(r.turma_2027)} &nbsp; <b>Período:</b> ${esc(r.periodo)}
          <table><tr><th>Uniforme</th>${TAMANHOS.map(t => `<th>${t}</th>`).join('')}</tr>
          <tr><th>Verão</th>${gradeTamanhos(r.tamanho_verao)}</tr>
          <tr><th>Inverno</th>${gradeTamanhos(r.tamanho_inverno)}</tr></table>
          <div class="assinatura">Ass. Responsável: ______________________________________________ Data: ____/____/________</div>
        </div>`).join('');

      return `<div class="page">
        <div class="cabecalho"><b>SECRETARIA DA EDUCAÇÃO</b><br>Departamento de Educação Infantil e Fundamental<br>
          <strong>EMEIEF LUIZ GONZAGA</strong></div>
        <h2>TERMO DE SOLICITAÇÃO DE UNIFORME ESCOLAR 2027</h2>
        <div class="campos">
          <b>Nome do(a) aluno(a):</b> ${esc(aluno.nome)}<br>
          <b>Professor(a):</b> ${esc(r.professora)} &nbsp;&nbsp; <b>Período:</b> ${esc(r.periodo)}<br>
          <b>Ano/Ciclo/Modalidade em 2027:</b> ${esc(r.turma_2027)}<br>
          <b>Data da matrícula/rematrícula:</b> ${dataBR(r.data_solicitacao)}<br>
          Eu, <span class="linha">${esc(r.responsavel)}</span>, responsável pelo(a) aluno(a) acima,
          responsabilizo-me pela escolha dos tamanhos referentes aos uniformes escolares de verão e inverno,
          conforme assinalado abaixo, e estou ciente de que não haverá troca de tamanho, inclusive no momento da retirada.
        </div>
        <table class="tamanhos"><tr><th>Uniforme</th>${TAMANHOS.map(t => `<th>${t}</th>`).join('')}</tr>
          <tr><th>Verão</th>${gradeTamanhos(r.tamanho_verao)}</tr>
          <tr><th>Inverno</th>${gradeTamanhos(r.tamanho_inverno)}</tr></table>
        <p class="centro">Santo André, ____ de ____________________ de 2026.</p>
        <p>Assinatura do responsável: _________________________________________________</p>
        <p>Servidor responsável pela coleta: ${esc(r.servidor_coleta) || '________________________________________'}</p>
        ${vias}
      </div>`;
    }).join('');

    const w = window.open('', '_blank');
    if (!w) return setErro('Autorize pop-ups para imprimir.');
    w.opener = null;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Uniformes 2027 — ${esc(turma.nome)}</title>
      <style>
        @page{size:A4;margin:7mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#000;margin:0}
        .page{height:282mm;page-break-after:always;border:2px solid #315e91;padding:5mm;font-size:11px}
        .page:last-child{page-break-after:auto}.cabecalho{text-align:center;line-height:1.25}.cabecalho strong{font-size:15px}
        h2{text-align:center;text-decoration:underline;font-size:14px;margin:7px}.campos{line-height:1.55}
        .linha{display:inline-block;min-width:360px;border-bottom:1px solid #000}.centro{text-align:center}
        table{border-collapse:collapse;width:100%;table-layout:fixed;margin:5px 0}th,td{border:1px solid #111;text-align:center;padding:3px;font-size:9px}
        th:first-child{width:56px}.tamanhos td{font-weight:bold;font-size:12px;height:21px}
        .via{border-top:1px dashed #333;margin-top:8px;padding-top:6px;line-height:1.35}
        .via-titulo{text-align:right;font-size:8px;font-weight:bold;margin-bottom:2px}
        .via table{margin:3px 0}.assinatura{margin-top:4px}
      </style></head><body>${paginas}<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  const imprimirLista = () => {
    if (!turma || !incluidos.length) return;
    const linhas = incluidos.map((a, i) => {
      const r = dados[String(a.ra)];
      return `<tr><td>${i + 1}</td><td>${esc(a.nome)}</td><td>${esc(a.ra)}</td><td>${esc(r.turma_2027)}</td>
        <td>${esc(r.tamanho_verao)}</td><td>${esc(r.tamanho_inverno)}</td><td>${r.entregue_verao ? 'SIM' : ''}</td>
        <td>${r.entregue_inverno ? 'SIM' : ''}</td><td></td></tr>`;
    }).join('');
    const w = window.open('', '_blank');
    if (!w) return setErro('Autorize pop-ups para imprimir.');
    w.opener = null;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Controle de Uniformes</title>
      <style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial}h2,p{text-align:center;margin:4px}
      table{border-collapse:collapse;width:100%;font-size:10px;margin-top:12px}th,td{border:1px solid #111;padding:6px}
      th{background:#e5edf6}</style></head><body><h2>EMEIEF LUIZ GONZAGA</h2>
      <p><b>CONTROLE DE UNIFORMES 2027</b><br>${esc(turma.nome)} — ${esc(turma.professora || '')} — ${esc(turma.periodo || '')}</p>
      <table><thead><tr><th>Nº</th><th>Aluno(a)</th><th>RA</th><th>Turma 2027</th><th>Verão</th><th>Inverno</th>
      <th>Entregue verão</th><th>Entregue inverno</th><th>Assinatura</th></tr></thead><tbody>${linhas}</tbody></table>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  const caixa: React.CSSProperties = {
    background: '#fff', color: '#111827', border: '1px solid #d7e0ea',
    borderRadius: 10, padding: 18, marginBottom: 16,
  };
  const botao: React.CSSProperties = {
    background: '#1e4d75', color: '#fff', border: 0, borderRadius: 7,
    padding: '10px 13px', fontWeight: 700, cursor: 'pointer',
  };
  const input: React.CSSProperties = { padding: 7, border: '1px solid #94a3b8', borderRadius: 5 };

  if (!token) return <div style={{ ...caixa, maxWidth: 540, margin: '40px auto' }}>
    <h2>👕 Uniforme 2027</h2>
    <p>Confirme sua senha para acessar o controle protegido.</p>
    <label>Usuário</label>
    <input value={username || ''} disabled style={{ ...input, width: '100%', margin: '6px 0 12px', boxSizing: 'border-box' }} />
    <label>Senha</label>
    <input autoFocus type="password" value={senha} onChange={e => setSenha(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && entrar()}
      style={{ ...input, width: '100%', margin: '6px 0 12px', boxSizing: 'border-box' }} />
    {erro && <p style={{ color: '#b42318' }}>{erro}</p>}
    <button onClick={entrar} disabled={carregando || !senha} style={{ ...botao, width: '100%' }}>
      {carregando ? 'Acessando...' : 'Acessar Uniforme 2027'}
    </button>
  </div>;

  return <div>
    <h1 style={{ color: '#f8fafc', marginBottom: 6 }}>👕 Uniforme 2027</h1>
    <p style={{ color: '#f8fafc', marginTop: 0 }}>Solicitação e entrega de uniformes de verão e inverno por turma.</p>
    {erro && <p style={{ color: '#ffb4ab', fontWeight: 700 }}>{erro}</p>}
    {mensagem && <p style={{ color: '#86efac', fontWeight: 700 }}>{mensagem}</p>}

    <section style={caixa}>
      <h2 style={{ fontSize: 17, marginTop: 0, color: '#1e4d75' }}>1. Selecionar turma atual — 2026</h2>
      <select value={turmaId} onChange={e => { setTurmaId(e.target.value); setMensagem(''); }}
        disabled={carregando} style={{ ...input, minWidth: 330 }}>
        <option value="">Selecione a turma...</option>
        {[...turmas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(t =>
          <option key={t.id} value={t.id}>{t.nome} — {t.professora} — {t.periodo}</option>)}
      </select>
      {turma && <p>
        <b>Progressão prevista:</b> {turma.nome} → {turmaSeguinte(turma.nome)}.
        {aguardandoDemanda && <span style={{ color: '#9a3412', fontWeight: 700 }}>
          {' '}A coleta ficará bloqueada até o sistema confirmar a turma de destino da criança na EMEIEF Luiz Gonzaga.
        </span>}
        {quintoAno && <span style={{ color: '#9a3412', fontWeight: 700 }}>
          {' '}O 5º ano não participa da rematrícula; marque somente os alunos permanentes.
        </span>}
      </p>}
    </section>

    {turma && <section style={caixa}>
      <h2 style={{ fontSize: 17, marginTop: 0, color: '#1e4d75' }}>2. Controle da turma</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span><b>{incluidos.length}</b> aluno(s) incluído(s)</span>
        <span><b>{preenchidosVerao}</b> verão preenchido(s)</span>
        <span><b>{preenchidosInverno}</b> inverno preenchido(s)</span>
        {aguardandoDemanda && <span style={{ color: '#9a3412' }}><b>{pendentesDemanda}</b> aguardando definição de demanda</span>}
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid #d7e0ea' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1500, fontSize: 12 }}>
          <thead><tr style={{ background: '#e8eef5' }}>
            {['Nº / Aluno', 'Turma 2027', 'Situação', 'Uniforme verão', 'Uniforme inverno',
              'Data solicitação', 'Responsável', 'Servidor da coleta', 'Verão entregue',
              'Data verão', 'Inverno entregue', 'Data inverno', 'Observações'].map(h =>
              <th key={h} style={{ border: '1px solid #cbd5e1', padding: 7 }}>{h}</th>)}
          </tr></thead>
          <tbody>{alunosTurma.map((a, i) => {
            const r = dados[String(a.ra)];
            if (!r) return null;
            const confirmadoDemanda = demandaConfirmada(a);
            const habilitado = aguardandoDemanda ? confirmadoDemanda : quintoAno ? r.permanente : true;
            const td: React.CSSProperties = { border: '1px solid #d7e0ea', padding: 5, verticalAlign: 'top' };
            return <tr key={a.id} style={{ opacity: habilitado ? 1 : .58, background: habilitado ? '#fff' : '#f8fafc' }}>
              <td style={{ ...td, minWidth: 210 }}><b>{i + 1}. {a.nome}</b><br /><small>RA {a.ra}</small></td>
              <td style={td}><input value={r.turma_2027} onChange={e => atualizar(a.ra, 'turma_2027', e.target.value)}
                disabled={!habilitado} style={{ ...input, width: 115 }} /></td>
              <td style={{ ...td, textAlign: 'center', minWidth: 125 }}>
                {aguardandoDemanda
                  ? <span style={{ color: confirmadoDemanda ? '#166534' : '#9a3412', fontWeight: 700 }}>
                      {confirmadoDemanda ? 'Demanda definida' : 'Aguardando demanda'}
                    </span>
                  : quintoAno
                    ? <label><input type="checkbox" checked={r.permanente}
                        onChange={e => atualizar(a.ra, 'permanente', e.target.checked)}
                        title="Incluir como aluno permanente" /> Permanente</label>
                    : 'Rematrícula'}
              </td>
              <td style={td}><select value={r.tamanho_verao} disabled={!habilitado}
                onChange={e => atualizar(a.ra, 'tamanho_verao', e.target.value)} style={input}>
                <option value="">—</option>{TAMANHOS.map(t => <option key={t}>{t}</option>)}</select></td>
              <td style={td}><select value={r.tamanho_inverno} disabled={!habilitado}
                onChange={e => atualizar(a.ra, 'tamanho_inverno', e.target.value)} style={input}>
                <option value="">—</option>{TAMANHOS.map(t => <option key={t}>{t}</option>)}</select></td>
              <td style={td}><input type="date" value={r.data_solicitacao} disabled={!habilitado}
                onChange={e => atualizar(a.ra, 'data_solicitacao', e.target.value)} style={input} /></td>
              <td style={td}><input value={r.responsavel} disabled={!habilitado}
                onChange={e => atualizar(a.ra, 'responsavel', e.target.value)} style={{ ...input, width: 160 }} /></td>
              <td style={td}><input value={r.servidor_coleta} disabled={!habilitado}
                onChange={e => atualizar(a.ra, 'servidor_coleta', e.target.value)} style={{ ...input, width: 140 }} /></td>
              <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={r.entregue_verao}
                disabled={!habilitado} onChange={e => atualizar(a.ra, 'entregue_verao', e.target.checked)} /></td>
              <td style={td}><input type="date" value={r.data_entrega_verao} disabled={!habilitado}
                onChange={e => atualizar(a.ra, 'data_entrega_verao', e.target.value)} style={input} /></td>
              <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={r.entregue_inverno}
                disabled={!habilitado} onChange={e => atualizar(a.ra, 'entregue_inverno', e.target.checked)} /></td>
              <td style={td}><input type="date" value={r.data_entrega_inverno} disabled={!habilitado}
                onChange={e => atualizar(a.ra, 'data_entrega_inverno', e.target.value)} style={input} /></td>
              <td style={td}><input value={r.observacoes} disabled={!habilitado}
                onChange={e => atualizar(a.ra, 'observacoes', e.target.value)} style={{ ...input, width: 170 }} /></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <button style={botao} onClick={salvar} disabled={salvando || carregando}>
          {salvando ? 'Salvando...' : '💾 Salvar turma'}
        </button>
        <button style={{ ...botao, background: '#166534' }} onClick={imprimirTermos} disabled={!incluidos.length}>
          🖨 Imprimir termos individuais
        </button>
        <button style={{ ...botao, background: '#475569' }} onClick={imprimirLista} disabled={!incluidos.length}>
          📋 Imprimir lista da turma
        </button>
      </div>
    </section>}
  </div>;
}

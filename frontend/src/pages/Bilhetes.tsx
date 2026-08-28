import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { btn, card, input, label, theme, isAtivo } from '../styles';
import { useTheme } from '../ThemeContext';
import { useAno } from '../AnoContext';
import { useAuth } from '../AuthContext';

type Escopo = 'infantil' | 'fundamental' | 'professora' | 'turma' | 'aluno';

const MODELOS = [
  { id: 'conselho', icon: '📚', nome: 'Conselho de Ciclo', titulo: 'COMUNICADO — CONSELHO DE CICLO', texto: 'Informamos aos senhores pais ou responsáveis que, em razão do Conselho de Ciclo, os alunos do {etapa} terão horário excepcional de entrada e saída.{horarios}' },
  { id: 'nao_aula', icon: '📅', nome: 'Não haverá aula', titulo: 'COMUNICADO IMPORTANTE', texto: 'Informamos aos senhores pais ou responsáveis que, na data de {data}, não haverá aula.' },
  { id: 'horario', icon: '⏰', nome: 'Horário excepcional', titulo: 'COMUNICADO — HORÁRIO EXCEPCIONAL', texto: 'Informamos aos senhores pais ou responsáveis que os alunos do {etapa} terão horário excepcional nesta data.{horarios}' },
  { id: 'reuniao', icon: '👨‍👩‍👧', nome: 'Reunião com responsáveis', titulo: 'CONVOCAÇÃO DE RESPONSÁVEL', texto: 'Solicitamos o comparecimento do responsável pelo(a) aluno(a) {aluno} nesta Unidade Escolar, em {data}. Motivo/observação: ' },
  { id: 'documentos', icon: '📄', nome: 'Solicitação de documentos', titulo: 'SOLICITAÇÃO DE DOCUMENTOS', texto: 'Solicitamos aos senhores pais ou responsáveis que encaminhem à escola os seguintes documentos referentes ao(à) aluno(a) {aluno}: ' },
  { id: 'saude', icon: '🩺', nome: 'Orientação de saúde', titulo: 'ORIENTAÇÃO À FAMÍLIA', texto: 'Prezados pais ou responsáveis, identificamos a necessidade de atenção especial à saúde do(a) aluno(a) {aluno}. Solicitamos que verifiquem a situação e, se necessário, procurem orientação de um profissional de saúde antes do retorno à escola. Observação: ' },
  { id: 'livre', icon: '✏️', nome: 'Bilhete livre', titulo: 'COMUNICADO À FAMÍLIA', texto: '' },
];

function hojeISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function formatarData(valor: string) {
  if (!valor) return '';
  return new Date(valor + 'T12:00:00').toLocaleDateString('pt-BR');
}
function etapaDaTurma(nome: string) {
  return /(infantil|etapa|ciclo)/i.test(nome) ? 'Educação Infantil' : 'Ensino Fundamental';
}
function escaparHtml(valor: string) {
  return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function textoComQuebras(valor: string) {
  return escaparHtml(valor).replace(/\\n/g, '<br>');
}
function htmlImpressao(titulo: string, paginas: any[][]) {
  const secoes = paginas.map((bilhetes: any[], indice: number) => {
    const cards = bilhetes.map((b: any) => '<article class="bilhete">' +
      '<div class="decor decor-a">✎</div><div class="decor decor-b">📚</div>' +
      '<div class="marca">✦ EMEIEF LUIZ GONZAGA</div>' +
      '<h2>' + escaparHtml(titulo) + '</h2>' +
      '<div class="linha"></div>' +
      '<p class="destino">À família do(a) aluno(a): <strong>' + escaparHtml(b.aluno) + '</strong></p>' +
      '<p class="meta">' + escaparHtml(b.turma) + (b.professora ? ' · Prof.ª ' + escaparHtml(b.professora) : '') + '</p>' +
      '<div class="corpo">' + textoComQuebras(b.mensagem) + '</div>' +
      '<div class="assinatura">Atenciosamente,<br><strong>Equipe Escolar</strong></div>' +
      '<div class="rodape">Santo André, ' + escaparHtml(b.data) + '</div>' +
      '</article>').join('');
    return '<section class="folha"' + (indice ? ' style="page-break-before:always"' : '') + '>' + cards + '</section>';
  }).join('');
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + escaparHtml(titulo) + '</title><style>' +
    '@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#17365d}' +
    '.folha{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:4mm;width:100%;height:194mm}' +
    '.bilhete{position:relative;border:1.5px solid #2e75b6;border-radius:10px;padding:8mm 7mm 6mm;background:linear-gradient(145deg,#fff 74%,#eef7ff);overflow:hidden;break-inside:avoid}' +
    '.marca{font-size:8pt;font-weight:bold;letter-spacing:.5px;color:#2e75b6}.bilhete h2{text-align:center;font-size:11pt;margin:5mm 0 2mm;color:#17365d}.linha{height:2px;background:#f2b233;margin-bottom:3mm}' +
    '.destino{font-size:9pt;margin:0 0 1mm;line-height:1.25}.meta{font-size:8pt;color:#52718f;margin:0 0 4mm}.corpo{font-size:9.5pt;line-height:1.35;min-height:28mm;white-space:normal}.assinatura{font-size:8pt;margin-top:4mm;color:#345}.rodape{font-size:7.5pt;text-align:right;margin-top:3mm;color:#52718f}' +
    '.decor{position:absolute;opacity:.12;font-size:28px}.decor-a{right:7mm;top:5mm;color:#f2b233}.decor-b{right:5mm;bottom:4mm}' +
    '</style></head><body>' + secoes + '</body></html>';
}
function imprimir(titulo: string, bilhetes: any[]) {
  const paginas: any[][] = [];
  for (let i = 0; i < bilhetes.length; i += 6) paginas.push(bilhetes.slice(i, i + 6));
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(htmlImpressao(titulo, paginas));
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

export default function Bilhetes() {
  const { theme: modo } = useTheme();
  const { ano } = useAno();
  const { username } = useAuth();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [modeloId, setModeloId] = useState('conselho');
  const [escopo, setEscopo] = useState<Escopo>('infantil');
  const [professora, setProfessora] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [data, setData] = useState(hojeISO());
  const [entrada, setEntrada] = useState('');
  const [saida, setSaida] = useState('');
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([api.getTurmas(), api.getAllAlunos()]).then(([ts, as]) => {
      setTurmas(ts); setAlunos(as.filter((a: any) => isAtivo(a)));
    }).catch(e => setErro(e.message || 'Não foi possível carregar turmas e alunos.'));
  }, []);

  const modelo = MODELOS.find(m => m.id === modeloId) || MODELOS[0];
  const turmasInfantil = useMemo(() => turmas.filter(t => etapaDaTurma(t.nome) === 'Educação Infantil'), [turmas]);
  const turmasFundamental = useMemo(() => turmas.filter(t => etapaDaTurma(t.nome) === 'Ensino Fundamental' && !/^AEE/i.test(t.nome)), [turmas]);
  const professoras = useMemo(() => Array.from(new Set(turmas.map(t => t.professora).filter(Boolean))).sort(), [turmas]);
  const turmasFiltradas = escopo === 'infantil' ? turmasInfantil : escopo === 'fundamental' ? turmasFundamental : turmas;
  const alunosElegiveis = useMemo(() => alunos.filter(a => {
    if (escopo === 'infantil') return turmasInfantil.some(t => t.id === a.turmaId);
    if (escopo === 'fundamental') return turmasFundamental.some(t => t.id === a.turmaId);
    if (escopo === 'professora') return turmas.some(t => t.id === a.turmaId && t.professora === professora);
    if (escopo === 'turma') return a.turmaId === turmaId;
    return a.id === alunoId;
  }), [alunos, escopo, professora, turmaId, alunoId, turmas, turmasInfantil, turmasFundamental]);

  useEffect(() => {
    if (modeloId !== 'livre') setTexto(modelo.texto);
    setEntrada(''); setSaida('');
  }, [modeloId]);

  useEffect(() => {
    setSelecionados(alunosElegiveis.map(a => a.id));
  }, [escopo, professora, turmaId, alunoId, alunos.length]);

  const turmasSelecionadas = useMemo(() => turmas.filter(t => alunosElegiveis.some(a => a.turmaId === t.id)), [turmas, alunosElegiveis]);
  const etapaTexto = turmasSelecionadas.length === 1 ? etapaDaTurma(turmasSelecionadas[0].nome) : escopo === 'infantil' ? 'da Educação Infantil' : escopo === 'fundamental' ? 'do Ensino Fundamental' : 'selecionados';
  const mensagemPreview = useMemo(() => texto
    .replaceAll('{aluno}', '{nome do aluno}')
    .replaceAll('{turma}', '{turma}')
    .replaceAll('{professora}', '{professora}')
    .replaceAll('{etapa}', etapaTexto)
    .replaceAll('{data}', formatarData(data) || '___/___/______')
    .replaceAll('{horarios}', entrada || saida ? ' A entrada será às ' + (entrada || '___') + (saida ? ' e a saída às ' + saida : '') + '.' : '')
    .replaceAll('{horario}', entrada || saida ? ' Entrada: ' + (entrada || '___') + ' · Saída: ' + (saida || '___') : '')
  , [texto, data, entrada, saida, etapaTexto]);

  const mensagens = useMemo(() => selecionados.map(id => {
    const a = alunos.find(x => x.id === id) || {};
    const t = turmas.find(x => x.id === a.turmaId) || {};
    const body = texto
      .replaceAll('{aluno}', a.nome || '')
      .replaceAll('{turma}', t.nome || '')
      .replaceAll('{professora}', t.professora || a.professora || '')
      .replaceAll('{etapa}', etapaDaTurma(t.nome || ''))
      .replaceAll('{data}', formatarData(data))
      .replaceAll('{horarios}', entrada || saida ? ' A entrada será às ' + (entrada || '___') + (saida ? ' e a saída às ' + saida : '') + '.' : '')
      .replaceAll('{horario}', entrada || saida ? ' Entrada: ' + (entrada || '___') + ' · Saída: ' + (saida || '___') : '');
    return { aluno: a.nome || '', turma: t.nome || '', professora: t.professora || a.professora || '', mensagem: body, data: formatarData(data) };
  }), [selecionados, alunos, turmas, texto, data, entrada, saida]);

  const aplicarSaude = () => setTexto('Prezados pais ou responsáveis, solicitamos que observem a saúde do(a) aluno(a) {aluno}. Caso identifiquem sinais de pediculose (piolhos), pedimos que procurem orientação adequada e realizem os cuidados necessários antes do retorno à escola. A criança poderá retornar após os cuidados recomendados. Agradecemos a parceria da família.');
  const salvarEImprimir = async () => {
    if (!mensagens.length) { setErro('Selecione pelo menos um aluno.'); return; }
    setSalvando(true); setErro('');
    try {
      await api.createBilhete({ ano, modelo: modeloId, titulo: modelo.titulo, mensagem: texto, alunos: mensagens, total_bilhetes: mensagens.length, criado_por: username || '' });
      imprimir(modelo.titulo, mensagens);
    } catch (e: any) { setErro(e.message || 'Não foi possível registrar o bilhete.'); }
    finally { setSalvando(false); }
  };

  const toggleAluno = (id: string) => setSelecionados(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const painel: React.CSSProperties = { ...card({ padding: 18 }), background: modo === 'light' ? '#fff' : theme.card };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...painel, background: 'linear-gradient(135deg,#17365d,#2e75b6)', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: .8, letterSpacing: 1 }}>CENTRAL DE IMPRESSÃO</div>
        <h1 style={{ margin: '4px 0', fontSize: 27 }}>📝 Bilhetes e Comunicados</h1>
        <p style={{ margin: 0, opacity: .9 }}>Crie bilhetes personalizados e imprima seis por folha A4 em paisagem.</p>
      </div>

      {erro && <div style={{ ...painel, border: '1px solid #ef4444', color: '#b91c1c', background: '#fff1f2' }}>{erro}</div>}

      <div style={{ ...painel, display: 'grid', gridTemplateColumns: 'minmax(250px, .8fr) minmax(320px, 1.2fr)', gap: 20 }}>
        <div>
          <h2 style={{ color: theme.text, margin: '0 0 12px', fontSize: 18 }}>1. Escolha o modelo</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {MODELOS.map(m => <button key={m.id} onClick={() => setModeloId(m.id)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 9, border: '1px solid ' + (m.id === modeloId ? '#2e75b6' : theme.border), background: m.id === modeloId ? '#eef7ff' : 'transparent', color: theme.text, cursor: 'pointer' }}><span style={{ fontSize: 20 }}>{m.icon}</span> <strong>{m.nome}</strong></button>)}
          </div>
          {modeloId === 'saude' && <button onClick={aplicarSaude} style={{ ...btn('warning', { small: true }), marginTop: 10 }}>Usar texto sobre pediculose</button>}
        </div>

        <div>
          <h2 style={{ color: theme.text, margin: '0 0 12px', fontSize: 18 }}>2. Personalize</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={label}>Data do comunicado</label><input type="date" value={data} onChange={e => setData(e.target.value)} style={input} /></div>
            <div><label style={label}>Entrada (opcional)</label><input type="time" value={entrada} onChange={e => setEntrada(e.target.value)} style={input} /></div>
            <div><label style={label}>Saída (opcional)</label><input type="time" value={saida} onChange={e => setSaida(e.target.value)} style={input} /></div>
            <div><label style={label}>Título</label><input value={modelo.titulo} readOnly style={{ ...input, opacity: .8 }} /></div>
          </div>
          <label style={{ ...label, marginTop: 12 }}>Texto do bilhete — campos opcionais: {'{aluno}'}, {'{turma}'}, {'{professora}'}, {'{etapa}'}, {'{data}'}, {'{horarios}'}</label>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={9} style={{ ...input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45 }} />
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--ghost-bg)', color: theme.textMuted, fontSize: 12 }}>
            Prévia: {mensagemPreview}
          </div>
        </div>
      </div>

      <div style={painel}>
        <h2 style={{ color: theme.text, margin: '0 0 12px', fontSize: 18 }}>3. Para quem será o bilhete?</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {([
            ['infantil', '🧒 Todas do Infantil'],
            ['fundamental', '📘 Todas do Fundamental'],
            ['professora', '👩‍🏫 Por professora'],
            ['turma', '🏫 Uma turma'],
            ['aluno', '👤 Um aluno'],
          ] as [Escopo, string][]).map(([v, l]) => <button key={v} onClick={() => setEscopo(v)} style={{ ...btn(v === escopo ? 'primary' : 'ghost', { small: true }), border: v === escopo ? '2px solid #17365d' : '1px solid ' + theme.border }}>{l}</button>)}
        </div>
        {escopo === 'professora' && <div><label style={label}>Professora</label><select value={professora} onChange={e => setProfessora(e.target.value)} style={input}><option value="">Selecione...</option>{professoras.map(p => <option key={p} value={p}>{p}</option>)}</select></div>}
        {escopo === 'turma' && <div><label style={label}>Turma</label><select value={turmaId} onChange={e => setTurmaId(e.target.value)} style={input}><option value="">Selecione...</option>{turmasFiltradas.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.professora}</option>)}</select></div>}
        {escopo === 'aluno' && <div><label style={label}>Aluno</label><select value={alunoId} onChange={e => setAlunoId(e.target.value)} style={input}><option value="">Selecione...</option>{alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px' }}>
          <strong style={{ color: theme.text }}>{selecionados.length} bilhete(s) selecionado(s)</strong>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setSelecionados(alunosElegiveis.map(a => a.id))} style={btn('success', { small: true })}>Selecionar todos</button><button onClick={() => setSelecionados([])} style={btn('ghost', { small: true })}>Limpar</button></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 7, maxHeight: 260, overflow: 'auto', padding: 2 }}>
          {alunosElegiveis.map(a => <label key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', border: '1px solid ' + theme.border, borderRadius: 8, cursor: 'pointer', color: theme.text }}><input type="checkbox" checked={selecionados.includes(a.id)} onChange={() => toggleAluno(a.id)} /><span>{a.nome}<small style={{ display: 'block', color: theme.textMuted }}>{turmas.find(t => t.id === a.turmaId)?.nome || ''}</small></span></label>)}
          {!alunosElegiveis.length && <p style={{ color: theme.textMuted }}>Nenhum aluno encontrado para esse filtro.</p>}
        </div>
      </div>

      <div style={{ ...painel, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ color: theme.textMuted, fontSize: 13 }}>A impressão será em A4 paisagem, com seis bilhetes por folha e identificação individual.</div>
        <button onClick={salvarEImprimir} disabled={salvando || !mensagens.length} style={btn('primary')}>{salvando ? 'Registrando...' : '🖨️ Registrar e imprimir bilhetes'}</button>
      </div>
    </div>
  );
}

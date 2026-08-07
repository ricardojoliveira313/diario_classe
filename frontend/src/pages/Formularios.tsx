import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { theme, btn, input, label, MESES } from '../styles';
import { useTheme } from '../ThemeContext';
import { useAno } from '../AnoContext';

const ESCOLA = 'E.M.E.I.E.F. LUIZ GONZAGA';
const ENDERECO = 'Rua Ipanema, 253 – Parque Erasmo Assunção';
const CIDADE = 'Santo André – SP';
const EMAIL = 'perasmo@santoandre.sp.gov.br';
const TEL = '3356-7962';
const CEP = 'CEP: 09271-500';
const DIRETORA = 'TEREZINHA BABICHAKA SQUIAVONI';
const CPF_DIR = '124.451.878-69';

type FormKey = 'entrada' | 'saida' | 'infantil' | 'fundamental' | 'frequencia';

const FORMULARIOS: { key: FormKey; label: string; icon: string; desc: string }[] = [
  { key: 'entrada',     icon: '📥', label: 'Entrada de Aluno',              desc: 'Ficha de chegada de novo aluno na turma' },
  { key: 'saida',       icon: '📤', label: 'Saída de Aluno',                desc: 'Ficha de transferência ou saída de aluno' },
  { key: 'infantil',    icon: '🧒', label: 'Declaração Infantil',           desc: 'Declaração para alunos da Educação Infantil' },
  { key: 'fundamental', icon: '📋', label: 'Declaração Fundamental',        desc: 'Declaração de matrícula / frequência / conclusão' },
  { key: 'frequencia',  icon: '📊', label: 'Declaração de Frequência (MEC)', desc: 'Formulário oficial INEP de frequência escolar' },
];

function hoje() {
  return new Date().toLocaleDateString('pt-BR');
}
function anoAtual() {
  return new Date().getFullYear();
}

function cabecalho() {
  return `
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:10pt;font-weight:700;letter-spacing:1px">PREFEITURA MUNICIPAL DE SANTO ANDRÉ</div>
      <div style="font-size:9pt">SECRETARIA DE EDUCAÇÃO</div>
      <div style="font-size:11pt;font-weight:900;margin:4px 0">${ESCOLA}</div>
      <div style="font-size:8pt">${ENDERECO} – ${CEP} – ${CIDADE}</div>
      <div style="font-size:8pt">Tel: ${TEL} | E-mail: ${EMAIL}</div>
    </div>
    <hr style="border:1.5px solid #1e3a6e;margin-bottom:16px">
  `;
}

function htmlParaImprimir(titulo: string, corpo: string, paisagem = false) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${titulo}</title>
<style>
  @page { size: A4 ${paisagem ? 'landscape' : 'portrait'}; margin: 15mm 15mm 15mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 0; }
  .campo { display: inline-block; border-bottom: 1px solid #000; min-width: 120px; }
  .linha-campo { border-bottom: 1px solid #000; display: block; margin: 2px 0; }
  .checkbox { display: inline-block; border: 1px solid #000; width: 12px; height: 12px; margin-right: 4px; vertical-align: middle; }
  table { border-collapse: collapse; width: 100%; }
  table td, table th { border: 1px solid #000; padding: 3px 6px; font-size: 9pt; }
  h2 { text-align: center; font-size: 14pt; font-weight: 900; letter-spacing: 2px; margin: 8px 0 16px; }
</style>
</head>
<body>${cabecalho()}<h2>${titulo}</h2>${corpo}</body>
</html>`;
}

// ─── Formulário: Entrada de Aluno ─────────────────────────────────────────────
function FormEntrada({ turmas, alunos }: { turmas: any[]; alunos: any[] }) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [dataMatricula, setDataMatricula] = useState('');
  const [escolaAnterior, setEscolaAnterior] = useState('');
  const [numeroNoDiario, setNumeroNoDiario] = useState('');
  const [totalAlunos, setTotalAlunos] = useState('');

  const turma = turmas.find(t => t.id === turmaId);
  const alunosFiltrados = alunos.filter(a => a.turmaId === turmaId);
  const aluno = alunos.find(a => a.id === alunoId);

  const imprimir = () => {
    const dataNasc = aluno?.data_nascimento
      ? new Date(aluno.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')
      : '___/___/______';
    const corpo = `
      <p><strong>Aluno:</strong> <span class="campo" style="min-width:300px">${aluno?.nome ?? ''}</span></p>
      <p><strong>Data de nascimento:</strong> <span class="campo">${dataNasc}</span></p>
      <p><strong>Professor(a):</strong> <span class="campo" style="min-width:200px">${turma?.professora ?? ''}</span>
         &nbsp;&nbsp;<strong>Sala:</strong> <span class="campo" style="min-width:80px">${turma?.nome ?? ''}</span>
         &nbsp;&nbsp;<strong>Período:</strong> <span class="campo" style="min-width:100px">${turma?.periodo ?? ''}</span></p>
      <p><strong>Data de início do aluno (data da matrícula):</strong> <span class="campo">${dataMatricula ? new Date(dataMatricula + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</span></p>
      <p><strong>O aluno estudava na escola:</strong> <span class="campo" style="min-width:280px">${escolaAnterior}</span></p>
      <br>
      <p>Favor inserir o aluno no n.º <strong>${numeroNoDiario}</strong> do diário.</p>
      <p>E neste momento sua turma está com <strong>${totalAlunos}</strong> alunos!!!!</p>
      <br>
      <p style="font-size:8pt;color:#555">(Obs: Caso este número esteja errado favor conversar com a secretaria)</p>
    `;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(htmlParaImprimir('ENTRADA DE ALUNO', corpo));
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Turma</label>
          <select style={{ ...input, width: '100%' }} value={turmaId} onChange={e => { setTurmaId(e.target.value); setAlunoId(''); }}>
            <option value="">Selecione...</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} – {t.professora}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Aluno</label>
          <select style={{ ...input, width: '100%' }} value={alunoId} onChange={e => setAlunoId(e.target.value)} disabled={!turmaId}>
            <option value="">Selecione...</option>
            {alunosFiltrados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Data de matrícula</label>
          <input style={{ ...input, width: '100%' }} type="date" value={dataMatricula} onChange={e => setDataMatricula(e.target.value)} />
        </div>
        <div>
          <label style={label}>Escola anterior</label>
          <input style={{ ...input, width: '100%' }} placeholder="Nome da escola de origem" value={escolaAnterior} onChange={e => setEscolaAnterior(e.target.value)} />
        </div>
        <div>
          <label style={label}>Número no diário</label>
          <input style={{ ...input, width: '100%' }} type="number" placeholder="Ex: 25" value={numeroNoDiario} onChange={e => setNumeroNoDiario(e.target.value)} />
        </div>
        <div>
          <label style={label}>Total de alunos na turma</label>
          <input style={{ ...input, width: '100%' }} type="number" placeholder="Ex: 28" value={totalAlunos} onChange={e => setTotalAlunos(e.target.value)} />
        </div>
      </div>
      <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={imprimir}>🖨️ Imprimir Ficha de Entrada</button>
    </div>
  );
}

// ─── Formulário: Saída de Aluno ────────────────────────────────────────────────
function FormSaida({ turmas, alunos }: { turmas: any[]; alunos: any[] }) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [dataTransf, setDataTransf] = useState('');
  const [totalAlunos, setTotalAlunos] = useState('');
  const [tipoSaida, setTipoSaida] = useState<'periodo' | 'escola' | ''>('');
  const [escolaDestino, setEscolaDestino] = useState('');
  const [totalFaltas, setTotalFaltas] = useState('');

  const turma = turmas.find(t => t.id === turmaId);
  const alunosFiltrados = alunos.filter(a => a.turmaId === turmaId);
  const aluno = alunos.find(a => a.id === alunoId);

  const imprimir = () => {
    const corpo = `
      <p><strong>Aluno:</strong> <span class="campo" style="min-width:300px">${aluno?.nome ?? ''}</span></p>
      <p><strong>Professora:</strong> <span class="campo" style="min-width:200px">${turma?.professora ?? ''}</span>
         &nbsp;&nbsp;<strong>Sala:</strong> <span class="campo" style="min-width:100px">${turma?.nome ?? ''}</span></p>
      <p><strong>Data de transferência:</strong> <span class="campo">${dataTransf ? new Date(dataTransf + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</span></p>
      <p>Sua turma está com <strong>${totalAlunos}</strong> alunos.</p>
      <br>
      <p><strong>Favor deixar material na Secretaria.</strong></p>
      <br>
      <p><span class="checkbox">${tipoSaida === 'periodo' ? '✓' : ''}</span> Aluno transferido de período.</p>
      <p><span class="checkbox">${tipoSaida === 'escola' ? '✓' : ''}</span> Aluno transferido para <span class="campo" style="min-width:200px">${escolaDestino}</span></p>
      <br>
      <p>Favor preencher e devolver o mesmo na secretaria.</p>
      <p><strong>Número total de faltas do aluno até a data de transferência:</strong> <span class="campo">${totalFaltas}</span></p>
      <br>
      <p style="font-weight:700">ENTREGAR FICHA DE CARACTERIZAÇÃO DO ALUNO</p>
    `;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(htmlParaImprimir('SAÍDA DE ALUNO', corpo));
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Turma</label>
          <select style={{ ...input, width: '100%' }} value={turmaId} onChange={e => { setTurmaId(e.target.value); setAlunoId(''); }}>
            <option value="">Selecione...</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} – {t.professora}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Aluno</label>
          <select style={{ ...input, width: '100%' }} value={alunoId} onChange={e => setAlunoId(e.target.value)} disabled={!turmaId}>
            <option value="">Selecione...</option>
            {alunosFiltrados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Data de transferência</label>
          <input style={{ ...input, width: '100%' }} type="date" value={dataTransf} onChange={e => setDataTransf(e.target.value)} />
        </div>
        <div>
          <label style={label}>Total de alunos na turma</label>
          <input style={{ ...input, width: '100%' }} type="number" placeholder="Ex: 27" value={totalAlunos} onChange={e => setTotalAlunos(e.target.value)} />
        </div>
      </div>
      <div>
        <label style={label}>Tipo de saída</label>
        <div style={{ display: 'flex', gap: 20 }}>
          {[{ v: 'periodo', l: 'Transferido de período' }, { v: 'escola', l: 'Transferido para outra escola' }].map(op => (
            <label key={op.v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: theme.text }}>
              <input type="radio" value={op.v} checked={tipoSaida === op.v} onChange={() => setTipoSaida(op.v as any)} />
              {op.l}
            </label>
          ))}
        </div>
      </div>
      {tipoSaida === 'escola' && (
        <div>
          <label style={label}>Escola de destino</label>
          <input style={{ ...input, width: '100%' }} placeholder="Nome da escola" value={escolaDestino} onChange={e => setEscolaDestino(e.target.value)} />
        </div>
      )}
      <div>
        <label style={label}>Total de faltas até a transferência</label>
        <input style={{ ...input, maxWidth: 160 }} type="number" placeholder="0" value={totalFaltas} onChange={e => setTotalFaltas(e.target.value)} />
      </div>
      <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={imprimir}>🖨️ Imprimir Ficha de Saída</button>
    </div>
  );
}

// ─── Formulário: Declaração Infantil ──────────────────────────────────────────
const OPCOES_INFANTIL = [
  { id: 'freq',   label: (ciclo: string, etapa: string, horIni: string, horFim: string) =>
    `É aluno(a) regularmente matriculado(a) e está frequentando até a presente data no ${ciclo} ciclo ${etapa} da EDUCAÇÃO INFANTIL nesta Unidade Escolar no horário das ${horIni} às ${horFim}.` },
  { id: 'matr',   label: (ciclo: string, etapa: string) =>
    `É aluno(a) regularmente matriculado(a) até a presente data no ${ciclo} ciclo ${etapa} da EDUCAÇÃO INFANTIL nesta Unidade Escolar.` },
  { id: 'foi',    label: (ciclo: string, etapa: string, _: string, __: string, periodo: string) =>
    `Foi aluno(a) regularmente matriculado(a) no ${ciclo} ciclo ${etapa} da EDUCAÇÃO INFANTIL nesta Unidade Escolar, no período de ${periodo}.` },
  { id: 'conc',   label: () =>
    `Concluiu o curso da EDUCAÇÃO INFANTIL nesta Unidade Escolar estando apto(a) a cursar o 1º ano do Ensino Fundamental.` },
  { id: 'tran',   label: (ciclo: string, etapa: string) =>
    `Solicitou, nesta data, sua transferência para outra Unidade Escolar com direito a matricular-se no ${ciclo} ciclo ${etapa} da EDUCAÇÃO INFANTIL.` },
  { id: 'vaga',   label: (ciclo: string, etapa: string) =>
    `Solicitou uma vaga no ${ciclo} ciclo ${etapa} da EDUCAÇÃO INFANTIL nesta Unidade Escolar que poderá ser preenchida pelo(a) mesmo(a) desde que apresente a documentação necessária para sua matrícula.\n\n⚠️ ESTE ITEM TERÁ VALIDADE DE 3 DIAS, A PARTIR DESTA DATA.` },
  { id: 'canc',   label: () =>
    `Solicitou, nesta data, o cancelamento de sua matrícula nesta Unidade Escolar, estando ciente de qualquer implicação legal que possa ocorrer.` },
];

function FormInfantil({ turmas, alunos }: { turmas: any[]; alunos: any[] }) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [opcao, setOpcao] = useState('freq');
  const [ciclo, setCiclo] = useState('');
  const [etapa, setEtapa] = useState('');
  const [horIni, setHorIni] = useState('');
  const [horFim, setHorFim] = useState('');
  const [periodo, setPeriodo] = useState('');

  const turma = turmas.find(t => t.id === turmaId);
  const alunosFiltrados = alunos.filter(a => a.turmaId === turmaId);
  const aluno = alunos.find(a => a.id === alunoId);

  const imprimir = () => {
    const dataNasc = aluno?.data_nascimento
      ? new Date(aluno.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')
      : '___/___/____';
    const c = ciclo || '__';
    const e = etapa || '_______________';
    const hi = horIni || '___:___';
    const hf = horFim || '___:___';
    const per = periodo || '___/___/___ à ___/___/___';

    const corpo = `
      <p>Declaro para os devidos fins, que <strong>${aluno?.nome ?? '_'.repeat(40)}</strong>
      nascido(a) no dia <strong>${dataNasc}</strong>, RA: <strong>${aluno?.ra ?? '___________'}</strong>:</p>
      <br>
      ${OPCOES_INFANTIL.map(o => `
        <p style="margin:8px 0">
          <span class="checkbox">${opcao === o.id ? '✓' : ''}</span>
          ${o.label(c, e, hi, hf, per)}
        </p>
      `).join('')}
      <br>
      <p style="font-size:8pt;font-style:italic">Observação: Esta declaração é válida sem rasuras e tendo somente um dos quadrados assinalados.</p>
      <br><br>
      <p>Santo André, _____ de ________________________ de ${anoAtual()}.</p>
      <br><br>
      <div style="text-align:center;margin-top:32px">
        <div style="border-top:1px solid #000;display:inline-block;min-width:220px;padding-top:4px">
          ${DIRETORA}<br>Diretora – CPF: ${CPF_DIR}
        </div>
      </div>
    `;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(htmlParaImprimir('DECLARAÇÃO — EDUCAÇÃO INFANTIL', corpo));
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Turma</label>
          <select style={{ ...input, width: '100%' }} value={turmaId} onChange={e => { setTurmaId(e.target.value); setAlunoId(''); }}>
            <option value="">Selecione...</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} – {t.professora}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Aluno</label>
          <select style={{ ...input, width: '100%' }} value={alunoId} onChange={e => setAlunoId(e.target.value)} disabled={!turmaId}>
            <option value="">Selecione...</option>
            {alunosFiltrados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Ciclo (número)</label>
          <input style={{ ...input, width: '100%' }} placeholder="Ex: 1" value={ciclo} onChange={e => setCiclo(e.target.value)} />
        </div>
        <div>
          <label style={label}>Etapa / Nível</label>
          <input style={{ ...input, width: '100%' }} placeholder="Ex: Berçário / Maternal / Jardim" value={etapa} onChange={e => setEtapa(e.target.value)} />
        </div>
        <div>
          <label style={label}>Horário (início – fim)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...input, flex: 1 }} type="time" value={horIni} onChange={e => setHorIni(e.target.value)} />
            <input style={{ ...input, flex: 1 }} type="time" value={horFim} onChange={e => setHorFim(e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <label style={label}>Declaração</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OPCOES_INFANTIL.map(o => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', color: theme.text, fontSize: 13 }}>
              <input type="radio" value={o.id} checked={opcao === o.id} onChange={() => setOpcao(o.id)} style={{ marginTop: 3 }} />
              <span>{o.label(ciclo || 'X', etapa || '___', horIni || 'HH:MM', horFim || 'HH:MM', periodo || 'dd/mm/aaaa à dd/mm/aaaa')}</span>
            </label>
          ))}
        </div>
      </div>

      {opcao === 'foi' && (
        <div>
          <label style={label}>Período (dd/mm/aaaa à dd/mm/aaaa)</label>
          <input style={{ ...input, width: '100%' }} placeholder="Ex: 01/02/2025 à 15/06/2025" value={periodo} onChange={e => setPeriodo(e.target.value)} />
        </div>
      )}

      <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={imprimir}>🖨️ Imprimir Declaração Infantil</button>
    </div>
  );
}

// ─── Formulário: Declaração Fundamental ───────────────────────────────────────
const OPCOES_DECL = [
  { id: 'freq',  texto: (ano: string, horIni: string, horFim: string) => `É aluno(a) regularmente matriculado(a) e está frequentando até a presente data no ${ano}º ano do Ensino Fundamental nesta Unidade Escolar no horário das ${horIni} às ${horFim}.` },
  { id: 'matr',  texto: (ano: string) => `É aluno(a) regularmente matriculado(a) até a presente data no ${ano}º ano do Ensino Fundamental nesta Unidade Escolar.` },
  { id: 'foi',   texto: (ano: string, _: string, __: string, periodoInicio: string) => `Foi aluno(a) regularmente matriculado(a) no ${ano}º ano do Ensino Fundamental frequentando às aulas nesta Unidade Escolar no período de ${periodoInicio}.` },
  { id: 'conc',  texto: (ano: string, _: string, __: string, ___: string, anoConc: string) => `Concluiu o ${ano}º ano do Ensino Fundamental nesta Unidade Escolar estando apto(a) a cursar o ${anoConc}º ano do Ensino Fundamental.` },
  { id: 'tran',  texto: (ano: string) => `Solicitou, nesta data, sua transferência para outra Unidade Escolar com direito a matricular-se no ${ano}º ano do Ensino Fundamental.` },
  { id: 'vaga',  texto: (ano: string) => `Solicitou uma vaga nesta Unidade Escolar no ${ano}º ano do Ensino Fundamental que poderá ser preenchida pelo(a) mesmo(a) desde que apresente a documentação necessária para sua matrícula.\n\n⚠️ ESTE ITEM TERÁ VALIDADE DE 3 DIAS, A PARTIR DESTA DATA.` },
];

function FormFundamental({ turmas, alunos }: { turmas: any[]; alunos: any[] }) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [opcao, setOpcao] = useState('freq');
  const [ano, setAno] = useState('');
  const [horIni, setHorIni] = useState('');
  const [horFim, setHorFim] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [anoConc, setAnoConc] = useState('');
  const [obs, setObs] = useState('');

  const turma = turmas.find(t => t.id === turmaId);
  const alunosFiltrados = alunos.filter(a => a.turmaId === turmaId);
  const aluno = alunos.find(a => a.id === alunoId);

  const textoOpcao = () => {
    const op = OPCOES_DECL.find(o => o.id === opcao);
    if (!op) return '';
    return op.texto(ano, horIni, horFim, periodoInicio, anoConc);
  };

  const imprimir = () => {
    const dataNasc = aluno?.data_nascimento
      ? new Date(aluno.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')
      : '___/___/____';
    const corpo = `
      <p>Declaro para os devidos fins, que <strong>${aluno?.nome ?? '_'.repeat(40)}</strong>
      nascido(a) no dia <strong>${dataNasc}</strong>, RA: <strong>${aluno?.ra ?? '___________'}</strong>:</p>
      <br>
      ${OPCOES_DECL.map(o => `
        <p style="margin:8px 0">
          <span class="checkbox">${opcao === o.id ? '✓' : ''}</span>
          ${o.texto(ano || '___', horIni || '___', horFim || '___', periodoInicio || '___/___/___', anoConc || '___')}
        </p>
      `).join('')}
      ${obs ? `<br><p><strong>Observação:</strong> ${obs}</p>` : ''}
      <br>
      <p style="font-size:8pt;font-style:italic">Observação: Esta declaração é válida sem rasuras e tendo somente um dos quadrados assinalados.</p>
      <br><br>
      <p>Santo André, _____ de ________________________ de ${anoAtual()}.</p>
      <br><br>
      <div style="text-align:center;margin-top:32px">
        <div style="border-top:1px solid #000;display:inline-block;min-width:220px;padding-top:4px">
          ${DIRETORA}<br>Diretora – CPF: ${CPF_DIR}
        </div>
      </div>
    `;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(htmlParaImprimir('DECLARAÇÃO', corpo));
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Turma</label>
          <select style={{ ...input, width: '100%' }} value={turmaId} onChange={e => { setTurmaId(e.target.value); setAlunoId(''); }}>
            <option value="">Selecione...</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} – {t.professora}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Aluno</label>
          <select style={{ ...input, width: '100%' }} value={alunoId} onChange={e => setAlunoId(e.target.value)} disabled={!turmaId}>
            <option value="">Selecione...</option>
            {alunosFiltrados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Ano do Ensino Fundamental</label>
          <input style={{ ...input, width: '100%' }} placeholder="Ex: 3" value={ano} onChange={e => setAno(e.target.value)} />
        </div>
        <div>
          <label style={label}>Horário (início – fim)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...input, flex: 1 }} type="time" value={horIni} onChange={e => setHorIni(e.target.value)} />
            <input style={{ ...input, flex: 1 }} type="time" value={horFim} onChange={e => setHorFim(e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <label style={label}>Declaração</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OPCOES_DECL.map(o => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', color: theme.text, fontSize: 13 }}>
              <input type="radio" value={o.id} checked={opcao === o.id} onChange={() => setOpcao(o.id)} style={{ marginTop: 3 }} />
              <span>{o.texto(ano || 'X', horIni || 'HH:MM', horFim || 'HH:MM', periodoInicio || 'dd/mm/aaaa', anoConc || 'X')}</span>
            </label>
          ))}
        </div>
      </div>

      {opcao === 'foi' && (
        <div>
          <label style={label}>Período de frequência (dd/mm/aaaa a dd/mm/aaaa)</label>
          <input style={{ ...input, width: '100%' }} placeholder="Ex: 01/02/2025 a 15/06/2025" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
        </div>
      )}
      {opcao === 'conc' && (
        <div>
          <label style={label}>Apto a cursar o ano</label>
          <input style={{ ...input, maxWidth: 120 }} placeholder="Ex: 4" value={anoConc} onChange={e => setAnoConc(e.target.value)} />
        </div>
      )}

      <div>
        <label style={label}>Observações (opcional)</label>
        <input style={{ ...input, width: '100%' }} placeholder="O aluno deve Histórico Escolar anterior..." value={obs} onChange={e => setObs(e.target.value)} />
      </div>

      <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={imprimir}>🖨️ Imprimir Declaração</button>
    </div>
  );
}

// ─── Formulário: Declaração de Frequência MEC/INEP ────────────────────────────
function FormFrequencia({ turmas, alunos }: { turmas: any[]; alunos: any[] }) {
  const { ano } = useAno();
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [modalidade, setModalidade] = useState('Ensino Fundamental');
  const [serieAno, setSerieAno] = useState('');
  const [dataMatricula, setDataMatricula] = useState('');
  const [horIni, setHorIni] = useState('');
  const [horFim, setHorFim] = useState('');
  const [codigoInep, setCodigoInep] = useState('');
  const [sexo, setSexo] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [transferidoEm, setTransferidoEm] = useState('');
  const [transferidoPara, setTransferidoPara] = useState('');
  const [deixouEm, setDeixouEm] = useState('');

  const mesesLetivos = [
    'Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro',
  ];
  const [linhasMeses, setLinhasMeses] = useState<{ diasLetivos: string; faltas: string }[]>(
    mesesLetivos.map(() => ({ diasLetivos: '', faltas: '' }))
  );
  const atualizarLinha = (i: number, campo: 'diasLetivos' | 'faltas', val: string) => {
    setLinhasMeses(prev => prev.map((l, idx) => idx === i ? { ...l, [campo]: val } : l));
  };

  const turma = turmas.find(t => t.id === turmaId);
  const alunosFiltrados = alunos.filter(a => a.turmaId === turmaId);
  const aluno = alunos.find(a => a.id === alunoId);

  const imprimir = () => {
    const dataNasc = aluno?.data_nascimento
      ? new Date(aluno.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')
      : '';
    const dmFmt = dataMatricula ? new Date(dataMatricula + 'T12:00:00').toLocaleDateString('pt-BR') : '';
    const corpo = `
      <h3 style="text-align:center;font-size:12pt;letter-spacing:1px">DECLARAÇÃO DE FREQUÊNCIA ESCOLAR</h3>
      <h4 style="text-align:center;margin-bottom:12px">MINISTÉRIO DA EDUCAÇÃO / INEP</h4>

      <table style="margin-bottom:12px">
        <tr>
          <td style="width:40%;font-weight:700">Código INEP da Escola:</td>
          <td>${codigoInep}</td>
          <td style="font-weight:700">Município:</td>
          <td>Santo André – SP</td>
        </tr>
        <tr>
          <td style="font-weight:700">Nome da escola:</td>
          <td colspan="3">${ESCOLA}</td>
        </tr>
      </table>

      <table style="margin-bottom:12px">
        <tr>
          <td style="font-weight:700;width:40%">Nome do aluno:</td>
          <td colspan="3">${aluno?.nome ?? ''}</td>
        </tr>
        <tr>
          <td style="font-weight:700">Sexo:</td>
          <td>${sexo === 'M' ? '☑ Masculino  ☐ Feminino' : sexo === 'F' ? '☐ Masculino  ☑ Feminino' : '☐ Masculino  ☐ Feminino'}</td>
          <td style="font-weight:700">Data de nascimento:</td>
          <td>${dataNasc}</td>
        </tr>
        <tr>
          <td style="font-weight:700">Nome completo da mãe:</td>
          <td colspan="3">${nomeMae}</td>
        </tr>
      </table>

      <p>Declaramos para os devidos fins que o(a) aluno(a) acima relacionado(a) está/esteve regularmente matriculado(a) nesta unidade,
      frequentando o(a) <strong>${serieAno}</strong> da modalidade <strong>${modalidade}</strong>,
      na turma <strong>${turma?.nome ?? ''}</strong> que tem como horário: das <strong>${horIni}</strong> às <strong>${horFim}</strong>,
      no ano letivo de <strong>${ano}</strong>,
      sendo sua data de matrícula <strong>${dmFmt}</strong>.
      Logo o(a) mesmo(a) teve a seguinte frequência:</p>

      <table style="margin:12px 0">
        <thead>
          <tr style="background:#eee">
            <th>Mês</th>
            <th>Dias Letivos</th>
            <th>Faltas</th>
          </tr>
        </thead>
        <tbody>
          ${mesesLetivos.map((m, i) => `<tr><td>${m}</td><td style="text-align:center">${linhasMeses[i].diasLetivos}</td><td style="text-align:center">${linhasMeses[i].faltas}</td></tr>`).join('')}
        </tbody>
      </table>

      <table style="margin-bottom:16px">
        <tr>
          <td style="font-weight:700">Transferido em:</td>
          <td>${transferidoEm ? new Date(transferidoEm + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</td>
          <td style="font-weight:700">Para a escola:</td>
          <td>${transferidoPara}</td>
        </tr>
        <tr>
          <td style="font-weight:700">Deixou de frequentar em:</td>
          <td colspan="3">${deixouEm ? new Date(deixouEm + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</td>
        </tr>
      </table>

      <p style="font-size:8pt;font-style:italic">As informações prestadas nesta declaração sujeitam os declarantes à responsabilização civil, penal e administrativa prevista na Lei nº 8.429 de 2 de junho de 1992.</p>
      <br><br>
      <div style="display:flex;justify-content:space-between;margin-top:16px">
        <div>Santo André, _____ de __________________ de ${ano}.</div>
        <div style="text-align:center;border-top:1px solid #000;min-width:220px;padding-top:4px">
          ${DIRETORA}<br>CPF: ${CPF_DIR}<br>Carimbo e Assinatura
        </div>
      </div>
    `;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(htmlParaImprimir('DECLARAÇÃO DE FREQUÊNCIA ESCOLAR', corpo));
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Turma</label>
          <select style={{ ...input, width: '100%' }} value={turmaId} onChange={e => { setTurmaId(e.target.value); setAlunoId(''); }}>
            <option value="">Selecione...</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} – {t.professora}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Aluno</label>
          <select style={{ ...input, width: '100%' }} value={alunoId} onChange={e => setAlunoId(e.target.value)} disabled={!turmaId}>
            <option value="">Selecione...</option>
            {alunosFiltrados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Sexo</label>
          <select style={{ ...input, width: '100%' }} value={sexo} onChange={e => setSexo(e.target.value)}>
            <option value="">Selecione...</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </div>
        <div>
          <label style={label}>Nome completo da mãe</label>
          <input style={{ ...input, width: '100%' }} value={nomeMae} onChange={e => setNomeMae(e.target.value)} />
        </div>
        <div>
          <label style={label}>Série / Ano</label>
          <input style={{ ...input, width: '100%' }} placeholder="Ex: 3º ano" value={serieAno} onChange={e => setSerieAno(e.target.value)} />
        </div>
        <div>
          <label style={label}>Modalidade</label>
          <input style={{ ...input, width: '100%' }} value={modalidade} onChange={e => setModalidade(e.target.value)} />
        </div>
        <div>
          <label style={label}>Horário</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...input, flex: 1 }} type="time" value={horIni} onChange={e => setHorIni(e.target.value)} />
            <input style={{ ...input, flex: 1 }} type="time" value={horFim} onChange={e => setHorFim(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={label}>Data de matrícula</label>
          <input style={{ ...input, width: '100%' }} type="date" value={dataMatricula} onChange={e => setDataMatricula(e.target.value)} />
        </div>
        <div>
          <label style={label}>Código INEP da escola</label>
          <input style={{ ...input, width: '100%' }} placeholder="Ex: 35XXXXXX" value={codigoInep} onChange={e => setCodigoInep(e.target.value)} />
        </div>
      </div>

      <div>
        <label style={label}>Frequência por mês</label>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Mês</th>
                <th style={{ padding: '6px 10px', fontWeight: 700 }}>Dias Letivos</th>
                <th style={{ padding: '6px 10px', fontWeight: 700 }}>Faltas</th>
              </tr>
            </thead>
            <tbody>
              {mesesLetivos.map((m, i) => (
                <tr key={m} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                  <td style={{ padding: '4px 10px', color: theme.text }}>{m}</td>
                  <td style={{ padding: '4px 6px' }}>
                    <input style={{ ...input, width: '100%', textAlign: 'center', padding: '4px 6px' }} type="number" value={linhasMeses[i].diasLetivos} onChange={e => atualizarLinha(i, 'diasLetivos', e.target.value)} />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <input style={{ ...input, width: '100%', textAlign: 'center', padding: '4px 6px' }} type="number" value={linhasMeses[i].faltas} onChange={e => atualizarLinha(i, 'faltas', e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Transferido em</label>
          <input style={{ ...input, width: '100%' }} type="date" value={transferidoEm} onChange={e => setTransferidoEm(e.target.value)} />
        </div>
        <div>
          <label style={label}>Para a escola</label>
          <input style={{ ...input, width: '100%' }} placeholder="Nome da escola" value={transferidoPara} onChange={e => setTransferidoPara(e.target.value)} />
        </div>
        <div>
          <label style={label}>Deixou de frequentar em</label>
          <input style={{ ...input, width: '100%' }} type="date" value={deixouEm} onChange={e => setDeixouEm(e.target.value)} />
        </div>
      </div>

      <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={imprimir}>🖨️ Imprimir Declaração de Frequência</button>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function Formularios() {
  const { theme: themeMode } = useTheme();
  const isDark = themeMode === 'dark';
  const [formularioAtivo, setFormularioAtivo] = useState<FormKey | null>(null);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getTurmas(), api.getAllAlunos()])
      .then(([t, a]) => { setTurmas(t ?? []); setAlunos(a ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const form = FORMULARIOS.find(f => f.key === formularioAtivo);

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 20, marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginBottom: 4 }}>📄 Formulários</h1>
        <p style={{ color: theme.textMuted, fontSize: 13 }}>Selecione o formulário, preencha os dados e imprima em A4.</p>
      </div>

      {/* Cards de seleção */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {FORMULARIOS.map(f => (
          <div
            key={f.key}
            onClick={() => setFormularioAtivo(formularioAtivo === f.key ? null : f.key)}
            style={{
              background: formularioAtivo === f.key ? theme.primary : theme.card,
              borderRadius: theme.radiusMd, padding: '16px 18px', cursor: 'pointer',
              boxShadow: theme.shadow, border: `1.5px solid ${formularioAtivo === f.key ? theme.primary : theme.borderLight}`,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: formularioAtivo === f.key ? '#fff' : theme.text, marginBottom: 4 }}>{f.label}</div>
            <div style={{ fontSize: 12, color: formularioAtivo === f.key ? 'rgba(255,255,255,0.8)' : theme.textMuted }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Formulário ativo */}
      {formularioAtivo && form && (
        <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 24, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginBottom: 20 }}>
            {form.icon} {form.label}
          </h2>
          {loading ? (
            <p style={{ color: theme.textMuted }}>Carregando dados...</p>
          ) : (
            <>
              {formularioAtivo === 'entrada'     && <FormEntrada turmas={turmas} alunos={alunos} />}
              {formularioAtivo === 'saida'       && <FormSaida turmas={turmas} alunos={alunos} />}
              {formularioAtivo === 'infantil'    && <FormInfantil turmas={turmas} alunos={alunos} />}
              {formularioAtivo === 'fundamental' && <FormFundamental turmas={turmas} alunos={alunos} />}
              {formularioAtivo === 'frequencia'  && <FormFrequencia turmas={turmas} alunos={alunos} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

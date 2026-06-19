import { useEffect, useState } from 'react';
import { supabase } from '../api';
import { theme, btn } from '../styles';
import { Loading } from '../components';

const ESCOLA = {
  nome: 'EMEIEF Luiz Gonzaga',
  endereco: 'Rua Ipanema, 253 – Parque Erasmo Assunção – Santo André – SP',
  tel: '(11) 3356-7962',
  email: 'perasmo@santoandre.sp.gov.br',
  diretora: 'TEREZINHA',
};

// Remove acentos, ordinais, períodos e espaços extras para comparação
function normSimp(s: string): string {
  return (s ?? '').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ªº°]/g, '')
    .replace(/\bPRE[\s-]*ESCOLA\b/g, '')
    .replace(/\b(MANHA|TARDE|NOTURNO|NOITE|MATUTINO|VESPERTINO|ANUAL|INTEGRAL)\b/g, '')
    .replace(/[-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTurmaAlvo(nomeTurma: string): boolean {
  const n = normSimp(nomeTurma);
  // 2ª ETAPA A–H (pré-escola, 5 anos)
  if (/^2\s*ETAPA\s+[A-H]$/.test(n)) return true;
  // 5º ano A–D
  if (/^5\s*(ANO|SERIE)\s+[A-D]$/.test(n)) return true;
  return false;
}

// Ordena turmas: 2ª ETAPA primeiro (A→H), depois 5º ano (A→D)
function ordemProtocolo(nome: string): string {
  const n = normSimp(nome);
  if (/^2\s*ETAPA/.test(n)) return '1' + n;
  if (/^5\s*(ANO|SERIE)/.test(n)) return '2' + n;
  return '9' + n;
}

function isAtivo(situacao: string | null | undefined): boolean {
  return !situacao || situacao === 'ATIVO';
}

export default function Protocolo() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [turmaSel, setTurmaSel] = useState('__all__');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: turmaData } = await supabase.from('Turma').select('*').order('nome');
      const alvo = (turmaData ?? [])
        .filter(t => isTurmaAlvo(t.nome))
        .sort((a, b) => ordemProtocolo(a.nome).localeCompare(ordemProtocolo(b.nome)));
      setTurmas(alvo);

      if (alvo.length > 0) {
        const ids = alvo.map(t => t.id);
        const { data: alunoData } = await supabase
          .from('Aluno').select('id,nome,situacao,turmaId,numero')
          .in('turmaId', ids)
          .order('numero', { nullsFirst: false })
          .order('nome');
        setAlunos((alunoData ?? []).filter(a => isAtivo(a.situacao)));
      }
      setLoading(false);
    };
    load();
  }, []);

  const turmasFiltradas = turmaSel === '__all__' ? turmas : turmas.filter(t => t.id === turmaSel);

  const gerarHTML = () => {
    const blocos = turmasFiltradas.map(turma => {
      const lista = alunos
        .filter(a => a.turmaId === turma.id)
        .sort((a, b) => {
          const na = a.numero ?? 9999;
          const nb = b.numero ?? 9999;
          if (na !== nb) return na - nb;
          return a.nome.localeCompare(b.nome, 'pt-BR');
        });

      const periodo = (turma.periodo ?? '').toLowerCase();
      const manha = periodo.includes('manh') || periodo.includes('manhã');

      const linhas = Array.from({ length: Math.max(lista.length, 18) }, (_, i) => {
        const aluno = lista[i];
        const nr = aluno?.numero ? aluno.numero : (i + 1);
        const nome = aluno?.nome ?? '';
        return `<tr>
          <td style="text-align:center;width:28px">${nr}</td>
          <td style="width:38%">${nome}</td>
          <td></td><td style="width:13%"></td><td style="width:13%"></td>
        </tr>`;
      }).join('');

      return `
<div style="page-break-after:always;padding:16mm 14mm;font-family:Arial,sans-serif;font-size:11px;color:#000;max-width:210mm;margin:0 auto">
  <div style="text-align:center;margin-bottom:6px">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" width="42" height="34" style="display:block;margin:0 auto 3px">
      <rect x="5" y="5" width="90" height="70" rx="4" fill="none" stroke="#000" stroke-width="3"/>
      <text x="50" y="35" text-anchor="middle" font-size="14" font-family="serif" font-weight="bold">X</text>
    </svg>
    <div style="font-size:13px;font-weight:bold;letter-spacing:2px">PREFEITURA DE SANTO ANDRÉ</div>
  </div>
  <div style="text-align:center;margin-bottom:10px">
    <div style="font-weight:bold">${ESCOLA.nome}</div>
    <div>Endereço: ${ESCOLA.endereco}</div>
    <div>Tel. ${ESCOLA.tel} &nbsp;&nbsp;&nbsp; E-mail: ${ESCOLA.email}</div>
  </div>
  <div style="margin-bottom:14px;line-height:2.2">
    <div><strong>Diretora da Unidade Escolar:</strong> ${ESCOLA.diretora}</div>
    <div><strong>Professor(a):</strong> ${turma.professora ?? ''}</div>
    <div><strong>Ano/Ciclo:</strong> ${turma.nome}</div>
    <div><strong>Período:</strong>
      <span style="border:1px solid #000;padding:0 3px">(${manha ? 'X' : ' '})</span> Manhã &nbsp;&nbsp;&nbsp;
      <span style="border:1px solid #000;padding:0 3px">(${!manha ? 'X' : ' '})</span> Tarde
    </div>
  </div>
  <div style="text-align:center;font-weight:bold;font-size:13px;margin:14px 0 10px">PROTOCOLO DE ENTREGA</div>
  <p style="margin-bottom:14px;text-align:justify">
    Declaro ter recebido o informativo "Esclarecimentos sobre Divisão de Demanda do Ensino Fundamental 2027".
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:10.5px">
    <thead>
      <tr style="background:#eee">
        <th style="border:1px solid #000;padding:4px 6px;text-align:center">Nº</th>
        <th style="border:1px solid #000;padding:4px 6px;width:38%">Nome do Aluno</th>
        <th style="border:1px solid #000;padding:4px 6px">Nome do Responsável</th>
        <th style="border:1px solid #000;padding:4px 6px;width:13%">Grau de Parentesco</th>
        <th style="border:1px solid #000;padding:4px 6px;width:13%">Data do Recebimento</th>
      </tr>
    </thead>
    <tbody>
      ${linhas.replace(/border:1px solid #000;/g, 'border:1px solid #000;')}
    </tbody>
  </table>
  <div style="text-align:center;margin-top:36px;font-size:11px">
    ___________________________________________________<br/>
    Carimbo e assinatura da Direção da Unidade Escolar
  </div>
</div>`;
    });

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Protocolo de Entrega – Divisão de Demanda 2027</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#fff}
  table td,table th{border:1px solid #000;padding:3px 5px;vertical-align:middle}
  @media print{@page{size:A4;margin:8mm}body{-webkit-print-color-adjust:exact}}
</style></head><body>${blocos.join('')}
<script>setTimeout(()=>window.print(),400)</script></body></html>`;
  };

  const imprimir = () => {
    const win = window.open('', '_blank');
    if (!win) { alert('Permita popups para gerar o protocolo.'); return; }
    win.document.write(gerarHTML());
    win.document.close();
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>📄 Protocolo de Entrega</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={turmaSel}
            onChange={e => setTurmaSel(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14 }}
          >
            <option value="__all__">Todas as turmas ({turmas.length})</option>
            {turmas.map(t => (
              <option key={t.id} value={t.id}>{t.nome} – {t.professora}</option>
            ))}
          </select>
          <button onClick={imprimir} style={btn('primary')} disabled={loading || turmasFiltradas.length === 0}>
            🖨️ Gerar / Imprimir
          </button>
        </div>
      </div>

      <div style={{ background: theme.card, borderRadius: 10, padding: '10px 16px', marginBottom: 16, border: `1px solid ${theme.borderLight}`, fontSize: 13, color: theme.textSecondary }}>
        <strong>Divisão de Demanda – Ensino Fundamental 2027</strong> &nbsp;·&nbsp;
        Turmas: <strong>2ª ETAPA A–H</strong> (pré-escola, 5 anos) e <strong>5º Ano A–D</strong> &nbsp;·&nbsp;
        Apenas alunos <strong>ativos</strong>, em ordem <strong>alfabética</strong> &nbsp;·&nbsp;
        Diretora: <strong>{ESCOLA.diretora}</strong>
      </div>

      {loading ? <Loading /> : turmas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: theme.textSecondary }}>
          Nenhuma turma de 2ª ETAPA ou 5º Ano encontrada no banco de dados.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {turmasFiltradas.map(t => {
            const lista = alunos
              .filter(a => a.turmaId === t.id)
              .sort((a, b) => {
                const na = a.numero ?? 9999;
                const nb = b.numero ?? 9999;
                if (na !== nb) return na - nb;
                return a.nome.localeCompare(b.nome, 'pt-BR');
              });
            return (
              <div key={t.id} style={{
                background: theme.card, borderRadius: 10, border: `1px solid ${theme.borderLight}`,
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 16px', background: theme.primary, color: 'white',
                }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{t.nome}</span>
                    {t.professora && <span style={{ fontWeight: 400, marginLeft: 10, opacity: 0.9 }}>Prof. {t.professora}</span>}
                    {t.periodo && <span style={{ marginLeft: 10, opacity: 0.75, fontSize: 12 }}>{t.periodo}</span>}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 10px' }}>
                    {lista.length} aluno{lista.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ padding: '10px 16px', fontSize: 13 }}>
                  {lista.length === 0 ? (
                    <span style={{ color: theme.textMuted, fontStyle: 'italic' }}>Nenhum aluno ativo</span>
                  ) : (
                    <div style={{ columns: lista.length > 20 ? 2 : 1, columnGap: 24 }}>
                      {lista.map((a, idx) => (
                        <div key={a.id} style={{ padding: '2px 0', color: theme.text, display: 'flex', gap: 8, alignItems: 'baseline', breakInside: 'avoid' }}>
                          <span style={{ minWidth: 28, fontWeight: 700, color: theme.textSecondary, textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                            {a.numero ?? (idx + 1)}
                          </span>
                          <span>{a.nome}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

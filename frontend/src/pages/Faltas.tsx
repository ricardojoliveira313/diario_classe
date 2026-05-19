import { useEffect, useState } from 'react';
import { api } from '../api';

const btn = { padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 };
const input = { padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', marginBottom: 8 };
const label = { fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' };

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Dias Letivos por mês — baseado no Calendário Escolar 2026
const DIAS_LETIVOS: Record<number, number> = {
  1: 4, 2: 13, 3: 22, 4: 18, 5: 20, 6: 21,
  7: 9, 8: 21, 9: 22, 10: 18, 11: 20, 12: 17,
};

export default function Faltas() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano] = useState(2026);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [faltas, setFaltas] = useState<Record<string, number>>({});
  const [freqTextos, setFreqTextos] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getTurmas().then(t => { setTurmas(t); if (t.length) setTurmaId(t[0].id); }); }, []);

  useEffect(() => {
    if (!turmaId) return;
    Promise.all([api.getAlunos(turmaId), api.getFaltas(turmaId, mes, ano)]).then(([al, fa]) => {
      setAlunos(al);
      const mapF: Record<string, number> = {};
      const mapT: Record<string, string> = {};
      fa.forEach((f: any) => { mapF[f.alunoId] = f.faltas; if (f.frequencia) mapT[f.alunoId] = f.frequencia; });
      setFaltas(mapF);
      setFreqTextos(mapT);
      setSaved(false);
    });
  }, [turmaId, mes]);

  const setFalta = (alunoId: string, val: number) => {
    setFaltas(prev => ({ ...prev, [alunoId]: Math.max(0, val) }));
    setSaved(false);
  };

  const salvar = async () => {
    setSaving(true);
    const registros = alunos.map(a => ({
      alunoId: a.id, turmaId, mes, ano,
      faltas: faltas[a.id] ?? 0,
      frequencia: '',
    }));
    await api.upsertFaltasBatch(registros);
    setSaving(false);
    setSaved(true);
  };

  const totalFaltas = alunos.reduce((s, a) => s + (faltas[a.id] ?? 0), 0);
  const dl = DIAS_LETIVOS[mes] ?? 22;
  const freqGeral = alunos.length > 0 ? ((dl * alunos.length - totalFaltas) / (dl * alunos.length) * 100).toFixed(1) : '0.0';

  return (
    <div>
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Lançamento de Faltas</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={label}>Turma</label>
            <select style={{ ...input, marginBottom: 0 }} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome || `${t.numero}º ${t.letra} - ${t.periodo}`}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Mês</label>
            <select style={{ ...input, marginBottom: 0 }} value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {alunos.length === 0 && (
        <p style={{ textAlign: 'center', color: '#64748b', marginTop: 32 }}>
          {turmas.length === 0 ? 'Cadastre turmas e alunos primeiro.' : 'Nenhum aluno nesta turma.'}
        </p>
      )}

      {alunos.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ background: 'white', borderRadius: 8, padding: 12, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Dias Letivos</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af' }}>{dl}</div>
            </div>
            <div style={{ background: 'white', borderRadius: 8, padding: 12, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Total Faltas</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{totalFaltas}</div>
            </div>
            <div style={{ background: 'white', borderRadius: 8, padding: 12, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Frequência Geral</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: Number(freqGeral) >= 85 ? '#16a34a' : '#dc2626' }}>{freqGeral}%</div>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
            <div style={{ background: '#1e40af', color: 'white', padding: '10px 16px', display: 'grid', gridTemplateColumns: '36px 1fr 28px 100px 55px', gap: 8, fontSize: 12, fontWeight: 600 }}>
              <span>#</span><span>Aluno</span><span title="Bolsa Família">💚</span><span style={{ textAlign: 'center' }}>Faltas</span><span style={{ textAlign: 'center' }}>%</span>
            </div>
            {alunos.map((a, i) => (
              <div key={a.id} style={{ padding: '9px 16px', display: 'grid', gridTemplateColumns: '36px 1fr 28px 100px 55px', gap: 8, alignItems: 'center', borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{a.numero || i + 1}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.nome}</div>
                  {a.situacao && a.situacao !== 'ATIVO' && (
                    <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>{a.situacao}</span>
                  )}
                </div>
                <span style={{ textAlign: 'center', fontSize: 13 }}>{a.bolsa_familia ? '✅' : ''}</span>
                {freqTextos[a.id] ? (
                  <span style={{ fontSize: 10, color: '#9333ea', fontWeight: 700, textAlign: 'center', padding: '2px 4px', background: '#f3e8ff', borderRadius: 4 }}>
                    {freqTextos[a.id]}
                  </span>
                ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                  <button style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}
                    onClick={() => setFalta(a.id, (faltas[a.id] ?? 0) - 1)}>−</button>
                  <span style={{ width: 28, textAlign: 'center', fontWeight: 700, fontSize: 16, color: (faltas[a.id] ?? 0) > 0 ? '#dc2626' : '#1e293b' }}>
                    {faltas[a.id] ?? 0}
                  </span>
                  <button style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}
                    onClick={() => setFalta(a.id, (faltas[a.id] ?? 0) + 1)}>+</button>
                </div>
                )}
                <span style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: (((dl - (faltas[a.id] ?? 0)) / dl * 100) >= 85) ? '#16a34a' : '#dc2626' }}>
                  {((dl - (faltas[a.id] ?? 0)) / dl * 100).toFixed(0)}%
                </span>
              </div>
            ))}
            <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '40px 1fr 120px 55px', gap: 8, background: '#f8fafc', fontWeight: 700 }}>
              <span></span><span>Total</span><span style={{ textAlign: 'center', color: '#dc2626' }}>{totalFaltas} faltas</span><span style={{ textAlign: 'center' }}>{freqGeral}%</span>
            </div>
          </div>

          <button
            style={{ ...btn, background: saved ? '#16a34a' : '#1e40af', color: 'white', width: '100%', padding: '12px', fontSize: 15 }}
            onClick={salvar}
            disabled={saving}
          >
            {saving ? 'Salvando...' : saved ? '✓ Salvo!' : '💾 Salvar Faltas'}
          </button>
        </>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api, supabase } from '../api';
import { theme, btn, input, label, card as cardStyle, sortTurmasPedagogico } from '../styles';
import { Loading, EmptyState, Spinner } from '../components';
import { useAuth } from '../AuthContext';

// normaliza para comparação: maiúsculas, sem acento, sem ordinais, espaços simples
const norm = (s: string) =>
  (s ?? '').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ªº°]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// versão simplificada: remove PRÉ-ESCOLA, MANHA, TARDE, ANUAL
// permite casar "1ª ETAPA A" com "1ª ETAPA PRÉ- ESCOLA A MANHA ANUAL"
const normSimp = (s: string) =>
  norm(s)
    .replace(/\bPRE[\s-]*ESCOLA\b/g, '')
    .replace(/\b(MANHA|TARDE|NOTURNO|NOITE|MATUTINO|VESPERTINO|ANUAL|INTEGRAL)\b/g, '')
    .replace(/[-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export default function Turmas() {
  const { role } = useAuth();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [form, setForm] = useState({ nome: '', etapa: 'EF1', numero: 1, letra: 'A', periodo: 'Manhã', professora: '' });
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; professora: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [resultRestaura, setResultRestaura] = useState<{ criadas: number; atualizadas: number; erros: number } | null>(null);

  // --- importação em lote ---
  const [importando, setImportando] = useState(false);
  const [textoImport, setTextoImport] = useState('');
  const [preview, setPreview] = useState<{ turmaId: string; nomeTurma: string; professora: string; encontrou: boolean }[]>([]);
  const [salvandoImport, setSalvandoImport] = useState(false);
  const [resultImport, setResultImport] = useState<{ ok: number; nao: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const TURMAS_PADRAO = [
    { nome: '1ª ETAPA A', professora: 'Maria Lucia', periodo: 'Manhã' },
    { nome: '1ª ETAPA B', professora: 'Denise', periodo: 'Manhã' },
    { nome: '1ª ETAPA C', professora: 'Fernanda', periodo: 'Manhã' },
    { nome: '1ª ETAPA D', professora: 'Celina', periodo: 'Manhã' },
    { nome: '1ª ETAPA E', professora: 'Debora', periodo: 'Tarde' },
    { nome: '1ª ETAPA F', professora: 'Andressa', periodo: 'Tarde' },
    { nome: '1ª ETAPA G', professora: 'Rosangela', periodo: 'Tarde' },
    { nome: '1ª ETAPA H', professora: 'Adriana Zenoides', periodo: 'Tarde' },
    { nome: '2ª ETAPA A', professora: 'Liliane', periodo: 'Manhã' },
    { nome: '2ª ETAPA B', professora: 'Silvana', periodo: 'Manhã' },
    { nome: '2ª ETAPA C', professora: 'Michele', periodo: 'Manhã' },
    { nome: '2ª ETAPA D', professora: 'Solange', periodo: 'Manhã' },
    { nome: '2ª ETAPA E', professora: 'Sabrina', periodo: 'Tarde' },
    { nome: '2ª ETAPA F', professora: 'Angelita', periodo: 'Tarde' },
    { nome: '2ª ETAPA G', professora: 'Kamila', periodo: 'Tarde' },
    { nome: '2ª ETAPA H', professora: 'Danielle', periodo: 'Tarde' },
    { nome: '1º ano A', professora: 'Roseli Pereira', periodo: 'Manhã' },
    { nome: '1º ano B', professora: 'Bruna', periodo: 'Manhã' },
    { nome: '1º ano C', professora: 'Luciany', periodo: 'Tarde' },
    { nome: '1º ano D', professora: 'Silene', periodo: 'Tarde' },
    { nome: '1º ano E', professora: 'Bianca', periodo: 'Tarde' },
    { nome: '2º ano A', professora: 'Ione', periodo: 'Manhã' },
    { nome: '2º ano B', professora: 'Sandra', periodo: 'Manhã' },
    { nome: '2º ano C', professora: 'Gilmara', periodo: 'Manhã' },
    { nome: '2º ano D', professora: 'Paula', periodo: 'Tarde' },
    { nome: '2º ano E', professora: 'Marta', periodo: 'Tarde' },
    { nome: '3º ano A', professora: 'Magnus', periodo: 'Manhã' },
    { nome: '3º ano B', professora: 'Thabata', periodo: 'Manhã' },
    { nome: '3º ano C', professora: 'Cátia', periodo: 'Tarde' },
    { nome: '3º ano D', professora: 'Adriana Caetano', periodo: 'Tarde' },
    { nome: '4º ano A', professora: 'Juliana', periodo: 'Manhã' },
    { nome: '4º ano B', professora: 'Camila P', periodo: 'Manhã' },
    { nome: '4º ano C', professora: 'Cida Drigo', periodo: 'Tarde' },
    { nome: '4º ano D', professora: 'Karine', periodo: 'Tarde' },
    { nome: '5º ano A', professora: 'Roseli Zamana', periodo: 'Manhã' },
    { nome: '5º ano B', professora: 'Jessica', periodo: 'Manhã' },
    { nome: '5º ano C', professora: 'Alessandra', periodo: 'Tarde' },
    { nome: '5º ano D', professora: 'Raquel', periodo: 'Tarde' },
    { nome: 'EJA I – ALFABETIZAÇÃO', professora: 'Maria dos Anjos Ferreira do Carmo', periodo: 'Noite' },
    { nome: 'EJA I – POS-ALFABETIZAÇÃO', professora: 'Elaine Aparecida da Silva Figueiredo', periodo: 'Noite' },
  ];

  const load = () => api.getTurmas().then(d => setTurmas(sortTurmasPedagogico(d || []))).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (role !== 'admin') return;
    setSaving(true);
    try {
      await api.createTurma({ nome: form.nome.trim(), professora: form.professora.trim() });
      setAdding(false);
      setForm({ nome: '', etapa: 'EF1', numero: 1, letra: 'A', periodo: 'Manhã', professora: '' });
      load();
    } catch (err: any) {
      alert(`Erro ao salvar turma: ${err?.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  const restaurarTurmasPadrao = async () => {
    if (role !== 'admin') return;
    if (!confirm(`Restaurar as ${TURMAS_PADRAO.length} turmas padrão da escola?\n\nTurmas existentes (mesmo com nome do SED) terão nome, professora e período atualizados.\nTurmas inexistentes serão criadas.\nTurmas duplicadas e vazias serão removidas.`)) return;
    setRestaurando(true);
    setResultRestaura(null);
    let criadas = 0, atualizadas = 0, erros = 0, limpas = 0;
    const atuais = await api.getTurmas();
    const idsUsados = new Set<string>();

    for (const tp of TURMAS_PADRAO) {
      // Match por nome exato primeiro, depois por normSimp (apanha nomes do SED)
      const match = atuais.find((t: any) => norm(t.nome) === norm(tp.nome))
        ?? atuais.find((t: any) => normSimp(t.nome) === normSimp(tp.nome));
      try {
        if (match) {
          await api.updateTurma(match.id, { nome: tp.nome, professora: tp.professora, periodo: tp.periodo });
          idsUsados.add(match.id);
          atualizadas++;
        } else {
          const nova = await api.createTurma({ nome: tp.nome, professora: tp.professora, periodo: tp.periodo });
          if (nova?.id) idsUsados.add(nova.id);
          criadas++;
        }
      } catch { erros++; }
    }

    // Limpar turmas duplicadas vazias (criadas por runs anteriores com nome errado)
    const normSimpsPadrao = new Set(TURMAS_PADRAO.map(tp => normSimp(tp.nome)));
    for (const t of atuais) {
      if (idsUsados.has(t.id)) continue;
      if (!normSimpsPadrao.has(normSimp(t.nome))) continue;
      // É duplicata de turma padrão — apagar só se não tiver alunos
      const { count } = await supabase.from('Aluno').select('*', { count: 'exact', head: true }).eq('turmaId', t.id);
      if (count === 0) {
        try { await api.deleteTurma(t.id); limpas++; } catch {}
      }
    }

    setRestaurando(false);
    setResultRestaura({ criadas, atualizadas, erros });
    load();
  };

  const salvarEdicao = async () => {
    if (role !== 'admin' || !editando) return;
    setSavingEdit(true);
    try {
      await api.updateTurma(editando.id, { professora: editando.professora });
      setEditando(null);
      load();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err?.message ?? err}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const del = async (id: string, nome: string) => {
    if (role !== 'admin') return;
    if (!confirm(`Excluir turma "${nome}"? Todos os alunos e faltas serão removidos.`)) return;
    setDeleting(id);
    try {
      await api.deleteTurma(id);
      load();
    } catch (err: any) {
      alert(`Erro ao excluir: ${err?.message ?? err}`);
    } finally {
      setDeleting(null);
    }
  };

  // --- importação em lote ---
  const parsearLinhas = (texto: string, lista: any[]) => {
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    return linhas.map(linha => {
      const sep = linha.includes('|') ? '|' : linha.includes(';') ? ';' : linha.includes('\t') ? '\t' : null;
      if (!sep) return null;
      const partes = linha.split(sep).map(p => p.trim());
      const nomeTurma = partes[0] ?? '';
      const professora = partes[1] ?? '';
      // Tenta match exato, depois simplificado (sem PRÉ-ESCOLA/MANHA/ANUAL)
      const match = lista.find(t => norm(t.nome) === norm(nomeTurma))
        ?? lista.find(t => normSimp(t.nome) === normSimp(nomeTurma));
      return { turmaId: match?.id ?? '', nomeTurma, professora, encontrou: !!match };
    }).filter(Boolean) as any[];
  };

  const processarTexto = (texto: string) => {
    setTextoImport(texto);
    setPreview(parsearLinhas(texto, turmas));
    setResultImport(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) return;
      const keys = Object.keys(rows[0]);
      const turmaKey = keys.find(k => norm(k).includes('TURMA') || norm(k).includes('CLASSE'));
      const profKey = keys.find(k => norm(k).includes('PROFESSOR') || norm(k).includes('PROF') || norm(k).includes('DOCENTE'));
      if (!turmaKey || !profKey) {
        alert('A planilha precisa ter colunas com "TURMA" e "PROFESSOR" (ou PROFESSORA / DOCENTE).');
        return;
      }
      const texto = rows
        .filter(r => r[turmaKey] && r[profKey])
        .map(r => `${r[turmaKey]} | ${r[profKey]}`)
        .join('\n');
      processarTexto(texto);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const salvarImport = async () => {
    if (role !== 'admin') return;
    const matches = preview.filter(p => p.encontrou && p.professora.trim());
    if (!matches.length) return;
    setSalvandoImport(true);
    let ok = 0, nao = 0;
    for (const m of matches) {
      try {
        await api.updateTurma(m.turmaId, { professora: m.professora.trim() });
        ok++;
      } catch { nao++; }
    }
    setSalvandoImport(false);
    setResultImport({ ok, nao });
    setPreview([]);
    setTextoImport('');
    load();
  };

  if (loading) return <Loading />;

  const semProfessora = turmas.filter(t => !t.professora).length;

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.text }}>👩‍🏫 Turmas</h1>
          {semProfessora > 0 && (
            <div style={{ fontSize: 13, color: theme.orange ?? '#ea580c', marginTop: 2 }}>
              ⚠️ {semProfessora} turma{semProfessora > 1 ? 's' : ''} sem professora vinculada
            </div>
          )}
        </div>
        {role === 'admin' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              style={btn('warning', { outline: true })}
              onClick={restaurarTurmasPadrao}
              disabled={restaurando}
              title="Restaura as 38 turmas padrão da escola com professoras e períodos"
            >
              {restaurando ? <><Spinner size={14} /> Restaurando...</> : '🏫 Restaurar Turmas'}
            </button>
            <button style={btn('success', { outline: true })} onClick={() => { setImportando(!importando); setAdding(false); }}>
              {importando ? 'Fechar importação' : '📥 Importar Professoras'}
            </button>
            <button style={adding ? btn('ghost') : btn('primary')} onClick={() => { setAdding(!adding); setImportando(false); }}>
              {adding ? 'Cancelar' : '+ Nova Turma'}
            </button>
          </div>
        )}
      </div>

      {/* Resultado da restauração de turmas */}
      {resultRestaura && (
        <div style={{
          padding: '12px 16px', marginBottom: 12, borderRadius: 8,
          background: resultRestaura.erros > 0 ? '#fff7ed' : '#f0fdf4',
          border: `1px solid ${resultRestaura.erros > 0 ? '#fed7aa' : '#bbf7d0'}`,
          fontSize: 14, color: resultRestaura.erros > 0 ? '#9a3412' : '#166534', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>
            ✅ {resultRestaura.criadas} turma{resultRestaura.criadas !== 1 ? 's' : ''} criada{resultRestaura.criadas !== 1 ? 's' : ''}
            {' · '}
            🔄 {resultRestaura.atualizadas} atualizada{resultRestaura.atualizadas !== 1 ? 's' : ''}
            {resultRestaura.erros > 0 && <span style={{ color: '#dc2626' }}> · ❌ {resultRestaura.erros} com erro</span>}
          </span>
          <button onClick={() => setResultRestaura(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* Painel de importação em lote */}
      {importando && (
        <div className="slide-down" style={{
          background: theme.card, borderRadius: theme.radiusMd,
          padding: 20, marginBottom: 16, boxShadow: theme.shadowMd,
          border: `2px solid ${theme.success ?? '#22c55e'}`,
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: theme.text }}>
            📥 Importar Professoras em Lote
          </h2>
          <p style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 14 }}>
            Cole abaixo uma linha por turma no formato <strong>TURMA | PROFESSORA</strong> — ou suba uma planilha Excel com essas colunas.
          </p>

          {/* Exemplo */}
          <div style={{ background: theme.bg ?? '#f8fafc', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 12, fontFamily: 'monospace', color: theme.textSecondary, border: `1px solid ${theme.borderLight}` }}>
            1ª ETAPA A | MARIA LUCIA<br />
            1ª ETAPA B | DENISE SILVA<br />
            2º ANO A - MANHÃ | ANA PAULA<br />
            3º ANO B | CARLOS EDUARDO
          </div>

          {/* Upload de Excel */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <button style={btn('primary', { small: true, outline: true })} onClick={() => fileRef.current?.click()}>
              📊 Subir planilha Excel
            </button>
            <span style={{ fontSize: 12, color: theme.textMuted }}>
              (coluna TURMA + coluna PROFESSOR ou PROFESSORA)
            </span>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          {/* Textarea */}
          <label style={label}>Ou cole aqui (TURMA | PROFESSORA):</label>
          <textarea
            style={{ ...input, height: 140, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' } as any}
            placeholder={'1ª ETAPA A | MARIA LUCIA\n1ª ETAPA B | DENISE\n...'}
            value={textoImport}
            onChange={e => processarTexto(e.target.value)}
          />

          {/* Preview de matches */}
          {preview.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: theme.text }}>
                Prévia — {preview.filter(p => p.encontrou).length} de {preview.length} turmas encontradas:
              </div>
              <div style={{ border: `1px solid ${theme.borderLight}`, borderRadius: 8, overflow: 'hidden' }}>
                {/* header */}
                <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 80px', gap: 8, padding: '8px 12px', background: theme.primary, color: 'white', fontSize: 12, fontWeight: 700 }}>
                  <span></span><span>Turma (planilha)</span><span>Professora</span><span>Status</span>
                </div>
                {preview.map((p, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '24px 1fr 1fr 80px', gap: 8,
                    padding: '8px 12px', fontSize: 13,
                    background: p.encontrou ? (i % 2 === 0 ? 'white' : '#f8fafc') : '#fff7ed',
                    borderTop: i > 0 ? `1px solid ${theme.borderLight}` : undefined,
                    alignItems: 'center',
                  }}>
                    <span>{p.encontrou ? '✅' : '❌'}</span>
                    <span style={{ fontWeight: 600, color: p.encontrou ? theme.text : '#ea580c' }}>{p.nomeTurma}</span>
                    <input
                      style={{ ...input, margin: 0, fontSize: 12, padding: '4px 8px' }}
                      value={p.professora}
                      onChange={e => setPreview(prev => prev.map((x, j) => j === i ? { ...x, professora: e.target.value } : x))}
                    />
                    <span style={{ fontSize: 11, color: p.encontrou ? '#16a34a' : '#ea580c', fontWeight: 700 }}>
                      {p.encontrou ? 'Encontrou' : 'Não achou'}
                    </span>
                  </div>
                ))}
              </div>
              {preview.some(p => !p.encontrou) && (
                <div style={{ fontSize: 12, color: '#ea580c', marginTop: 6 }}>
                  ❌ Turmas "não achadas" têm nome diferente do sistema. Verifique a grafia ou edite manualmente.
                </div>
              )}
            </div>
          )}

          {/* Resultado */}
          {resultImport && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 14, color: '#166534', fontWeight: 600 }}>
              ✅ {resultImport.ok} professora{resultImport.ok !== 1 ? 's' : ''} vinculada{resultImport.ok !== 1 ? 's' : ''}
              {resultImport.nao > 0 && <span style={{ color: '#dc2626' }}> · {resultImport.nao} com erro</span>}
            </div>
          )}

          {/* Botão confirmar */}
          {preview.filter(p => p.encontrou && p.professora.trim()).length > 0 && !resultImport && (
            <button
              style={{ ...btn('success', { full: true }), marginTop: 14, fontSize: 15 }}
              onClick={salvarImport}
              disabled={salvandoImport}
            >
              {salvandoImport
                ? <><Spinner size={18} /> Salvando...</>
                : `✅ Confirmar e vincular ${preview.filter(p => p.encontrou && p.professora.trim()).length} professora(s)`}
            </button>
          )}
        </div>
      )}

      {/* Formulário nova turma */}
      {adding && (
        <div className="slide-down" style={{
          background: theme.card, borderRadius: theme.radiusMd,
          padding: 20, marginBottom: 16, boxShadow: theme.shadowMd,
          border: `1px solid ${theme.border}`,
        }}>
          <label style={label}>Nome da Turma</label>
          <input style={input} placeholder="Ex: 1ª ETAPA A" value={form.nome}
            onChange={e => setForm({ ...form, nome: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <label style={label}>Etapa</label>
              <select style={input} value={form.etapa} onChange={e => setForm({ ...form, etapa: e.target.value })}>
                <option>EI</option><option>EF1</option><option>EF2</option><option>EJA</option>
              </select>
            </div>
            <div>
              <label style={label}>Período</label>
              <select style={input} value={form.periodo} onChange={e => setForm({ ...form, periodo: e.target.value })}>
                <option>Manhã</option><option>Tarde</option><option>Integral</option><option>Noturno</option>
              </select>
            </div>
            <div>
              <label style={label}>Nº da Sala <span style={{ fontWeight: 400, color: theme.textMuted }}>(opcional)</span></label>
              <input style={input} type="number" value={form.numero}
                onChange={e => setForm({ ...form, numero: Number(e.target.value) })} />
            </div>
            <div>
              <label style={label}>Turno / Letra <span style={{ fontWeight: 400, color: theme.textMuted }}>(opcional)</span></label>
              <input style={input} value={form.letra}
                onChange={e => setForm({ ...form, letra: e.target.value })} />
            </div>
          </div>
          <label style={{ ...label, marginTop: 8 }}>Professor(a)</label>
          <input style={input} placeholder="Nome da professora" value={form.professora}
            onChange={e => setForm({ ...form, professora: e.target.value })} />
          <button style={{ ...btn('success', { full: true }), marginTop: 12 }} onClick={save} disabled={saving}>
            {saving ? <Spinner size={16} /> : null}
            {saving ? 'Salvando...' : '💾 Salvar Turma'}
          </button>
        </div>
      )}

      {turmas.length === 0 && !adding && (
        <EmptyState icon="👩‍🏫" message="Nenhuma turma cadastrada."
          action={{ label: 'Clique em "+ Nova Turma" para começar', href: '#' }}
        />
      )}

      {/* Lista de turmas */}
      {turmas.map((t, i) => (
        <div key={t.id} className="slide-down" style={{
          ...cardStyle({ padding: 16, marginBottom: 10 }),
          animationDelay: `${i * 0.05}s`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 16, color: theme.text }}>{t.nome || `${t.numero}º ${t.letra} - ${t.periodo}`}</strong>
              <div style={{ fontSize: 14, color: theme.textSecondary, marginTop: 2 }}>
                {t.periodo}
                {t.professora
                  ? <span style={{ color: theme.primaryText, fontWeight: 600 }}> · Prof. {t.professora}</span>
                  : <span style={{ color: '#ea580c', fontWeight: 500 }}> · ⚠️ sem professora</span>}
              </div>
            </div>
            {role === 'admin' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={btn('primary', { small: true, outline: true })}
                  onClick={() => setEditando(editando?.id === t.id ? null : { id: t.id, professora: t.professora ?? '' })}>
                  ✏️ Professora
                </button>
                <button style={btn('danger', { small: true, outline: true })}
                  onClick={() => del(t.id, t.nome)} disabled={deleting === t.id}>
                  {deleting === t.id ? <Spinner size={14} /> : 'Excluir'}
                </button>
              </div>
            )}
          </div>
          {editando?.id === t.id && editando && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...input, flex: 1, margin: 0 }}
                placeholder="Nome da professora"
                value={editando.professora}
                onChange={e => setEditando({ ...editando, professora: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(); if (e.key === 'Escape') setEditando(null); }}
                autoFocus
              />
              <button style={btn('success', { small: true })} onClick={salvarEdicao} disabled={savingEdit}>
                {savingEdit ? <Spinner size={14} /> : '✓ Salvar'}
              </button>
              <button style={btn('ghost', { small: true })} onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

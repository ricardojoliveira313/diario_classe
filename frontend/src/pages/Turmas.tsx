import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { theme, btn, input, label, card as cardStyle } from '../styles';
import { Loading, EmptyState, Spinner } from '../components';
import { useAuth } from '../AuthContext';

// ── Lista oficial: TODAS as turmas com professora e período ──────────────────
// Fonte: TURMAPROFESSORESPERIODO.xlsx — EMEIEF Luiz Gonzaga
const TURMAS_OFICIAIS: { turma: string; professora: string; periodo: string }[] = [
  { turma: '1ª ETAPA A', professora: 'Maria Lucia',      periodo: 'Manhã' },
  { turma: '1ª ETAPA B', professora: 'Denise',           periodo: 'Manhã' },
  { turma: '1ª ETAPA C', professora: 'Fernanda',         periodo: 'Manhã' },
  { turma: '1ª ETAPA D', professora: 'Celina',           periodo: 'Manhã' },
  { turma: '1ª ETAPA E', professora: 'Debora',           periodo: 'Tarde' },
  { turma: '1ª ETAPA F', professora: 'Andressa',         periodo: 'Tarde' },
  { turma: '1ª ETAPA G', professora: 'Rosangela',        periodo: 'Tarde' },
  { turma: '1ª ETAPA H', professora: 'Adriana Zenoides', periodo: 'Tarde' },
  { turma: '2ª ETAPA A', professora: 'Liliane',          periodo: 'Manhã' },
  { turma: '2ª ETAPA B', professora: 'Silvana',          periodo: 'Manhã' },
  { turma: '2ª ETAPA C', professora: 'Michele',          periodo: 'Manhã' },
  { turma: '2ª ETAPA D', professora: 'Solange',          periodo: 'Manhã' },
  { turma: '2ª ETAPA E', professora: 'Sabrina',          periodo: 'Tarde' },
  { turma: '2ª ETAPA F', professora: 'Angelita',         periodo: 'Tarde' },
  { turma: '2ª ETAPA G', professora: 'Kamila',           periodo: 'Tarde' },
  { turma: '2ª ETAPA H', professora: 'Danielle',         periodo: 'Tarde' },
  { turma: '1º ANO A',   professora: 'Roseli Pereira',   periodo: 'Manhã' },
  { turma: '1º ANO B',   professora: 'Bruna',            periodo: 'Manhã' },
  { turma: '1º ANO C',   professora: 'Luciany',          periodo: 'Tarde' },
  { turma: '1º ANO D',   professora: 'Silene',           periodo: 'Tarde' },
  { turma: '1º ANO E',   professora: 'Bianca',           periodo: 'Tarde' },
  { turma: '2º ANO A',   professora: 'Ione',             periodo: 'Manhã' },
  { turma: '2º ANO B',   professora: 'Sandra',           periodo: 'Manhã' },
  { turma: '2º ANO C',   professora: 'Gilmara',          periodo: 'Manhã' },
  { turma: '2º ANO D',   professora: 'Paula',            periodo: 'Tarde' },
  { turma: '2º ANO E',   professora: 'Marta',            periodo: 'Tarde' },
  { turma: '3º ANO A',   professora: 'Magnus',           periodo: 'Manhã' },
  { turma: '3º ANO B',   professora: 'Thabata',          periodo: 'Manhã' },
  { turma: '3º ANO C',   professora: 'Cátia',            periodo: 'Tarde' },
  { turma: '3º ANO D',   professora: 'Adriana Caetano',  periodo: 'Tarde' },
  { turma: '4º ANO A',   professora: 'Juliana',          periodo: 'Manhã' },
  { turma: '4º ANO B',   professora: 'Camila P',         periodo: 'Manhã' },
  { turma: '4º ANO C',   professora: 'Cida Drigo',       periodo: 'Tarde' },
  { turma: '4º ANO D',   professora: 'Karine',           periodo: 'Tarde' },
  { turma: '5º ANO A',   professora: 'Roseli Zamana',    periodo: 'Manhã' },
  { turma: '5º ANO B',   professora: 'Jessica',          periodo: 'Manhã' },
  { turma: '5º ANO C',   professora: 'Alessandra',       periodo: 'Tarde' },
  { turma: '5º ANO D',   professora: 'Raquel',           periodo: 'Tarde' },
  { turma: 'EJA I',      professora: 'Maria dos Anjos',                periodo: 'Noite' },
  { turma: 'EJA I',      professora: 'Elaine Aparecida da Silva Figueiredo', periodo: 'Noite' },
];

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
  const [sincronizando, setSincronizando] = useState(false);
  const [resultSync, setResultSync] = useState<{ ok: number; nao: string[] } | null>(null);

  // --- importação em lote ---
  const [importando, setImportando] = useState(false);
  const [textoImport, setTextoImport] = useState('');
  const [preview, setPreview] = useState<{ turmaId: string; nomeTurma: string; professora: string; encontrou: boolean }[]>([]);
  const [salvandoImport, setSalvandoImport] = useState(false);
  const [resultImport, setResultImport] = useState<{ ok: number; nao: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.getTurmas().then(setTurmas).finally(() => setLoading(false));

  // ── Sincroniza TODAS as turmas com a lista oficial ───────────────────────
  const sincronizarProfessores = async () => {
    setSincronizando(true);
    setResultSync(null);
    const lista = await api.getTurmas();
    let ok = 0;
    const nao: string[] = [];

    // Agrupa oficiais por turma (para EJA I com 2 professoras)
    const grupos = new Map<string, typeof TURMAS_OFICIAIS>();
    for (const o of TURMAS_OFICIAIS) {
      const k = normSimp(o.turma);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push(o);
    }

    for (const [key, oficiais] of grupos) {
      // Todas as turmas no banco que casam com esse nome
      const matches = lista.filter((t: any) =>
        normSimp(t.nome) === key || norm(t.nome) === norm(oficiais[0].turma)
      );
      if (matches.length === 0) {
        nao.push(oficiais[0].turma + ' (não encontrada)');
        continue;
      }
      // Distribui professoras: 1ª turma → 1ª prof, 2ª turma → 2ª prof, etc.
      for (let i = 0; i < oficiais.length; i++) {
        const t = matches[i] ?? matches[matches.length - 1];
        try {
          await api.updateTurma(t.id, { professora: oficiais[i].professora, periodo: oficiais[i].periodo });
          ok++;
        } catch { nao.push(oficiais[i].turma); }
      }
    }
    await load();
    setResultSync({ ok, nao });
    setSincronizando(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    await api.createTurma({ ...form, numero: Number(form.numero) });
    setSaving(false);
    setAdding(false);
    setForm({ nome: '', etapa: 'EF1', numero: 1, letra: 'A', periodo: 'Manhã', professora: '' });
    load();
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    setSavingEdit(true);
    await api.updateTurma(editando.id, { professora: editando.professora });
    setSavingEdit(false);
    setEditando(null);
    load();
  };

  const del = async (id: string, nome: string) => {
    if (!confirm(`Excluir turma "${nome}"? Todos os alunos e faltas serão removidos.`)) return;
    setDeleting(id);
    await api.deleteTurma(id);
    setDeleting(null);
    load();
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
      // Lê todas as linhas brutas para encontrar a linha de cabeçalho real
      // (ignora linhas de título como "EMEIEF LUIZ GONZAGA" na linha 1)
      const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) as any[][];
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const row = rawRows[i] ?? [];
        const vals = row.map((v: any) => norm(String(v ?? '')));
        if (vals.some(v => v.includes('TURMA') || v.includes('CLASSE')) &&
            vals.some(v => v.includes('PROFESSOR') || v.includes('PROF') || v.includes('DOCENTE'))) {
          headerIdx = i; break;
        }
      }
      if (headerIdx < 0) {
        alert('Não encontrei colunas com "TURMA" e "PROFESSOR" nas primeiras 10 linhas da planilha.');
        return;
      }
      const headers = rawRows[headerIdx].map((v: any) => String(v ?? '').trim());
      const turmaKey = headers.findIndex(h => norm(h).includes('TURMA') || norm(h).includes('CLASSE'));
      const profKey  = headers.findIndex(h => norm(h).includes('PROFESSOR') || norm(h).includes('PROF') || norm(h).includes('DOCENTE'));
      const rows = rawRows.slice(headerIdx + 1);
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {role === 'admin' && (
            <button
              style={{ ...btn('warning'), fontWeight: 700 }}
              onClick={sincronizarProfessores}
              disabled={sincronizando}
              title="Aplica a lista oficial de professoras em todas as turmas de uma vez"
            >
              {sincronizando ? <Spinner size={14} /> : '🔄'} Sincronizar Professoras
            </button>
          )}
          <button style={btn('success', { outline: true })} onClick={() => { setImportando(!importando); setAdding(false); }}>
            {importando ? 'Fechar importação' : '📥 Importar Professoras'}
          </button>
          <button style={adding ? btn('ghost') : btn('primary')} onClick={() => { setAdding(!adding); setImportando(false); }}>
            {adding ? 'Cancelar' : '+ Nova Turma'}
          </button>
        </div>
      </div>

      {/* Resultado da sincronização */}
      {resultSync && (
        <div style={{
          background: resultSync.nao.length === 0 ? theme.successLight : theme.warningLight,
          border: `1px solid ${resultSync.nao.length === 0 ? theme.success : theme.warning}`,
          borderRadius: theme.radiusMd, padding: '12px 16px', marginBottom: 16, fontSize: 14,
        }}>
          <strong>✅ {resultSync.ok} turmas atualizadas</strong>
          {resultSync.nao.length > 0 && (
            <div style={{ marginTop: 6, color: theme.orange }}>
              ⚠️ Não encontradas: {resultSync.nao.join(', ')}
            </div>
          )}
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
                {t.etapa} · {t.periodo}
                {t.professora
                  ? <span style={{ color: theme.primary, fontWeight: 600 }}> · Prof. {t.professora}</span>
                  : <span style={{ color: '#ea580c', fontWeight: 500 }}> · ⚠️ sem professora</span>}
              </div>
            </div>
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
          </div>
          {editando?.id === t.id && (
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

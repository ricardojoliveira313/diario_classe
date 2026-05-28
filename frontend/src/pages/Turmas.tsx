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
  const [reconectando, setReconectando] = useState(false);
  const [resultReconecta, setResultReconecta] = useState<{ atualizados: number; semMatch: number } | null>(null);
  const [fazendoBackup, setFazendoBackup] = useState(false);
  const [backupNuvemStatus, setBackupNuvemStatus] = useState<string | null>(null);
  const [backupsNuvem, setBackupsNuvem] = useState<any[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [restaurandoBackup, setRestaurandoBackup] = useState<string | null>(null);
  const [recuperando, setRecuperando] = useState(false);
  const [resultRecupera, setResultRecupera] = useState<{ atualizados: number; semMatch: number } | null>(null);

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
    if (!confirm(`Restaurar as ${TURMAS_PADRAO.length} turmas padrão?\n\nCria turmas inexistentes e atualiza nome/professora/período das existentes.`)) return;
    setRestaurando(true);
    setResultRestaura(null);
    let criadas = 0, atualizadas = 0, erros = 0;
    const atuais = await api.getTurmas();
    for (const tp of TURMAS_PADRAO) {
      const match = atuais.find((t: any) => norm(t.nome) === norm(tp.nome))
        ?? atuais.find((t: any) => normSimp(t.nome) === normSimp(tp.nome));
      try {
        if (match) {
          await api.updateTurma(match.id, { nome: tp.nome, professora: tp.professora, periodo: tp.periodo });
          atualizadas++;
        } else {
          await api.createTurma({ nome: tp.nome, professora: tp.professora, periodo: tp.periodo });
          criadas++;
        }
      } catch { erros++; }
    }
    setRestaurando(false);
    setResultRestaura({ criadas, atualizadas, erros });
    load();
  };

  const salvarBackupNuvem = async () => {
    setBackupNuvemStatus('Salvando...');
    try {
      const [{ data: turmData }, { data: alunoData }, { data: faltaData }] = await Promise.all([
        supabase.from('Turma').select('*'),
        supabase.from('Aluno').select('*'),
        supabase.from('Falta').select('*'),
      ]);
      const descricao = `${new Date().toLocaleString('pt-BR')} — ${alunoData?.length ?? 0} alunos, ${turmData?.length ?? 0} turmas`;
      const { error } = await supabase.from('Backup').insert({
        descricao,
        turmas: turmData ?? [],
        alunos: alunoData ?? [],
        faltas: faltaData ?? [],
      });
      if (error) throw error;
      setBackupNuvemStatus('✅ Backup salvo na nuvem!');
    } catch (e: any) {
      setBackupNuvemStatus('❌ Erro: ' + (e.message ?? e));
    }
    setTimeout(() => setBackupNuvemStatus(null), 4000);
  };

  const carregarBackupsNuvem = async () => {
    const { data } = await supabase
      .from('Backup')
      .select('id, created_at, descricao')
      .order('created_at', { ascending: false })
      .limit(20);
    setBackupsNuvem(data ?? []);
    setShowBackups(true);
  };

  const restaurarDoBackup = async (backupId: string) => {
    if (!confirm('Restaurar este backup? Os dados atuais serão atualizados com os dados do backup (sem apagar).')) return;
    setRestaurandoBackup(backupId);
    try {
      const { data: bk } = await supabase.from('Backup').select('*').eq('id', backupId).single();
      if (!bk) throw new Error('Backup não encontrado');
      // Restaura turmas
      if (bk.turmas?.length) {
        await supabase.from('Turma').upsert(bk.turmas, { onConflict: 'id' });
      }
      // Restaura alunos em lotes
      const alunos: any[] = bk.alunos ?? [];
      for (let i = 0; i < alunos.length; i += 100) {
        await supabase.from('Aluno').upsert(alunos.slice(i, i + 100), { onConflict: 'id' });
      }
      // Restaura faltas em lotes
      const faltas: any[] = bk.faltas ?? [];
      for (let i = 0; i < faltas.length; i += 100) {
        await supabase.from('Falta').upsert(faltas.slice(i, i + 100), { onConflict: 'alunoId,mes,ano' });
      }
      alert(`✅ Backup restaurado!\n${alunos.length} alunos · ${bk.turmas?.length ?? 0} turmas · ${faltas.length} faltas`);
      setShowBackups(false);
      load();
    } catch (e: any) {
      alert('Erro ao restaurar: ' + (e.message ?? e));
    }
    setRestaurandoBackup(null);
  };

  const fazerBackup = async () => {
    setFazendoBackup(true);
    try {
      const [{ data: turmData }, { data: alunoData }, { data: faltaData }] = await Promise.all([
        supabase.from('Turma').select('*').order('nome'),
        supabase.from('Aluno').select('*').order('nome'),
        supabase.from('Falta').select('*'),
      ]);

      const wb = XLSX.utils.book_new();

      // Aba Turmas
      const wsTurmas = XLSX.utils.json_to_sheet(
        (turmData ?? []).map((t: any) => ({
          id: t.id, nome: t.nome, professora: t.professora ?? '',
          periodo: t.periodo ?? '', tipo: t.tipo ?? '',
        }))
      );
      wsTurmas['!cols'] = [{ wch: 38 }, { wch: 24 }, { wch: 26 }, { wch: 12 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, wsTurmas, 'Turmas');

      // Aba Alunos
      const turmaMapBk = new Map((turmData ?? []).map((t: any) => [t.id, t.nome]));
      const wsAlunos = XLSX.utils.json_to_sheet(
        (alunoData ?? []).map((a: any) => ({
          id: a.id, ra: a.ra ?? '', dig_ra: a.dig_ra ?? '', nome: a.nome,
          turma: turmaMapBk.get(a.turmaId) ?? '',
          turmaId: a.turmaId ?? '',
          professora: a.professora ?? '',
          situacao: a.situacao ?? '',
          data_nascimento: a.data_nascimento ?? '',
          data_inicio_matricula: a.data_inicio_matricula ?? '',
          data_fim_matricula: a.data_fim_matricula ?? '',
          data_movimentacao: a.data_movimentacao ?? '',
          deficiencia: a.deficiencia ?? '',
          bolsa_familia: a.bolsa_familia ? 'Sim' : 'Não',
          nis: a.nis ?? '',
          cpf: a.cpf ?? '',
          cor_raca: a.cor_raca ?? '',
          numero: a.numero ?? '',
        }))
      );
      wsAlunos['!cols'] = [
        { wch: 38 }, { wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 20 }, { wch: 38 },
        { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 6 },
      ];
      XLSX.utils.book_append_sheet(wb, wsAlunos, 'Alunos');

      // Aba Faltas
      const wsFaltas = XLSX.utils.json_to_sheet(
        (faltaData ?? []).map((f: any) => ({
          alunoId: f.alunoId, mes: f.mes, ano: f.ano,
          faltas: f.faltas ?? 0, compensadas: f.compensadas ?? 0,
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsFaltas, 'Faltas');

      const dataStr = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
      XLSX.writeFile(wb, `Backup_DiarioClasse_${dataStr}.xlsx`);
    } catch (e: any) {
      alert('Erro ao gerar backup: ' + (e.message ?? e));
    }
    setFazendoBackup(false);
  };

  const reconectarAlunos = async () => {
    if (role !== 'admin') return;
    if (!confirm('Reconectar alunos sem turma às turmas pelo nome da professora?\n\nIsso vai restaurar os vínculos perdidos de todos os alunos.')) return;
    setReconectando(true);
    setResultReconecta(null);

    const atuais = await api.getTurmas();

    // Busca todos os alunos sem turma (turmaId = null)
    const { data: semTurma } = await supabase
      .from('Aluno')
      .select('id, professora')
      .is('turmaId', null);

    if (!semTurma?.length) {
      setReconectando(false);
      setResultReconecta({ atualizados: 0, semMatch: 0 });
      return;
    }

    // Agrupa alunos por professora normalizada
    const porProfessora = new Map<string, string[]>();
    let semMatch = 0;
    for (const aluno of semTurma) {
      if (!aluno.professora) { semMatch++; continue; }
      const key = norm(aluno.professora);
      if (!porProfessora.has(key)) porProfessora.set(key, []);
      porProfessora.get(key)!.push(aluno.id);
    }

    let atualizados = 0;
    for (const [profNorm, ids] of porProfessora) {
      const turma = atuais.find((t: any) => norm(t.professora || '') === profNorm);
      if (!turma) { semMatch += ids.length; continue; }
      // Atualiza em lotes de 100
      for (let i = 0; i < ids.length; i += 100) {
        const lote = ids.slice(i, i + 100);
        const { error } = await supabase.from('Aluno').update({ turmaId: turma.id }).in('id', lote);
        if (!error) atualizados += lote.length;
        else semMatch += lote.length;
      }
    }

    setReconectando(false);
    setResultReconecta({ atualizados, semMatch });
    load();
  };

  const recuperarCorRacaCpf = async () => {
    if (role !== 'admin') return;
    if (!confirm('Recuperar cor/raça e CPF dos alunos a partir do Educacenso?\n\nSó preenche campos que estão vazios — não apaga dados existentes.')) return;
    setRecuperando(true);
    setResultRecupera(null);
    try {
      const normalizeStr = (s: string) =>
        (s ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
      // normaliza data para DD/MM/YYYY independente de como está armazenada
      const normDate = (d: string) => {
        if (!d) return '';
        if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
          const [y, m, dd] = d.slice(0, 10).split('-');
          return `${dd}/${m}/${y}`;
        }
        return d.slice(0, 10);
      };

      const { data: educ } = await supabase.from('Educacenso').select('cpf, nome, data_nascimento, cor_raca, deficiencia');
      if (!educ?.length) { alert('Tabela Educacenso vazia — importe o Educacenso primeiro.'); setRecuperando(false); return; }

      const educMap = new Map<string, { cor_raca: string; cpf: string }>();
      for (const rec of educ) {
        const entry = { cor_raca: rec.cor_raca || '', cpf: rec.cpf || '' };
        if (rec.cpf) educMap.set(`CPF:${rec.cpf}`, entry);
        if (rec.nome) {
          const nn = normalizeStr(rec.nome);
          const dt = normDate(rec.data_nascimento || '');
          educMap.set(`${nn}|${dt}`, entry);
          // também indexa sem data para match parcial
          educMap.set(`NOME:${nn}`, entry);
        }
      }

      const { data: alunos } = await supabase.from('Aluno').select('id, ra, nome, cpf, cor_raca, data_nascimento');
      if (!alunos?.length) { setRecuperando(false); return; }

      const paraAtualizar: { id: string; cor_raca?: string; cpf?: string }[] = [];
      for (const a of alunos) {
        const semCorRaca = !a.cor_raca;
        const semCpf = !a.cpf;
        if (!semCorRaca && !semCpf) continue;

        const nn = normalizeStr(a.nome);
        const dt = normDate(a.data_nascimento || '');
        const ec = (a.cpf ? educMap.get(`CPF:${a.cpf}`) : undefined)
          ?? educMap.get(`${nn}|${dt}`)
          ?? educMap.get(`NOME:${nn}`);
        if (!ec) continue;

        const update: any = { id: a.id };
        if (semCorRaca && ec.cor_raca) update.cor_raca = ec.cor_raca;
        if (semCpf && ec.cpf) update.cpf = ec.cpf;
        if (Object.keys(update).length > 1) paraAtualizar.push(update);
      }

      let atualizados = 0;
      for (let i = 0; i < paraAtualizar.length; i += 100) {
        const lote = paraAtualizar.slice(i, i + 100);
        const { error } = await supabase.from('Aluno').upsert(lote, { onConflict: 'id' });
        if (!error) atualizados += lote.length;
      }
      const totalSemDados = alunos.filter(a => (!a.cor_raca || !a.cpf)).length;
      setResultRecupera({ atualizados, semMatch: totalSemDados - atualizados });
    } catch (e: any) {
      alert('Erro ao recuperar: ' + (e.message ?? e));
    }
    setRecuperando(false);
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
              style={{ ...btn('primary'), fontWeight: 800 }}
              onClick={salvarBackupNuvem}
              title="Salva backup completo na nuvem (Supabase)"
            >
              ☁️ Backup Nuvem
            </button>
            <button
              style={btn('primary', { outline: true })}
              onClick={carregarBackupsNuvem}
              title="Ver e restaurar backups salvos na nuvem"
            >
              📋 Ver Backups
            </button>
            <button
              style={{ ...btn('success'), fontWeight: 800 }}
              onClick={fazerBackup}
              disabled={fazendoBackup}
              title="Exporta backup completo: turmas, alunos e faltas"
            >
              {fazendoBackup ? <><Spinner size={14} /> Gerando...</> : '💾 Backup Excel'}
            </button>
            <button
              style={btn('danger', { outline: true })}
              onClick={recuperarCorRacaCpf}
              disabled={recuperando}
              title="Recupera cor/raça e CPF do Educacenso para alunos com campos vazios"
            >
              {recuperando ? <><Spinner size={14} /> Recuperando...</> : '🎨 Recuperar Cor/CPF'}
            </button>
            <button
              style={btn('danger', { outline: true })}
              onClick={reconectarAlunos}
              disabled={reconectando}
              title="Reconecta alunos sem turma às turmas pelo nome da professora"
            >
              {reconectando ? <><Spinner size={14} /> Reconectando...</> : '🔗 Reconectar Alunos'}
            </button>
            <button
              style={btn('warning', { outline: true })}
              onClick={restaurarTurmasPadrao}
              disabled={restaurando}
              title="Cria ou atualiza as 40 turmas padrão da escola"
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

      {/* Status backup nuvem */}
      {backupNuvemStatus && (
        <div style={{
          padding: '10px 16px', marginBottom: 10, borderRadius: 8, fontWeight: 600, fontSize: 14,
          background: backupNuvemStatus.startsWith('✅') ? '#f0fdf4' : backupNuvemStatus.startsWith('❌') ? '#fef2f2' : '#eff6ff',
          border: `1px solid ${backupNuvemStatus.startsWith('✅') ? '#bbf7d0' : backupNuvemStatus.startsWith('❌') ? '#fecaca' : '#bfdbfe'}`,
          color: backupNuvemStatus.startsWith('✅') ? '#166534' : backupNuvemStatus.startsWith('❌') ? '#dc2626' : '#1e40af',
        }}>{backupNuvemStatus}</div>
      )}

      {/* Modal backups na nuvem */}
      {showBackups && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowBackups(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, maxWidth: 600, width: '95%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>☁️ Backups na Nuvem</h2>
              <button onClick={() => setShowBackups(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: theme.textMuted }}>✕</button>
            </div>
            {backupsNuvem.length === 0
              ? <div style={{ textAlign: 'center', color: theme.textMuted, padding: 24 }}>Nenhum backup encontrado.<br />Clique em "☁️ Backup Nuvem" para criar o primeiro.</div>
              : backupsNuvem.map((bk, i) => (
                <div key={bk.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 8, marginBottom: 8,
                  background: i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)',
                  border: `1px solid ${theme.borderLight}`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{bk.descricao}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted }}>{new Date(bk.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                  <button
                    style={btn('warning', { small: true })}
                    onClick={() => restaurarDoBackup(bk.id)}
                    disabled={restaurandoBackup === bk.id}
                  >
                    {restaurandoBackup === bk.id ? <Spinner size={14} /> : '↩️ Restaurar'}
                  </button>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Resultado da recuperação de cor/raça e CPF */}
      {resultRecupera && (
        <div style={{
          padding: '12px 16px', marginBottom: 12, borderRadius: 8,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          fontSize: 14, color: '#166534', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>
            🎨 {resultRecupera.atualizados} aluno{resultRecupera.atualizados !== 1 ? 's' : ''} com cor/raça ou CPF recuperados do Educacenso
            {resultRecupera.semMatch > 0 && <span style={{ color: '#ea580c' }}> · {resultRecupera.semMatch} sem correspondência no Educacenso</span>}
          </span>
          <button onClick={() => setResultRecupera(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* Resultado da reconexão de alunos */}
      {resultReconecta && (
        <div style={{
          padding: '12px 16px', marginBottom: 12, borderRadius: 8,
          background: resultReconecta.semMatch > 0 ? '#fff7ed' : '#f0fdf4',
          border: `1px solid ${resultReconecta.semMatch > 0 ? '#fed7aa' : '#bbf7d0'}`,
          fontSize: 14, color: resultReconecta.semMatch > 0 ? '#9a3412' : '#166534', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>
            🔗 {resultReconecta.atualizados} aluno{resultReconecta.atualizados !== 1 ? 's' : ''} reconectado{resultReconecta.atualizados !== 1 ? 's' : ''} às turmas
            {resultReconecta.semMatch > 0 && <span style={{ color: '#ea580c' }}> · {resultReconecta.semMatch} sem correspondência (AEE/EJA precisam de reimport)</span>}
          </span>
          <button onClick={() => setResultReconecta(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit' }}>✕</button>
        </div>
      )}

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

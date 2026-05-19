import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api, supabase } from '../api';

const MES_MAP: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, MARÇO: 3, ABRIL: 4,
  MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8,
  SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

function getMes(sheetName: string, row: any): number {
  // Tenta pelo nome da aba primeiro
  const porAba = MES_MAP[sheetName.toUpperCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')];
  if (porAba) return porAba;
  // Tenta pela coluna MÊS da linha
  const colMes = String(row['MÊS'] ?? row['MES'] ?? row['Mês'] ?? row['mês'] ?? '')
    .toUpperCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return MES_MAP[colMes] ?? 0;
}

function fmtDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${val.getFullYear()}`;
  }
  return String(val);
}

function parseBool(val: any): boolean {
  return String(val ?? '').toUpperCase().trim() === 'SIM';
}

interface Preview { turmas: number; alunos: number; meses: string[]; registros: number; }

export default function Importar() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [progresso, setProgresso] = useState(0);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dadosRef = useRef<{
    turmas: { nome: string; professora: string }[];
    alunosMap: Map<string, any>;
    faltasMap: Map<string, any>;
  } | null>(null);

  const handleFile = (file: File) => {
    setArquivo(file);
    setErro('');
    setSucesso(false);
    setPreview(null);
    dadosRef.current = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'array', cellDates: true });

        const turmaMap = new Map<string, { nome: string; professora: string }>();
        const alunoMap = new Map<string, any>();
        // Chave: raKey|mes — evita duplicatas
        const faltasMap = new Map<string, any>();

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'dd/mm/yyyy' });

          for (const row of rows) {
            const serie = String(row['SÉRIE'] ?? row['SERIE'] ?? row['Série'] ?? '').trim();
            const professora = String(row['PROFESSORA'] ?? '').trim();
            const nome = String(row['NOME DO ALUNO'] ?? '').trim();
            const ra = String(row['RA'] ?? '').trim();
            const digRa = String(row['DIG RA'] ?? '').trim();
            const numero = parseInt(String(row['Nº'] ?? row['N°'] ?? row['N'] ?? '0')) || 0;
            const deficiencia = String(row['DEFICIÊNCIA'] ?? row['DEFICIENCIA'] ?? '').trim();
            const bolsaFamilia = parseBool(row['BOLSA FAMÍLIA'] ?? row['BOLSA FAMILIA']);
            const situacao = String(row['SITUAÇÃO'] ?? row['SITUACAO'] ?? 'ATIVO').trim();
            const mes = getMes(sheetName, row);

            if (!nome || !serie) continue;

            if (!turmaMap.has(serie)) {
              turmaMap.set(serie, { nome: serie, professora });
            }

            const raKey = ra || nome;

            if (!alunoMap.has(raKey)) {
              alunoMap.set(raKey, {
                nome,
                ra: ra ? Number(ra) : null,
                dig_ra: digRa,
                numero,
                data_nascimento: fmtDate(row['DATA DE NASCIMENTO']),
                data_inicio_matricula: fmtDate(row['DATA INÍCIO MATRÍCULA'] ?? row['DATA INICIO MATRICULA']),
                data_fim_matricula: fmtDate(row['DATA FIM MATRÍCULA'] ?? row['DATA FIM MATRICULA']),
                data_movimentacao: fmtDate(row['DATA MOVIMENTAÇÃO'] ?? row['DATA MOVIMENTACAO']),
                deficiencia,
                bolsa_familia: bolsaFamilia,
                situacao,
                professora,
                _serie: serie,
              });
            }

            // Registra falta apenas se tiver mês válido, sem duplicar
            if (mes > 0) {
              const faltaKey = `${raKey}|${mes}`;
              if (!faltasMap.has(faltaKey)) {
                // FREQUÊNCIA DOS ALUNOS(A): número = faltas, texto = 0 ou situação
                const freqVal = String(row['FREQUÊNCIA DOS ALUNOS(A)'] ?? row['FREQUENCIA DOS ALUNOS(A)'] ?? '').trim();
                const faltasNum = parseInt(freqVal);
                const faltasQtd = isNaN(faltasNum) ? 0 : faltasNum;
                const freqTexto = isNaN(faltasNum) ? freqVal : '';
                faltasMap.set(faltaKey, { _ra: raKey, _serie: serie, mes, ano: 2026, faltas: faltasQtd, frequencia: freqTexto });
              }
            }
          }
        }

        dadosRef.current = { turmas: Array.from(turmaMap.values()), alunosMap: alunoMap, faltasMap };

        setPreview({
          turmas: turmaMap.size,
          alunos: alunoMap.size,
          meses: wb.SheetNames,
          registros: faltasMap.size,
        });
      } catch (ex: any) {
        setErro('Erro ao ler o arquivo: ' + ex.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const importar = async () => {
    if (!dadosRef.current) return;
    const { turmas, alunosMap, faltasMap } = dadosRef.current;

    setErro('');
    setSucesso(false);
    const totalAlunos = alunosMap.size;
    setTotal(totalAlunos);
    setProgresso(0);

    try {
      setStatus('Limpando dados anteriores...');
      await api.clearAll();

      setStatus('Criando turmas...');
      const turmasInseridas = await api.bulkInsertTurmas(turmas);
      const serieToId = new Map<string, string>(turmasInseridas.map((t: any) => [t.nome, t.id]));

      setStatus('Inserindo alunos...');
      const alunosList = Array.from(alunosMap.values()).map(a => ({
        nome: a.nome,
        turmaId: serieToId.get(a._serie) ?? null,
        ra: a.ra,
        dig_ra: a.dig_ra,
        numero: a.numero,
        data_nascimento: a.data_nascimento,
        data_inicio_matricula: a.data_inicio_matricula,
        data_fim_matricula: a.data_fim_matricula,
        data_movimentacao: a.data_movimentacao,
        deficiencia: a.deficiencia,
        bolsa_familia: a.bolsa_familia,
        situacao: a.situacao,
        professora: a.professora,
      }));

      await api.bulkInsertAlunos(alunosList, (n) => {
        setProgresso(n);
        setStatus(`Inserindo alunos... ${n}/${totalAlunos}`);
      });

      setStatus('Vinculando faltas...');
      const { data: alunosDb } = await supabase.from('Aluno').select('id, ra, nome');
      const alunosDbList = alunosDb ?? [];

      const raKeyToId = new Map<string, string>();
      const nomeToId = new Map<string, string>();
      for (const a of alunosDbList) {
        if (a.ra) raKeyToId.set(String(a.ra), a.id);
        nomeToId.set(a.nome, a.id);
      }

      // Buscar turmaId do aluno para inserir na Falta
      const alunoIdToTurmaId = new Map<string, string>();
      for (const a of alunosDbList as any[]) {
        if (a.id && a.turmaId) alunoIdToTurmaId.set(a.id, a.turmaId);
      }
      // Rebuscar com turmaId
      const { data: alunosComTurma } = await supabase.from('Aluno').select('id, ra, nome, turmaId');
      for (const a of (alunosComTurma ?? []) as any[]) {
        if (a.id && a.turmaId) alunoIdToTurmaId.set(a.id, a.turmaId);
      }

      const faltasParaInserir = Array.from(faltasMap.values())
        .map(f => {
          const alunoId = raKeyToId.get(f._ra) ?? nomeToId.get(f._ra);
          const turmaId = serieToId.get(f._serie);
          if (!alunoId || !turmaId) return null;
          return { alunoId, turmaId, mes: f.mes, ano: f.ano, faltas: 0, frequencia: '' };
        })
        .filter(Boolean) as any[];

      setStatus(`Inserindo ${faltasParaInserir.length} registros de frequência...`);
      await api.bulkInsertFaltas(faltasParaInserir);

      setStatus('');
      setSucesso(true);
    } catch (ex: any) {
      setErro('Erro: ' + ex.message);
      setStatus('');
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>📥 Importar Planilha</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
        Selecione o arquivo <strong>DIARIO_CLASSE_2026.xlsx</strong> exportado da Secretaria Escolar Digital.
        O sistema importa turmas, alunos e frequência automaticamente.
      </p>

      <div
        style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: 32, textAlign: 'center', cursor: 'pointer', background: '#f8fafc', marginBottom: 16 }}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
        <div style={{ fontWeight: 600, color: '#334155' }}>
          {arquivo ? arquivo.name : 'Clique ou arraste o arquivo .xlsx aqui'}
        </div>
        {!arquivo && <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Formato: Excel (.xlsx)</div>}
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {preview && !sucesso && (
        <div style={{ background: 'white', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#16a34a' }}>✅ Arquivo lido com sucesso</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Turmas', value: preview.turmas, cor: '#1e40af' },
              { label: 'Alunos', value: preview.alunos, cor: '#16a34a' },
              { label: 'Abas/Meses', value: preview.meses.join(', '), cor: '#7c3aed' },
              { label: 'Registros freq.', value: preview.registros, cor: '#ea580c' },
            ].map(({ label, value, cor }) => (
              <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: cor, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fef9c3', borderRadius: 8, padding: 10, fontSize: 13, color: '#78350f', marginBottom: 12 }}>
            ⚠️ <strong>Atenção:</strong> apaga os dados existentes e reimporta tudo do zero.
          </div>
          <button
            style={{ padding: '14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, background: '#dc2626', color: 'white', width: '100%' }}
            onClick={importar}
          >
            🚀 Confirmar Importação
          </button>
        </div>
      )}

      {status && (
        <div style={{ background: 'white', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>{status}</div>
          {total > 0 && (
            <>
              <div style={{ background: '#e2e8f0', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                <div style={{ background: '#1e40af', height: '100%', width: `${Math.round((progresso / total) * 100)}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{progresso} / {total} alunos</div>
            </>
          )}
        </div>
      )}

      {sucesso && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#15803d', marginTop: 8 }}>Importação concluída!</div>
          <div style={{ color: '#166534', fontSize: 14, marginTop: 4 }}>
            {preview?.alunos} alunos · {preview?.turmas} turmas · {preview?.registros} registros
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/alunos" style={{ background: '#1e40af', color: 'white', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
              👥 Ver Alunos
            </a>
            <a href="/faltas" style={{ background: '#16a34a', color: 'white', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
              📋 Lançar Faltas
            </a>
          </div>
        </div>
      )}

      {erro && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 16, color: '#dc2626', fontSize: 14 }}>
          <strong>Erro:</strong> {erro}
        </div>
      )}
    </div>
  );
}

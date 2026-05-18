import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';

const MES_MAP: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARÇO: 3, ABRIL: 4,
  MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8,
  SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

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
  if (!val) return false;
  return String(val).toUpperCase().trim() === 'SIM';
}

interface Preview {
  turmas: number;
  alunos: number;
  meses: string[];
  registros: number;
}

export default function Importar() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [progresso, setProgresso] = useState(0);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Dados parseados guardados em memória
  const dadosRef = useRef<{
    turmas: { nome: string; professora: string }[];
    alunosMap: Map<string, any>;
    faltasRows: any[];
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
        const wb = XLSX.read(e.target!.result, { type: 'binary', cellDates: true });

        // Mapa: série → { nome, professora }
        const turmaMap = new Map<string, { nome: string; professora: string }>();
        // Mapa: ra → aluno (dados mais recentes)
        const alunoMap = new Map<string, any>();
        // Faltas: uma por (ra + mes)
        const faltasRows: any[] = [];

        for (const sheetName of wb.SheetNames) {
          const mesNum = MES_MAP[sheetName.toUpperCase().trim()];
          const ws = wb.Sheets[sheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'dd/mm/yyyy' });

          for (const row of rows) {
            const serie = String(row['SÉRIE'] ?? row['SERIE'] ?? '').trim();
            const professora = String(row['PROFESSORA'] ?? '').trim();
            const nome = String(row['NOME DO ALUNO'] ?? '').trim();
            const ra = String(row['RA'] ?? '').trim();
            const digRa = String(row['DIG RA'] ?? '').trim();
            const numero = parseInt(String(row['Nº'] ?? row['N'] ?? '0')) || 0;
            const nascimento = fmtDate(row['DATA DE NASCIMENTO']);
            const inicioMatricula = fmtDate(row['DATA INÍCIO MATRÍCULA'] ?? row['DATA INICIO MATRICULA']);
            const fimMatricula = fmtDate(row['DATA FIM MATRÍCULA'] ?? row['DATA FIM MATRICULA']);
            const movimentacao = fmtDate(row['DATA MOVIMENTAÇÃO'] ?? row['DATA MOVIMENTACAO']);
            const deficiencia = String(row['DEFICIÊNCIA'] ?? row['DEFICIENCIA'] ?? '').trim();
            const bolsaFamilia = parseBool(row['BOLSA FAMÍLIA'] ?? row['BOLSA FAMILIA']);
            const situacao = String(row['SITUAÇÃO'] ?? row['SITUACAO'] ?? 'ATIVO').trim();
            const frequenciaTexto = String(row['FREQUÊNCIA DOS ALUNOS(A)'] ?? row['FREQUENCIA DOS ALUNOS(A)'] ?? '').trim();

            if (!nome || !serie) continue;

            if (!turmaMap.has(serie)) {
              turmaMap.set(serie, { nome: serie, professora });
            }

            const raKey = ra || nome;
            if (!alunoMap.has(raKey)) {
              alunoMap.set(raKey, {
                nome, ra: ra || null, dig_ra: digRa, numero,
                data_nascimento: nascimento,
                data_inicio_matricula: inicioMatricula,
                data_fim_matricula: fimMatricula,
                data_movimentacao: movimentacao,
                deficiencia, bolsa_familia: bolsaFamilia,
                situacao, professora,
                _serie: serie,
              });
            }

            faltasRows.push({
              _ra: raKey, _serie: serie,
              mes: mesNum ?? 0, ano: 2026,
              faltas: 0, frequencia: '', frequencia_texto: frequenciaTexto,
            });
          }
        }

        dadosRef.current = {
          turmas: Array.from(turmaMap.values()),
          alunosMap: alunoMap,
          faltasRows,
        };

        setPreview({
          turmas: turmaMap.size,
          alunos: alunoMap.size,
          meses: wb.SheetNames,
          registros: faltasRows.length,
        });
      } catch (ex: any) {
        setErro('Erro ao ler o arquivo: ' + ex.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const importar = async () => {
    if (!dadosRef.current) return;
    const { turmas, alunosMap, faltasRows } = dadosRef.current;

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

      // Mapa série → id da turma
      const serieToId = new Map<string, string>();
      for (const t of turmasInseridas) {
        serieToId.set(t.nome, t.id);
      }

      setStatus('Inserindo alunos...');
      const alunosList = Array.from(alunosMap.entries()).map(([_key, a]) => ({
        nome: a.nome,
        turmaId: serieToId.get(a._serie) ?? null,
        ra: a.ra, dig_ra: a.dig_ra, numero: a.numero,
        data_nascimento: a.data_nascimento,
        data_inicio_matricula: a.data_inicio_matricula,
        data_fim_matricula: a.data_fim_matricula,
        data_movimentacao: a.data_movimentacao,
        deficiencia: a.deficiencia,
        bolsa_familia: a.bolsa_familia,
        situacao: a.situacao,
        professora: a.professora,
      }));

      // Mapa ra → alunoId (após insert)
      const raKeyToId = new Map<string, string>();
      await api.bulkInsertAlunos(alunosList, (n) => {
        setProgresso(n);
        setStatus(`Inserindo alunos... ${n}/${totalAlunos}`);
      });

      // Buscar todos os alunos para obter os IDs
      setStatus('Vinculando registros de faltas...');
      const { supabase } = await import('../api');
      const { data: alunosDb } = await supabase.from('Aluno').select('id, ra, nome, turmaId');
      const alunosDbList = alunosDb ?? [];

      // Mapa raKey → id
      for (const a of alunosDbList) {
        const key = a.ra ? String(a.ra) : a.nome;
        raKeyToId.set(key, a.id);
      }
      // Também mapear por nome para fallback
      const nomeToId = new Map<string, string>();
      for (const a of alunosDbList) {
        nomeToId.set(a.nome, a.id);
      }

      const faltasParaInserir = faltasRows
        .map(f => {
          const alunoId = raKeyToId.get(f._ra) ?? nomeToId.get(f._ra);
          const turmaId = serieToId.get(f._serie);
          if (!alunoId || !turmaId || !f.mes) return null;
          return {
            alunoId, turmaId, mes: f.mes, ano: f.ano,
            faltas: 0, frequencia: '', frequencia_texto: f.frequencia_texto,
          };
        })
        .filter(Boolean);

      setStatus('Inserindo registros de frequência...');
      await api.bulkInsertFaltas(faltasParaInserir as any[]);

      setStatus('');
      setSucesso(true);
    } catch (ex: any) {
      setErro('Erro na importação: ' + ex.message);
      setStatus('');
    }
  };

  const btn = (color: string) => ({
    padding: '12px 24px', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontWeight: 700, fontSize: 15,
    background: color, color: 'white', width: '100%', marginTop: 12,
  });

  return (
    <div style={{ marginTop: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>📥 Importar Planilha</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
        Selecione o arquivo <strong>DIARIO_CLASSE_2026.xlsx</strong>. O sistema importará turmas, alunos e frequência automaticamente.
      </p>

      {/* Área de upload */}
      <div
        style={{
          border: '2px dashed #cbd5e1', borderRadius: 12, padding: 32,
          textAlign: 'center', cursor: 'pointer', background: '#f8fafc',
          marginBottom: 16,
        }}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
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

      {/* Preview */}
      {preview && !sucesso && (
        <div style={{ background: 'white', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#1e40af' }}>✅ Arquivo lido com sucesso</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              { label: 'Turmas', value: preview.turmas },
              { label: 'Alunos', value: preview.alunos },
              { label: 'Meses', value: preview.meses.join(', ') },
              { label: 'Registros freq.', value: preview.registros },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#eff6ff', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fef9c3', borderRadius: 8, padding: 12, marginTop: 12, fontSize: 13, color: '#78350f' }}>
            ⚠️ <strong>Atenção:</strong> a importação <strong>apaga todos os dados existentes</strong> e reimporta tudo do zero.
          </div>
          <button style={btn('#dc2626')} onClick={importar}>
            🚀 Confirmar Importação
          </button>
        </div>
      )}

      {/* Progresso */}
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

      {/* Sucesso */}
      {sucesso && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#15803d', marginTop: 8 }}>Importação concluída!</div>
          <div style={{ color: '#166534', fontSize: 14, marginTop: 4 }}>
            {preview?.alunos} alunos em {preview?.turmas} turmas importados com sucesso.
          </div>
          <div style={{ marginTop: 12 }}>
            <a href="/alunos" style={{ color: '#1e40af', fontWeight: 600 }}>→ Ver alunos</a>
            {' · '}
            <a href="/faltas" style={{ color: '#1e40af', fontWeight: 600 }}>→ Lançar faltas</a>
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 16, color: '#dc2626', fontSize: 14 }}>
          {erro}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { api } from '../api';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_LETIVOS: Record<number, number> = {
  1: 4, 2: 13, 3: 22, 4: 18, 5: 20, 6: 21,
  7: 9, 8: 21, 9: 22, 10: 18, 11: 20, 12: 17,
};

interface AlunoExtrato { numero: number; nome: string; faltas: number; }
interface EntradaCruzada extends AlunoExtrato {
  alunoId: string | null;
  nomeDB: string | null;
  confianca: 'alta' | 'media' | 'baixa';
  motivo: string;
}

function norm(s: string) {
  return (s ?? '').toUpperCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function ocr(base64: string, key: string): Promise<string> {
  const r = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message ?? `HTTP ${r.status}`); }
  const d = await r.json();
  return d.responses?.[0]?.fullTextAnnotation?.text ?? '';
}

function parseTexto(text: string): AlunoExtrato[] {
  const results: AlunoExtrato[] = [];
  const seen = new Set<number>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.length < 4 || line.length > 120) continue;
    if (/^(nº|nome|aluno|prof|turma|série|mês|escola|data|total|freq|emei)/i.test(line)) continue;
    const m = line.match(/^(\d{1,2})\.?\s{1,3}([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀa-záéíóúâêîôûãõçà\s]{3,55}?)\s{1,4}(\d{1,2})\s*$/);
    if (m) {
      const num = parseInt(m[1]);
      if (seen.has(num)) continue;
      seen.add(num);
      results.push({ numero: num, nome: m[2].trim().toUpperCase(), faltas: parseInt(m[3]) });
      continue;
    }
    const m2 = line.match(/^(\d{1,2})\.?\s{1,3}([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀa-záéíóúâêîôûãõçà\s]{4,55})\s*$/);
    if (m2 && /[A-ZÁÉÍÓÚ]{3,}/.test(m2[2])) {
      const num = parseInt(m2[1]);
      if (seen.has(num)) continue;
      seen.add(num);
      results.push({ numero: num, nome: m2[2].trim().toUpperCase(), faltas: 0 });
    }
  }
  return results.sort((a, b) => a.numero - b.numero);
}

function cruzar(extratos: AlunoExtrato[], alunosTurma: any[], dl: number): EntradaCruzada[] {
  return extratos.map(e => {
    let alunoId: string | null = null;
    let nomeDB: string | null = null;
    let confianca: 'alta' | 'media' | 'baixa' = 'baixa';
    let motivo = '';

    const porNum = alunosTurma.find(a => a.numero === e.numero);
    if (porNum) {
      alunoId = porNum.id; nomeDB = porNum.nome;
      const nO = norm(e.nome), nD = norm(porNum.nome);
      if (nO === nD) { confianca = 'alta'; }
      else if (nD.includes(nO.split(' ')[0]) || nO.includes(nD.split(' ')[0])) {
        confianca = 'media'; motivo = `Nome: OCR "${e.nome}" vs Banco "${porNum.nome}"`;
      } else {
        confianca = 'media'; motivo = `Nomes diferentes: "${e.nome}" / "${porNum.nome}"`;
      }
    } else {
      const partes = norm(e.nome).split(' ').filter(p => p.length > 2);
      const porNome = alunosTurma.find(a => {
        const nD = norm(a.nome);
        return partes.length >= 2 && nD.includes(partes[0]) && nD.includes(partes[partes.length - 1]);
      });
      if (porNome) {
        alunoId = porNome.id; nomeDB = porNome.nome;
        confianca = 'media'; motivo = `Nº ${e.numero} não bate — cruzado por nome`;
      } else {
        motivo = `Não encontrado: Nº ${e.numero} "${e.nome}"`;
      }
    }
    if (e.faltas > dl) { confianca = 'baixa'; motivo = `Faltas (${e.faltas}) > dias letivos (${dl})`; }
    return { ...e, alunoId, nomeDB, confianca, motivo };
  });
}

export default function Professor() {
  const [apiKey] = useState(() => localStorage.getItem('gvision_key') ?? '');
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [imageBase64, setImageBase64] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [resultado, setResultado] = useState<'auto' | 'revisao' | null>(null);
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.getTurmas().then(t => { setTurmas(t); if (t.length) setTurmaId(t[0].id); }); }, []);

  const turma = turmas.find(t => t.id === turmaId);
  const dl = DIAS_LETIVOS[mes] ?? 22;

  const handleImg = (file: File) => {
    const r = new FileReader();
    r.onload = e => {
      const res = e.target?.result as string;
      setImagePreview(res);
      setImageBase64(res.split(',')[1]);
      setResultado(null); setErro('');
    };
    r.readAsDataURL(file);
  };

  const enviar = async () => {
    if (!apiKey) { setErro('Configure a chave Google Vision na página OCR primeiro.'); return; }
    if (!imageBase64) { setErro('Tire uma foto primeiro.'); return; }
    setErro(''); setResultado(null);
    try {
      setStatus('Lendo imagem...');
      const texto = await ocr(imageBase64, apiKey);
      setStatus('Identificando alunos...');
      const extratos = parseTexto(texto);
      if (extratos.length === 0) throw new Error('Nenhum aluno encontrado na imagem. Tente com melhor iluminação e ângulo.');

      setStatus('Cruzando com lista da turma...');
      const alunosTurma = await api.getAlunos(turmaId);
      const cruzadas = cruzar(extratos, alunosTurma, dl);

      const ativas = alunosTurma.filter(a => a.situacao === 'ATIVO').length;
      const matched = cruzadas.filter(e => e.alunoId).length;
      const problemas = cruzadas.filter(e => e.confianca === 'baixa').length;
      const cobertura = ativas > 0 ? matched / ativas : 0;
      const autoSalvar = cobertura >= 0.8 && problemas === 0;

      if (autoSalvar) {
        setStatus('Salvando faltas...');
        const registros = cruzadas
          .filter(e => e.alunoId)
          .map(e => ({ alunoId: e.alunoId!, turmaId, mes, ano: 2026, faltas: e.faltas, frequencia: '' }));
        await api.upsertFaltasBatch(registros);
        setResultado('auto');
      } else {
        setStatus('Enviando para revisão...');
        await api.criarPendente({
          turmaId, mes, ano: 2026,
          dados: cruzadas,
          total_entradas: cruzadas.length,
          total_problemas: problemas + cruzadas.filter(e => e.confianca === 'media').length,
        });
        setResultado('revisao');
      }
      setStatus('');
    } catch (ex: any) {
      setErro(ex.message); setStatus('');
    }
  };

  const reiniciar = () => {
    setImagePreview(null); setImageBase64('');
    setResultado(null); setErro(''); setStatus('');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40 }}>📚</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e40af', marginTop: 6 }}>Lançar Frequência</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Fotografe o diário de classe e envie</p>
        </div>

        {resultado === 'auto' ? (
          <div style={{ background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 56 }}>✅</div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 12 }}>Salvo automaticamente!</p>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{turma?.nome} — {MESES[mes - 1]} 2026</p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>As faltas foram lançadas com sucesso.</p>
            <button onClick={reiniciar} style={{ marginTop: 20, padding: '12px 28px', borderRadius: 10, background: '#1e40af', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
              📷 Nova foto
            </button>
          </div>
        ) : resultado === 'revisao' ? (
          <div style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 56 }}>⏳</div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#92400e', marginTop: 12 }}>Enviado para revisão!</p>
            <p style={{ fontSize: 13, color: '#78350f', marginTop: 6 }}>{turma?.nome} — {MESES[mes - 1]} 2026</p>
            <p style={{ fontSize: 12, color: '#92400e', marginTop: 8 }}>A secretaria vai conferir e aprovar em breve.</p>
            <button onClick={reiniciar} style={{ marginTop: 20, padding: '12px 28px', borderRadius: 10, background: '#1e40af', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
              📷 Nova foto
            </button>
          </div>
        ) : (
          <>
            {/* Seleção turma + mês */}
            <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Turma</div>
                <select value={turmaId} onChange={e => setTurmaId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Mês de referência</div>
                <select value={mes} onChange={e => setMes(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}>
                  {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m} 2026</option>)}
                </select>
              </div>
              {turma?.professora && (
                <div style={{ marginTop: 10, fontSize: 13, color: '#1e40af', fontWeight: 600 }}>
                  👩‍🏫 Prof. {turma.professora} · {dl} dias letivos
                </div>
              )}
            </div>

            {/* Foto */}
            <div
              style={{ border: '2px dashed #cbd5e1', borderRadius: 16, padding: imagePreview ? 12 : 48, textAlign: 'center', background: '#f8fafc', cursor: 'pointer', marginBottom: 16 }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImg(f); }} />
              {imagePreview ? (
                <img src={imagePreview} alt="Foto" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 10, objectFit: 'contain' }} />
              ) : (
                <>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>📷</div>
                  <p style={{ fontWeight: 700, color: '#1e40af', fontSize: 16, marginBottom: 4 }}>Fotografar o diário</p>
                  <p style={{ fontSize: 13, color: '#94a3b8' }}>Toque aqui — a câmera abre direto</p>
                </>
              )}
            </div>

            {imagePreview && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={reiniciar}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  🔄 Refazer foto
                </button>
                <button onClick={enviar} disabled={!!status}
                  style={{ flex: 2, padding: '12px', borderRadius: 10, background: '#1e40af', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
                  {status || '📤 Enviar'}
                </button>
              </div>
            )}

            {!apiKey && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: 12, fontSize: 13, color: '#92400e' }}>
                ⚠️ Configure a chave Google Vision em <strong>Menu → OCR</strong> antes de usar.
              </div>
            )}
          </>
        )}

        {erro && (
          <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
            ⚠️ {erro}
          </div>
        )}
      </div>
    </div>
  );
}

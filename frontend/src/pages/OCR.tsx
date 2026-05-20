import { useEffect, useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { api } from '../api';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface AlunoExtrato {
  numero: number;
  nome: string;
  faltas: number;
}

async function runTesseractOCR(imageDataUrl: string, onProgress: (p: number) => void): Promise<string> {
  const worker = await createWorker('por', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100));
    },
  });
  const { data } = await worker.recognize(imageDataUrl);
  await worker.terminate();
  if (!data.text?.trim()) throw new Error('Não foi possível extrair texto. Tente com melhor iluminação e foco.');
  return data.text;
}

// Faz parse da tabela extraída: linhas "Nº Nome Faltas"
function parseOCRText(text: string): AlunoExtrato[] {
  const results: AlunoExtrato[] = [];
  const seen = new Set<number>();

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.length < 4 || line.length > 120) continue;
    if (/^(nº|nome|aluno|prof|turma|série|serie|mês|mes|escola|data|total|freq|emei)/i.test(line)) continue;

    // "1 NOME COMPLETO DO ALUNO 3"  ou  "01. NOME 0"
    const m = line.match(/^(\d{1,2})\.?\s{1,3}([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀa-záéíóúâêîôûãõçà\s]{3,55?}?)\s{1,4}(\d{1,2})\s*$/);
    if (m) {
      const num = parseInt(m[1]);
      if (seen.has(num)) continue;
      seen.add(num);
      results.push({ numero: num, nome: m[2].trim().toUpperCase(), faltas: parseInt(m[3]) });
      continue;
    }
    // Linha só com número e nome (sem faltas = assume 0)
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

export default function OCR() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [extratos, setExtratos] = useState<AlunoExtrato[]>([]);
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [status, setStatus] = useState('');
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getTurmas().then(t => { setTurmas(t); if (t.length) setTurmaId(t[0].id); });
  }, []);

  const handleImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      setImagePreview(e.target?.result as string);
      setExtratos([]);
      setRawText('');
      setStep('upload');
      setErro('');
      setProgresso(0);
    };
    reader.readAsDataURL(file);
  };

  const analisar = async () => {
    if (!imagePreview) { setErro('Selecione uma imagem.'); return; }
    setErro('');
    setProgresso(0);
    setStatus('Carregando motor OCR (primeira vez é mais lento)...');
    try {
      const text = await runTesseractOCR(imagePreview, (p) => {
        setProgresso(p);
        setStatus(`Reconhecendo texto... ${p}%`);
      });
      setRawText(text);
      const parsed = parseOCRText(text);
      setExtratos(parsed);
      setStep('review');
      setStatus('');
      if (parsed.length === 0) setErro('Não foi possível extrair alunos automaticamente. Revise o texto bruto abaixo e edite manualmente.');
    } catch (ex: any) {
      setErro(ex.message);
      setStatus('');
    }
  };

  const adicionarLinha = () => setExtratos(prev => [...prev, { numero: prev.length + 1, nome: '', faltas: 0 }]);

  const salvar = async () => {
    if (!turmaId) { setErro('Selecione a turma.'); return; }
    const validos = extratos.filter(e => e.nome.trim().length > 2);
    if (validos.length === 0) { setErro('Nenhum aluno para salvar.'); return; }
    setStatus('Salvando...');
    setErro('');
    try {
      const alunosTurma = await api.getAlunos(turmaId);
      const registros: any[] = [];
      for (const e of validos) {
        let aluno = alunosTurma.find(a => a.numero === e.numero);
        if (!aluno) aluno = alunosTurma.find(a => a.nome?.toUpperCase().trim() === e.nome);
        if (!aluno) {
          const partes = e.nome.split(' ').filter(Boolean);
          aluno = alunosTurma.find(a => {
            const an = a.nome?.toUpperCase() ?? '';
            return partes.length >= 2 && an.includes(partes[0]) && an.includes(partes[partes.length - 1]);
          });
        }
        if (!aluno) continue;
        registros.push({ alunoId: aluno.id, turmaId, mes, ano: 2026, faltas: e.faltas, frequencia: '' });
      }
      if (registros.length === 0) throw new Error('Não foi possível cruzar os nomes. Verifique se a turma selecionada está correta.');
      await api.upsertFaltasBatch(registros);
      setStep('done');
      setStatus('');
    } catch (ex: any) {
      setErro(ex.message);
      setStatus('');
    }
  };

  const reiniciar = () => {
    setImagePreview(null);
    setExtratos([]);
    setRawText('');
    setStep('upload');
    setErro('');
    setProgresso(0);
    setStatus('');
  };

  const turma = turmas.find(t => t.id === turmaId);

  return (
    <div style={{ marginTop: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>📷 OCR — Diário Físico</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        Fotografe a página do diário impresso. O texto é extraído <strong style={{ color: '#16a34a' }}>direto no seu celular — 100% gratuito, sem internet extra.</strong>
      </p>

      {/* Turma e mês */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Turma</div>
          <select value={turmaId} onChange={e => setTurmaId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', fontSize: 13 }}>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Mês</div>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', fontSize: 13 }}>
            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {step === 'done' ? (
        <div style={{ background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: 12, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p style={{ fontWeight: 700, color: '#16a34a', marginTop: 8, fontSize: 16 }}>Faltas salvas com sucesso!</p>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{turma?.nome} — {MESES[mes - 1]} 2026</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button onClick={reiniciar}
              style={{ padding: '10px 20px', borderRadius: 8, background: '#1e40af', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              📷 Nova foto
            </button>
            <a href="/faltas" style={{ padding: '10px 20px', borderRadius: 8, background: '#f1f5f9', border: '1px solid #cbd5e1', textDecoration: 'none', color: '#1e293b', fontWeight: 600 }}>
              📋 Ver Faltas
            </a>
          </div>
        </div>
      ) : step === 'review' ? (
        <div>
          <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 14 }}>
            <div style={{ background: '#0284c7', color: 'white', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>📝 Revisão — {extratos.length} linha(s) extraída(s)</span>
              <button onClick={adicionarLinha}
                style={{ padding: '4px 10px', borderRadius: 4, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', cursor: 'pointer', fontSize: 12 }}>
                + Linha
              </button>
            </div>
            <div style={{ background: '#f8fafc', padding: '6px 14px', display: 'grid', gridTemplateColumns: '40px 1fr 80px 32px', gap: 8, fontSize: 11, color: '#64748b', fontWeight: 700 }}>
              <span>Nº</span><span>Nome</span><span style={{ textAlign: 'center' }}>Faltas</span><span></span>
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {extratos.map((e, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 32px', gap: 8, padding: '6px 14px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                  <input type="number" value={e.numero}
                    onChange={v => setExtratos(p => p.map((x, j) => j === i ? { ...x, numero: Number(v.target.value) } : x))}
                    style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 13, width: '100%', textAlign: 'center' }} />
                  <input value={e.nome}
                    onChange={v => setExtratos(p => p.map((x, j) => j === i ? { ...x, nome: v.target.value } : x))}
                    style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 13, width: '100%' }} />
                  <input type="number" min={0} max={31} value={e.faltas}
                    onChange={v => setExtratos(p => p.map((x, j) => j === i ? { ...x, faltas: Number(v.target.value) } : x))}
                    style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 13, textAlign: 'center', width: '100%' }} />
                  <button onClick={() => setExtratos(p => p.filter((_, j) => j !== i))}
                    style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          </div>

          {rawText && extratos.length === 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>Texto bruto extraído:</div>
              <pre style={{ fontSize: 11, color: '#78350f', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', margin: 0 }}>{rawText}</pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reiniciar}
              style={{ flex: 1, padding: '11px', borderRadius: 8, background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
              ← Nova foto
            </button>
            <button onClick={salvar} disabled={!!status}
              style={{ flex: 2, padding: '11px', borderRadius: 8, background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
              {status || '💾 Salvar Faltas'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: imagePreview ? 12 : 48, textAlign: 'center', marginBottom: 14, background: '#f8fafc', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#1e40af'; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#cbd5e1'; const f = e.dataTransfer.files[0]; if (f) handleImage(f); }}
          >
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); }} />
            {imagePreview ? (
              <img src={imagePreview} alt="Prévia" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, objectFit: 'contain' }} />
            ) : (
              <>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📷</div>
                <p style={{ fontWeight: 700, color: '#1e40af', marginBottom: 4, fontSize: 15 }}>Toque para fotografar ou escolher imagem</p>
                <p style={{ fontSize: 12, color: '#94a3b8' }}>Câmera do celular · Galeria · JPG / PNG</p>
              </>
            )}
          </div>

          {imagePreview && !status && (
            <button onClick={analisar}
              style={{ width: '100%', padding: '13px', borderRadius: 8, background: '#0284c7', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
              🔍 Extrair Texto (Grátis)
            </button>
          )}

          {status && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 6 }}>{status}</p>
              {progresso > 0 && (
                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#0284c7', width: `${progresso}%`, transition: 'width 0.3s', borderRadius: 4 }} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {erro && (
        <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginTop: 10 }}>
          ⚠️ {erro}
        </div>
      )}
    </div>
  );
}

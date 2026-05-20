import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { theme, btn, input, label, MESES, card as cardStyle } from '../styles';
import { Spinner, ErrorBox } from '../components';

interface AlunoExtrato {
  numero: number;
  nome: string;
  faltas: number;
}

async function runGoogleVisionOCR(imageBase64: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: imageBase64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? `Erro HTTP ${res.status}`);
  }
  const data = await res.json();
  const text = data.responses?.[0]?.fullTextAnnotation?.text ?? '';
  if (!text) throw new Error('Google Vision não encontrou texto na imagem. Tente com melhor iluminação.');
  return text;
}

function parseOCRText(text: string): AlunoExtrato[] {
  const results: AlunoExtrato[] = [];
  const seen = new Set<number>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.length < 4 || line.length > 120) continue;
    if (/^(nº|nome|aluno|prof|turma|série|serie|mês|mes|escola|data|total|freq|emei)/i.test(line)) continue;
    const m = line.match(/^(\d{1,2})\.?\s{1,3}([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀa-záéíóúâêîôûãõçà\s]{3,55?}?)\s{1,4}(\d{1,2})\s*$/);
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

export default function OCR() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gvision_key') ?? '');
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState('');
  const [rawText, setRawText] = useState('');
  const [extratos, setExtratos] = useState<AlunoExtrato[]>([]);
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [status, setStatus] = useState('');
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getTurmas().then(t => { setTurmas(t); if (t.length) setTurmaId(t[0].id); });
  }, []);

  const salvarKey = () => { localStorage.setItem('gvision_key', apiKey); };

  const handleImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      setImagePreview(result);
      setImageBase64(result.split(',')[1]);
      setExtratos([]); setRawText(''); setStep('upload'); setErro('');
    };
    reader.readAsDataURL(file);
  };

  const analisar = async () => {
    if (!apiKey.trim()) { setErro('Informe a chave da API Google Cloud Vision.'); return; }
    if (!imageBase64) { setErro('Selecione uma imagem.'); return; }
    setErro(''); setStatus('Enviando para Google Cloud Vision...');
    try {
      const text = await runGoogleVisionOCR(imageBase64, apiKey);
      setRawText(text);
      const parsed = parseOCRText(text);
      setExtratos(parsed.length > 0 ? parsed : []);
      setStep('review'); setStatus('');
      if (parsed.length === 0) setErro('Não foi possível extrair alunos automaticamente. Revise o texto bruto abaixo e edite manualmente.');
    } catch (ex: any) { setErro(ex.message); setStatus(''); }
  };

  const adicionarLinha = () => setExtratos(prev => [...prev, { numero: prev.length + 1, nome: '', faltas: 0 }]);

  const salvar = async () => {
    if (!turmaId) { setErro('Selecione a turma.'); return; }
    const validos = extratos.filter(e => e.nome.trim().length > 2);
    if (validos.length === 0) { setErro('Nenhum aluno para salvar.'); return; }
    setStatus('Salvando...'); setErro('');
    try {
      const alunosTurma = await api.getAlunos(turmaId);
      const registros: any[] = [];
      for (const e of validos) {
        let aluno = alunosTurma.find(a => a.numero === e.numero);
        if (!aluno) {
          const nomeNorm = e.nome.toUpperCase().trim();
          aluno = alunosTurma.find(a => a.nome?.toUpperCase().trim() === nomeNorm);
        }
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
      if (registros.length === 0) throw new Error('Não foi possível cruzar os nomes com os alunos da turma. Verifique se a turma selecionada está correta.');
      await api.upsertFaltasBatch(registros);
      setStep('done'); setStatus('');
    } catch (ex: any) { setErro(ex.message); setStatus(''); }
  };

  const reiniciar = () => {
    setImagePreview(null); setImageBase64(''); setExtratos([]);
    setRawText(''); setStep('upload'); setErro('');
  };

  const turma = turmas.find(t => t.id === turmaId);

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📷 OCR — Diário Físico</h1>
      <p style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 16, lineHeight: 1.5 }}>
        Fotografe a página do diário impresso. O Google Cloud Vision extrai o texto e lança as faltas automaticamente.
        <strong style={{ color: theme.primary }}> Grátis até 1.000 imagens/mês.</strong>
      </p>

      <div style={cardStyle({ padding: 14, marginBottom: 14 })}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🔑 Google Cloud Vision API Key</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="AIzaSy..." style={{ ...input, marginBottom: 0, flex: 1 }} />
          <button onClick={salvarKey} style={btn('primary', { small: true })}>Salvar</button>
        </div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6 }}>
          Crie em <strong>console.cloud.google.com</strong> → APIs → Cloud Vision API → Credenciais → Chave de API
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={label}>Turma</label>
          <select style={input} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Mês</label>
          <select style={input} value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {step === 'done' ? (
        <div className="scale-in" style={{
          background: theme.successLight, border: `2px solid ${theme.success}`,
          borderRadius: theme.radiusMd, padding: 28, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p style={{ fontWeight: 800, color: theme.successHover, marginTop: 8, fontSize: 16 }}>Faltas salvas com sucesso!</p>
          <p style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>{turma?.nome} — {MESES[mes - 1]} 2026</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            <button onClick={reiniciar} style={btn('primary')}>📷 Nova foto</button>
            <a href="/faltas" style={{ ...btn('ghost'), textDecoration: 'none' }}>📋 Ver Faltas</a>
          </div>
        </div>
      ) : step === 'review' ? (
        <div className="fade-in">
          <div style={cardStyle({ marginBottom: 14 })}>
            <div style={{
              background: `linear-gradient(135deg, ${theme.sky}, ${theme.skyHover})`,
              color: 'white', padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>📝 Revisão — {extratos.length} linha(s) extraída(s)</span>
              <button onClick={adicionarLinha}
                style={{ padding: '4px 10px', borderRadius: 4, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', cursor: 'pointer', fontSize: 12 }}>
                + Linha
              </button>
            </div>
            <div style={{ background: '#f8fafc', padding: '6px 14px', display: 'grid', gridTemplateColumns: '40px 1fr 80px 32px', gap: 8, fontSize: 11, color: theme.textSecondary, fontWeight: 700 }}>
              <span>Nº</span><span>Nome</span><span style={{ textAlign: 'center' }}>Faltas</span><span></span>
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {extratos.map((e, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 80px 32px', gap: 8,
                  padding: '6px 14px', borderBottom: `1px solid ${theme.borderLight}`, alignItems: 'center',
                  background: i % 2 === 0 ? 'white' : '#f8fafc',
                }}>
                  <input type="number" value={e.numero}
                    onChange={v => setExtratos(p => p.map((x, j) => j === i ? { ...x, numero: Number(v.target.value) } : x))}
                    style={{ padding: '4px 6px', borderRadius: 4, border: `1px solid ${theme.border}`, fontSize: 13, width: '100%', textAlign: 'center' }} />
                  <input value={e.nome}
                    onChange={v => setExtratos(p => p.map((x, j) => j === i ? { ...x, nome: v.target.value } : x))}
                    style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${theme.border}`, fontSize: 13, width: '100%' }} />
                  <input type="number" min={0} max={31} value={e.faltas}
                    onChange={v => setExtratos(p => p.map((x, j) => j === i ? { ...x, faltas: Number(v.target.value) } : x))}
                    style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${theme.border}`, fontSize: 13, textAlign: 'center', width: '100%' }} />
                  <button onClick={() => setExtratos(p => p.filter((_, j) => j !== i))}
                    style={{ border: 'none', background: 'none', color: theme.danger, cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          </div>

          {rawText && extratos.length === 0 && (
            <div style={{ background: theme.warningLight, border: `1px solid #fde68a`, borderRadius: theme.radius, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>Texto bruto extraído:</div>
              <pre style={{ fontSize: 11, color: '#78350f', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', margin: 0 }}>{rawText}</pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={reiniciar} style={btn('ghost', { full: true })}>← Nova foto</button>
            <button onClick={salvar} disabled={!!status}
              style={{ ...btn('success', { full: true }), fontSize: 15 }}>
              {status ? <><Spinner size={16} /> {status}</> : '💾 Salvar Faltas'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              border: `2px dashed ${theme.border}`, borderRadius: theme.radiusMd,
              padding: imagePreview ? 12 : 48, textAlign: 'center',
              marginBottom: 14, background: '#f8fafc', cursor: 'pointer',
              transition: 'border-color 0.2s ease, background 0.2s ease',
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = theme.primary; e.currentTarget.style.background = theme.primaryBg; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = '#f8fafc'; }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = '#f8fafc'; const f = e.dataTransfer.files[0]; if (f) handleImage(f); }}
          >
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); }} />
            {imagePreview ? (
              <img src={imagePreview} alt="Prévia" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: theme.radius, objectFit: 'contain' }} />
            ) : (
              <>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📷</div>
                <p style={{ fontWeight: 700, color: theme.primary, marginBottom: 4, fontSize: 15 }}>
                  Toque para fotografar ou escolher imagem
                </p>
                <p style={{ fontSize: 12, color: theme.textMuted }}>Câmera do celular · Galeria · JPG / PNG</p>
              </>
            )}
          </div>

          {imagePreview && (
            <button onClick={analisar} disabled={!!status}
              style={{ ...btn('sky', { full: true }), padding: '13px', fontSize: 16, borderRadius: theme.radiusMd, marginBottom: 14 }}>
              {status ? <><Spinner size={18} /> {status}</> : '🔍 Extrair texto com Google Vision'}
            </button>
          )}
        </>
      )}

      {erro && <ErrorBox message={erro} />}
    </div>
  );
}

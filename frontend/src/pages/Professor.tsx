import { useEffect, useState, useRef } from 'react';
import { api } from '../api';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_LETIVOS: Record<number, number> = {
  1: 4, 2: 13, 3: 22, 4: 18, 5: 20, 6: 21,
  7: 9, 8: 21, 9: 22, 10: 18, 11: 20, 12: 17,
};

// ── OCR helpers ─────────────────────────────────────────────────────────────

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
    if (/^(nº|nome|aluno|prof|turma|série|mês|escola|data|total|freq|emei|faltas|justif)/i.test(line)) continue;
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

// ── Componente ───────────────────────────────────────────────────────────────

type Modo = 'manual' | 'foto';

export default function Professor() {
  const [apiKey] = useState(() => localStorage.getItem('gvision_key') ?? '');
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [modo, setModo] = useState<Modo>('manual');
  const [erro, setErro] = useState('');

  // ── Manual mode state ──
  const [alunos, setAlunos] = useState<any[]>([]);
  const [faltasMap, setFaltasMap] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);
  const [carregando, setCarregando] = useState(false);

  // ── Foto/OCR state ──
  const [imageBase64, setImageBase64] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [resultado, setResultado] = useState<'auto' | 'revisao' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getTurmas().then(t => { setTurmas(t); if (t.length) setTurmaId(t[0].id); });
  }, []);

  // Carrega alunos + faltas existentes quando troca turma/mês
  useEffect(() => {
    if (!turmaId) return;
    setCarregando(true);
    setSalvoOk(false);
    setErro('');
    Promise.all([api.getAlunos(turmaId), api.getFaltas(turmaId, mes, 2026)])
      .then(([al, fa]) => {
        setAlunos(al);
        const map: Record<string, number> = {};
        fa.forEach((f: any) => { map[f.alunoId] = f.faltas ?? 0; });
        setFaltasMap(map);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, [turmaId, mes]);

  const turma = turmas.find(t => t.id === turmaId);
  const dl = DIAS_LETIVOS[mes] ?? 22;
  const alunosAtivos = alunos.filter(a => !a.situacao || a.situacao === 'ATIVO' || a.situacao === 'REMA');

  // ── Manual: ajustar faltas ──
  const ajustar = (alunoId: string, delta: number) => {
    setFaltasMap(prev => ({
      ...prev,
      [alunoId]: Math.max(0, Math.min(dl, (prev[alunoId] ?? 0) + delta)),
    }));
    setSalvoOk(false);
  };

  const salvarManual = async () => {
    setSalvando(true);
    setErro('');
    try {
      const registros = alunos.map(a => ({
        alunoId: a.id, turmaId, mes, ano: 2026,
        faltas: faltasMap[a.id] ?? 0,
        frequencia: '',
      }));
      await api.upsertFaltasBatch(registros);
      setSalvoOk(true);
    } catch (ex: any) {
      setErro(ex.message ?? 'Erro ao salvar.');
    }
    setSalvando(false);
  };

  // ── Foto/OCR handlers ──
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

  // ── Layout base ─────────────────────────────────────────────────────────────
  const BG = '#f1f5f9';
  const CARD = '#ffffff';
  const BLUE = '#1e40af';
  const RED = '#ef4444';

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px 80px' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 36 }}>📚</div>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: BLUE, marginTop: 4 }}>Lançar Frequência</h1>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Professores — selecione sua turma e o mês</p>
        </div>

        {/* Toggle de modo */}
        <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: `2px solid ${BLUE}`, marginBottom: 16 }}>
          {(['manual', 'foto'] as Modo[]).map(m => (
            <button key={m} onClick={() => { setModo(m); setErro(''); }}
              style={{
                flex: 1, padding: '13px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15,
                background: modo === m ? BLUE : CARD,
                color: modo === m ? 'white' : BLUE,
                transition: 'all 0.15s ease',
              }}>
              {m === 'manual' ? '✏️ Digitar' : '📷 Via Foto'}
            </button>
          ))}
        </div>

        {/* Seleção turma + mês (compartilhado) */}
        <div style={{ background: CARD, borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 5 }}>TURMA</div>
              <select value={turmaId} onChange={e => setTurmaId(e.target.value)}
                style={{ width: '100%', padding: '11px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, background: '#fff' }}>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 5 }}>MÊS</div>
              <select value={mes} onChange={e => setMes(Number(e.target.value))}
                style={{ width: '100%', padding: '11px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, background: '#fff' }}>
                {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>
          {turma?.professora && (
            <div style={{ marginTop: 10, fontSize: 13, color: BLUE, fontWeight: 700 }}>
              👩‍🏫 {turma.professora} &nbsp;·&nbsp; {dl} dias letivos
            </div>
          )}
        </div>

        {/* ══ MODO MANUAL ══ */}
        {modo === 'manual' && (
          <>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, textAlign: 'center' }}>
              Toque em <b>+</b> para cada falta do aluno no mês. Alunos sem falta ficam em 0.
            </div>

            {carregando ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
                ⏳ Carregando alunos...
              </div>
            ) : alunosAtivos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
                Nenhum aluno ativo nesta turma.
              </div>
            ) : (
              <>
                <div style={{ background: CARD, borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: 14 }}>

                  {/* Cabeçalho da lista */}
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 8, padding: '8px 14px', background: BLUE, color: 'white', fontSize: 11, fontWeight: 700 }}>
                    <span>Nº</span>
                    <span>NOME</span>
                    <span style={{ minWidth: 110, textAlign: 'center' }}>FALTAS</span>
                  </div>

                  {alunosAtivos.map((a, i) => {
                    const f = faltasMap[a.id] ?? 0;
                    const isUltimo = i === alunosAtivos.length - 1;
                    return (
                      <div key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        borderBottom: isUltimo ? 'none' : '1px solid #f1f5f9',
                        background: f > 0 ? '#fff5f5' : (i % 2 === 0 ? '#fff' : '#fafafa'),
                      }}>
                        <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 22, textAlign: 'right', flexShrink: 0 }}>
                          {String(a.numero || i + 1).padStart(2, '0')}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.nome}
                          </div>
                          {a.situacao && a.situacao !== 'ATIVO' && (
                            <div style={{ fontSize: 10, color: '#f97316', fontWeight: 700 }}>{a.situacao}</div>
                          )}
                          {a.deficiencia && (
                            <div style={{ fontSize: 10, color: '#7c3aed' }}>♿ {a.deficiencia}</div>
                          )}
                        </div>
                        {a.bolsa_familia && <span style={{ fontSize: 15, flexShrink: 0 }}>💚</span>}

                        {/* Controle +/- */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                          <button
                            onClick={() => ajustar(a.id, -1)}
                            disabled={f === 0}
                            style={{
                              width: 38, height: 38, borderRadius: 8, border: `2px solid ${f > 0 ? RED : '#e2e8f0'}`,
                              background: f > 0 ? RED : '#f8fafc',
                              color: f > 0 ? 'white' : '#cbd5e1',
                              fontSize: 22, cursor: f > 0 ? 'pointer' : 'default',
                              fontWeight: 700, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                            −
                          </button>
                          <span style={{
                            width: 34, textAlign: 'center', fontSize: 20, fontWeight: 800,
                            color: f > 0 ? RED : '#cbd5e1',
                          }}>
                            {f}
                          </span>
                          <button
                            onClick={() => ajustar(a.id, 1)}
                            disabled={f >= dl}
                            style={{
                              width: 38, height: 38, borderRadius: 8, border: `2px solid ${RED}`,
                              background: 'white', color: RED,
                              fontSize: 22, cursor: f < dl ? 'pointer' : 'default',
                              fontWeight: 700, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Resumo rápido */}
                {Object.values(faltasMap).some(v => v > 0) && (
                  <div style={{ background: '#fff7f7', border: `1px solid ${RED}22`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#7f1d1d' }}>
                    ⚠️ <b>{Object.values(faltasMap).filter(v => v > 0).length}</b> aluno(s) com falta &nbsp;·&nbsp;
                    Total: <b>{Object.values(faltasMap).reduce((s, v) => s + v, 0)}</b> faltas
                  </div>
                )}

                {/* Botão salvar */}
                <button onClick={salvarManual} disabled={salvando || salvoOk}
                  style={{
                    width: '100%', padding: '17px', borderRadius: 12, border: 'none',
                    cursor: salvando || salvoOk ? 'default' : 'pointer',
                    fontWeight: 800, fontSize: 17,
                    background: salvoOk ? '#16a34a' : BLUE,
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(30,64,175,0.3)',
                    transition: 'background 0.2s ease',
                  }}>
                  {salvando ? '⏳ Salvando...' : salvoOk ? '✅ Frequência salva!' : '💾 Salvar Frequência'}
                </button>
              </>
            )}
          </>
        )}

        {/* ══ MODO FOTO / OCR ══ */}
        {modo === 'foto' && (
          <>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, textAlign: 'center', lineHeight: 1.5 }}>
              Fotografe a <b>Folha de Frequência</b> preenchida pelo professor.<br />
              Use boa iluminação e enquadre toda a folha.
            </div>

            {resultado === 'auto' ? (
              <div style={{ background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: 16, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 56 }}>✅</div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 12 }}>Salvo automaticamente!</p>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{turma?.nome} — {MESES[mes - 1]} 2026</p>
                <button onClick={reiniciar} style={{ marginTop: 20, padding: '12px 28px', borderRadius: 10, background: BLUE, color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                  📷 Nova foto
                </button>
              </div>
            ) : resultado === 'revisao' ? (
              <div style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 16, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 56 }}>⏳</div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#92400e', marginTop: 12 }}>Enviado para revisão!</p>
                <p style={{ fontSize: 13, color: '#78350f', marginTop: 6 }}>{turma?.nome} — {MESES[mes - 1]} 2026</p>
                <p style={{ fontSize: 12, color: '#92400e', marginTop: 8 }}>A secretaria vai conferir e aprovar em breve.</p>
                <button onClick={reiniciar} style={{ marginTop: 20, padding: '12px 28px', borderRadius: 10, background: BLUE, color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                  📷 Nova foto
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{ border: `2px dashed #cbd5e1`, borderRadius: 16, padding: imagePreview ? 10 : 40, textAlign: 'center', background: '#f8fafc', cursor: 'pointer', marginBottom: 14 }}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImg(f); }} />
                  {imagePreview ? (
                    <img src={imagePreview} alt="Foto" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 10, objectFit: 'contain' }} />
                  ) : (
                    <>
                      <div style={{ fontSize: 52, marginBottom: 10 }}>📷</div>
                      <p style={{ fontWeight: 700, color: BLUE, fontSize: 16, marginBottom: 4 }}>Fotografar a folha</p>
                      <p style={{ fontSize: 13, color: '#94a3b8' }}>Toque aqui — câmera abre direto</p>
                    </>
                  )}
                </div>

                {imagePreview && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button onClick={reiniciar}
                      style={{ flex: 1, padding: '13px', borderRadius: 10, background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                      🔄 Refazer
                    </button>
                    <button onClick={enviar} disabled={!!status}
                      style={{ flex: 2, padding: '13px', borderRadius: 10, background: BLUE, color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
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
          </>
        )}

        {/* Erro */}
        {erro && (
          <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
            ⚠️ {erro}
          </div>
        )}

      </div>
    </div>
  );
}

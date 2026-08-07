import { useState, useRef } from 'react';
import { theme, btn, input, label } from '../styles';
import { useTheme } from '../ThemeContext';

type Orientacao = 'retrato' | 'paisagem';

interface CapaSalva {
  id: string;
  titulo: string;
  subtitulo: string;
  ac: string;
  orientacao: Orientacao;
  criadaEm: string;
}

const STORAGE_KEY = 'capas_envelope';

function carregarCapas(): CapaSalva[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function salvarCapas(capas: CapaSalva[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(capas));
}

export default function Capa() {
  const { theme: themeMode } = useTheme();
  const isDark = themeMode === 'dark';

  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [ac, setAc] = useState('');
  const [orientacao, setOrientacao] = useState<Orientacao>('paisagem');
  const [capas, setCapas] = useState<CapaSalva[]>(carregarCapas);
  const [previewAtivo, setPreviewAtivo] = useState<CapaSalva | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const gerarCapa = () => {
    if (!titulo.trim()) return;
    const nova: CapaSalva = {
      id: Date.now().toString(),
      titulo: titulo.trim().toUpperCase(),
      subtitulo: subtitulo.trim().toUpperCase(),
      ac: ac.trim(),
      orientacao,
      criadaEm: new Date().toLocaleDateString('pt-BR'),
    };
    const atualizadas = [nova, ...capas];
    setCapas(atualizadas);
    salvarCapas(atualizadas);
    setPreviewAtivo(nova);
  };

  const excluir = (id: string) => {
    const atualizadas = capas.filter(c => c.id !== id);
    setCapas(atualizadas);
    salvarCapas(atualizadas);
    if (previewAtivo?.id === id) setPreviewAtivo(null);
  };

  const imprimir = (capa: CapaSalva) => {
    const isPaisagem = capa.orientacao === 'paisagem';
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${capa.titulo}</title>
<style>
  @page { size: A4 ${isPaisagem ? 'landscape' : 'portrait'}; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; }
  .pagina {
    width: 100%; height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: white;
  }
  .capa {
    width: ${isPaisagem ? '240mm' : '175mm'};
    height: ${isPaisagem ? '155mm' : '245mm'};
    border: 6px solid #1e3a6e;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 20mm;
    position: relative;
    background: white;
  }
  .titulo {
    font-family: Arial, sans-serif;
    font-size: ${isPaisagem ? '36pt' : '30pt'};
    font-weight: 900;
    color: #1e3a6e;
    text-align: center;
    line-height: 1.2;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .subtitulo {
    font-family: Arial, sans-serif;
    font-size: ${isPaisagem ? '22pt' : '18pt'};
    font-weight: 700;
    color: #1e3a6e;
    text-align: center;
    margin-top: 10mm;
    text-transform: uppercase;
  }
  .ac {
    position: absolute;
    top: 8mm;
    left: 12mm;
    font-family: Arial, sans-serif;
    font-size: ${isPaisagem ? '11pt' : '10pt'};
    color: #1e3a6e;
    font-weight: 700;
    text-align: left;
  }
  .escola {
    position: absolute;
    bottom: 10mm;
    right: 12mm;
    font-family: Arial, sans-serif;
    font-size: 9pt;
    color: #1e3a6e;
    font-weight: 600;
    text-align: right;
  }
</style>
</head>
<body>
<div class="pagina">
  <div class="capa">
    ${capa.ac ? `<div class="ac">A/C ${capa.ac}</div>` : ''}
    <div class="titulo">${capa.titulo}</div>
    ${capa.subtitulo ? `<div class="subtitulo">${capa.subtitulo}</div>` : ''}
    <div class="escola">EMEIEF LUIZ GONZAGA<br>Santo André — SP</div>
  </div>
</div>
</body>
</html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const isPaisagem = (c: CapaSalva) => c.orientacao === 'paisagem';

  const CardPreview = ({ capa, mini = false }: { capa: CapaSalva; mini?: boolean }) => {
    const p = isPaisagem(capa);
    const w = mini ? (p ? 180 : 110) : (p ? 360 : 220);
    const h = mini ? (p ? 116 : 156) : (p ? 232 : 312);
    const fs = mini ? (p ? 9 : 8) : (p ? 18 : 15);
    const fsSub = mini ? 7 : (p ? 12 : 10);
    const fsAc = mini ? 5.5 : (p ? 9 : 8);
    return (
      <div style={{
        width: w, height: h, border: '4px solid #1e3a6e', background: 'white',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: mini ? 8 : 24, position: 'relative', borderRadius: 2, flexShrink: 0,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}>
        {capa.ac && (
          <div style={{ position: 'absolute', top: mini ? 4 : 8, left: mini ? 4 : 10, fontSize: fsAc, color: '#1e3a6e', fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
            A/C {capa.ac}
          </div>
        )}
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: fs, fontWeight: 900, color: '#1e3a6e', textAlign: 'center', lineHeight: 1.2, letterSpacing: 0.5 }}>
          {capa.titulo}
        </div>
        {capa.subtitulo && (
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: fsSub, fontWeight: 700, color: '#1e3a6e', textAlign: 'center', marginTop: mini ? 4 : 12 }}>
            {capa.subtitulo}
          </div>
        )}
        <div style={{ position: 'absolute', bottom: mini ? 4 : 8, right: mini ? 4 : 10, fontSize: mini ? 5 : 8, color: '#1e3a6e', fontWeight: 600, textAlign: 'right', fontFamily: 'Arial, sans-serif' }}>
          EMEIEF LUIZ GONZAGA<br />Santo André — SP
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>

      <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 20, marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginBottom: 18 }}>✉️ Capa de Envelope</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={label}>Título principal *</label>
            <input
              style={{ ...input, width: '100%', textTransform: 'uppercase', fontWeight: 700 }}
              placeholder="Ex: FOLHAS DE FREQUÊNCIA"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && gerarCapa()}
            />
          </div>
          <div>
            <label style={label}>Subtítulo (opcional)</label>
            <input
              style={{ ...input, width: '100%', textTransform: 'uppercase' }}
              placeholder="Ex: MARÇO 2026"
              value={subtitulo}
              onChange={e => setSubtitulo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && gerarCapa()}
            />
          </div>
          <div>
            <label style={label}>A/C — Aos Cuidados de (destinatário)</label>
            <input
              style={{ ...input, width: '100%' }}
              placeholder="Ex: Melissa"
              value={ac}
              onChange={e => setAc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && gerarCapa()}
            />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={label}>Orientação</label>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['paisagem', 'retrato'] as Orientacao[]).map(op => (
              <label key={op} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: theme.text, fontWeight: orientacao === op ? 700 : 400 }}>
                <input type="radio" value={op} checked={orientacao === op} onChange={() => setOrientacao(op)} style={{ accentColor: theme.primary }} />
                {op === 'paisagem' ? '🖼️ Paisagem (horizontal)' : '📄 Retrato (vertical)'}
              </label>
            ))}
          </div>
        </div>

        <button
          style={{ ...btn, opacity: !titulo.trim() ? 0.5 : 1 }}
          disabled={!titulo.trim()}
          onClick={gerarCapa}
        >
          ✨ Gerar Capa
        </button>
      </div>

      {/* Preview da capa ativa */}
      {previewAtivo && (
        <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 24, marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>Pré-visualização</h2>
            <button
              style={{ ...btn, background: '#16a34a', fontSize: 14 }}
              onClick={() => imprimir(previewAtivo)}
            >
              🖨️ Imprimir
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', background: isDark ? 'rgba(0,0,0,0.2)' : '#f1f5f9', borderRadius: 8 }}>
            <CardPreview capa={previewAtivo} />
          </div>
        </div>
      )}

      {/* Capas salvas */}
      {capas.length > 0 && (
        <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 20, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 16 }}>📂 Capas salvas</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {capas.map(c => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ cursor: 'pointer' }} onClick={() => setPreviewAtivo(c)} title="Clique para visualizar">
                  <CardPreview capa={c} mini />
                </div>
                <div style={{ textAlign: 'center', maxWidth: isPaisagem(c) ? 180 : 110 }}>
                  {c.ac && <div style={{ fontSize: 10, color: theme.primary, fontWeight: 700 }}>A/C {c.ac}</div>}
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.text, lineHeight: 1.2 }}>{c.titulo}</div>
                  {c.subtitulo && <div style={{ fontSize: 10, color: theme.textMuted }}>{c.subtitulo}</div>}
                  <div style={{ fontSize: 10, color: theme.textMuted }}>{c.criadaEm}</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 6 }}>
                    <button
                      style={{ ...btn, fontSize: 11, padding: '4px 10px', background: '#16a34a' }}
                      onClick={() => imprimir(c)}
                    >🖨️ Imprimir</button>
                    <button
                      style={{ ...btn, fontSize: 11, padding: '4px 10px', background: '#dc2626' }}
                      onClick={() => excluir(c.id)}
                    >🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={printRef} />
    </div>
  );
}

import { useState, useRef } from 'react';
import { theme, btn, input, label } from '../styles';
import { useTheme } from '../ThemeContext';

type Orientacao = 'retrato' | 'paisagem';
type Modelo = 'classico' | 'colorido';

interface CapaSalva {
  id: string;
  titulo: string;
  subtitulo: string;
  ac: string;
  orientacao: Orientacao;
  modelo: Modelo;
  local?: string;
  endereco?: string;
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

// SVG das faixas diagonais coloridas (viewBox 0 0 297 210 — paisagem A4)
function svgFaixas() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 297 210" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">
    <polygon points="0,0 42,0 0,55" fill="#1e3a6e"/>
    <polygon points="0,0 22,0 0,28" fill="#1a7fd4"/>
    <polygon points="297,0 297,95 202,0" fill="#f5d400"/>
    <polygon points="297,0 297,68 229,0" fill="#1a7fd4"/>
    <polygon points="297,0 297,42 255,0" fill="#1e3a6e"/>
    <polygon points="0,210 0,115 95,210" fill="#f5d400"/>
    <polygon points="0,210 0,142 68,210" fill="#1a7fd4"/>
    <polygon points="0,210 0,168 42,210" fill="#1e3a6e"/>
    <polygon points="297,210 255,210 297,168" fill="#f5d400"/>
    <polygon points="297,210 272,210 297,188" fill="#1a7fd4"/>
  </svg>`;
}

function htmlColorido(capa: CapaSalva) {
  const faixas = svgFaixas();
  const bgPage = `
    position:relative;overflow:hidden;
    width:297mm;height:210mm;
    background:#d6eaf8;
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    page-break-after:always;
  `;
  const txtAzul = 'font-family:Arial,sans-serif;color:#1a3a6e;font-style:italic;';

  const pag1 = `
    <div style="${bgPage}">
      ${faixas}
      <div style="position:relative;z-index:1;text-align:center;padding:0 60mm;">
        <p style="${txtAzul}font-size:16pt;font-weight:700;margin-bottom:4mm;">
          ${capa.ac ? `A/C ${capa.ac}` : ''}
        </p>
        <p style="${txtAzul}font-size:13pt;margin-bottom:12mm;">Controle de Frequência</p>
        <p style="${txtAzul}font-size:30pt;font-weight:900;font-style:normal;line-height:1.1;margin-bottom:4mm;">
          ${capa.titulo}
        </p>
        ${capa.subtitulo ? `<p style="${txtAzul}font-size:22pt;font-weight:900;font-style:normal;">"${capa.subtitulo}"</p>` : ''}
        ${capa.local ? `<p style="${txtAzul}font-size:13pt;margin-top:10mm;">Local: ${capa.local}</p>` : ''}
      </div>
    </div>
  `;

  const pag2 = `
    <div style="${bgPage}page-break-after:avoid;">
      ${faixas}
      <div style="position:relative;z-index:1;text-align:center;padding:0 60mm;">
        <p style="${txtAzul}font-size:9pt;margin-bottom:3mm;">EMEIEF LUIZ GONZAGA</p>
        <p style="${txtAzul}font-size:16pt;font-weight:700;margin-bottom:8mm;">Ao Controle de Frequência</p>
        <p style="${txtAzul}font-size:28pt;font-weight:900;margin-bottom:4mm;">
          ${capa.ac ? `A/C ${capa.ac}` : ''}
        </p>
        ${capa.endereco ? capa.endereco.split('\n').map(l => `<p style="${txtAzul}font-size:14pt;font-weight:700;">${l}</p>`).join('') : ''}
      </div>
    </div>
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${capa.titulo}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; background: white; }
</style>
</head>
<body>${pag1}${pag2}</body>
</html>`;
}

function htmlGape(conteudo: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>GAPE</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; background: white; font-family: Arial, sans-serif; }
  .pagina {
    width: 297mm; height: 210mm;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: white; position: relative;
  }
  .remetente {
    position: absolute; top: 14mm; left: 18mm;
    font-size: 11pt; font-weight: 700; color: #1e3a6e;
    line-height: 1.5;
  }
  .destino-label {
    font-size: 14pt; font-weight: 700; color: #444;
    letter-spacing: 4px; text-transform: uppercase;
    margin-bottom: 6mm;
  }
  .gape {
    font-size: 96pt; font-weight: 900; color: #1e3a6e;
    letter-spacing: 12px; line-height: 1;
    text-transform: uppercase;
  }
  .conteudo {
    font-size: 32pt; font-weight: 900; color: #1e3a6e;
    text-transform: uppercase; text-align: center;
    margin-top: 8mm; letter-spacing: 3px;
    max-width: 220mm;
  }
  .divider {
    width: 160mm; height: 3px; background: #1e3a6e;
    margin: 5mm 0;
  }
</style>
</head>
<body>
<div class="pagina">
  <div class="remetente">
    <strong>De:</strong> EMEIEF LUIZ GONZAGA<br>
    Santo André — SP
  </div>
  <div class="destino-label">Para</div>
  <div class="gape">GAPE</div>
  <div class="divider"></div>
  ${conteudo ? `<div class="conteudo">${conteudo}</div>` : ''}
</div>
</body>
</html>`;
}

export default function Capa() {
  const { theme: themeMode } = useTheme();
  const isDark = themeMode === 'dark';

  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [ac, setAc] = useState('');
  const [orientacao, setOrientacao] = useState<Orientacao>('paisagem');
  const [modelo, setModelo] = useState<Modelo>('classico');
  const [local, setLocal] = useState('');
  const [endereco, setEndereco] = useState('');
  const [gapeConteudo, setGapeConteudo] = useState('');
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
      orientacao: modelo === 'colorido' ? 'paisagem' : orientacao,
      modelo,
      local: local.trim(),
      endereco: endereco.trim(),
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

  const imprimirClassico = (capa: CapaSalva) => {
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
  .pagina { width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; background: white; }
  .capa {
    width: ${isPaisagem ? '240mm' : '175mm'};
    height: ${isPaisagem ? '155mm' : '245mm'};
    border: 6px solid #1e3a6e;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 20mm; position: relative; background: white;
  }
  .titulo { font-family: Arial,sans-serif; font-size: ${isPaisagem ? '36pt' : '30pt'}; font-weight: 900; color: #1e3a6e; text-align: center; line-height: 1.2; letter-spacing: 1px; text-transform: uppercase; }
  .subtitulo { font-family: Arial,sans-serif; font-size: ${isPaisagem ? '22pt' : '18pt'}; font-weight: 700; color: #1e3a6e; text-align: center; margin-top: 10mm; text-transform: uppercase; }
  .ac { position: absolute; top: 8mm; left: 12mm; font-family: Arial,sans-serif; font-size: ${isPaisagem ? '11pt' : '10pt'}; color: #1e3a6e; font-weight: 700; }
  .escola { position: absolute; bottom: 10mm; right: 12mm; font-family: Arial,sans-serif; font-size: 9pt; color: #1e3a6e; font-weight: 600; text-align: right; }
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

  const imprimir = (capa: CapaSalva) => {
    if (capa.modelo === 'colorido') {
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(htmlColorido(capa));
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); win.close(); }, 400);
    } else {
      imprimirClassico(capa);
    }
  };

  const isPaisagem = (c: CapaSalva) => c.orientacao === 'paisagem' || c.modelo === 'colorido';

  // Preview clássico
  const CardPreviewClassico = ({ capa, mini = false }: { capa: CapaSalva; mini?: boolean }) => {
    const p = isPaisagem(capa);
    const w = mini ? (p ? 180 : 110) : (p ? 360 : 220);
    const h = mini ? (p ? 116 : 156) : (p ? 232 : 312);
    const fs = mini ? (p ? 9 : 8) : (p ? 18 : 15);
    const fsSub = mini ? 7 : (p ? 12 : 10);
    const fsAc = mini ? 5.5 : (p ? 9 : 8);
    return (
      <div style={{ width: w, height: h, border: '4px solid #1e3a6e', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: mini ? 8 : 24, position: 'relative', borderRadius: 2, flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
        {capa.ac && <div style={{ position: 'absolute', top: mini ? 4 : 8, left: mini ? 4 : 10, fontSize: fsAc, color: '#1e3a6e', fontWeight: 700, fontFamily: 'Arial,sans-serif' }}>A/C {capa.ac}</div>}
        <div style={{ fontFamily: 'Arial,sans-serif', fontSize: fs, fontWeight: 900, color: '#1e3a6e', textAlign: 'center', lineHeight: 1.2 }}>{capa.titulo}</div>
        {capa.subtitulo && <div style={{ fontFamily: 'Arial,sans-serif', fontSize: fsSub, fontWeight: 700, color: '#1e3a6e', textAlign: 'center', marginTop: mini ? 4 : 12 }}>{capa.subtitulo}</div>}
        <div style={{ position: 'absolute', bottom: mini ? 4 : 8, right: mini ? 4 : 10, fontSize: mini ? 5 : 8, color: '#1e3a6e', fontWeight: 600, textAlign: 'right', fontFamily: 'Arial,sans-serif' }}>EMEIEF LUIZ GONZAGA<br />Santo André — SP</div>
      </div>
    );
  };

  // Preview colorido
  const CardPreviewColorido = ({ capa, mini = false }: { capa: CapaSalva; mini?: boolean }) => {
    const w = mini ? 180 : 360;
    const h = mini ? 127 : 254;
    const s = mini ? 0.42 : 0.84; // scale factor (1px ≈ ~1/1.18mm)
    return (
      <div style={{ width: w, height: h, background: '#d6eaf8', position: 'relative', overflow: 'hidden', borderRadius: 3, flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Faixas SVG */}
        <svg viewBox="0 0 297 210" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <polygon points="0,0 42,0 0,55" fill="#1e3a6e" />
          <polygon points="0,0 22,0 0,28" fill="#1a7fd4" />
          <polygon points="297,0 297,95 202,0" fill="#f5d400" />
          <polygon points="297,0 297,68 229,0" fill="#1a7fd4" />
          <polygon points="297,0 297,42 255,0" fill="#1e3a6e" />
          <polygon points="0,210 0,115 95,210" fill="#f5d400" />
          <polygon points="0,210 0,142 68,210" fill="#1a7fd4" />
          <polygon points="0,210 0,168 42,210" fill="#1e3a6e" />
          <polygon points="297,210 255,210 297,168" fill="#f5d400" />
          <polygon points="297,210 272,210 297,188" fill="#1a7fd4" />
        </svg>
        {/* Texto */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: `0 ${mini ? 18 : 36}px`, fontFamily: 'Arial,sans-serif', color: '#1a3a6e' }}>
          {capa.ac && <div style={{ fontSize: s * 10, fontWeight: 700, fontStyle: 'italic', marginBottom: 2 }}>A/C {capa.ac}</div>}
          <div style={{ fontSize: s * 8, fontStyle: 'italic', marginBottom: mini ? 4 : 8, opacity: 0.8 }}>Controle de Frequência</div>
          <div style={{ fontSize: s * 14, fontWeight: 900, lineHeight: 1.1 }}>{capa.titulo}</div>
          {capa.subtitulo && <div style={{ fontSize: s * 10, fontWeight: 900, marginTop: 2 }}>"{capa.subtitulo}"</div>}
        </div>
        {/* Badge colorido */}
        <div style={{ position: 'absolute', bottom: mini ? 4 : 8, right: mini ? 6 : 12, fontSize: mini ? 7 : 9, color: '#1a3a6e', fontWeight: 700, fontStyle: 'italic' }}>2 páginas</div>
      </div>
    );
  };

  const CardPreview = ({ capa, mini = false }: { capa: CapaSalva; mini?: boolean }) =>
    capa.modelo === 'colorido'
      ? <CardPreviewColorido capa={capa} mini={mini} />
      : <CardPreviewClassico capa={capa} mini={mini} />;

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>

      <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 20, marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginBottom: 18 }}>✉️ Capa de Envelope</h1>

        {/* Impressão rápida — Folha de Frequência */}
        <div style={{ background: isDark ? 'rgba(37,99,235,0.12)' : '#eff6ff', border: `1.5px solid ${isDark ? '#3b82f6' : '#93c5fd'}`, borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: isDark ? '#93c5fd' : '#1d4ed8' }}>📋 Capa Mensal — Folha de Frequência</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>A/C Melissa Lopes · Controle de Frequência · 12° andar – Sala 03 · Prédio Executivo</div>
          </div>
          <button
            style={{ ...btn, background: '#1d4ed8', fontSize: 13, whiteSpace: 'nowrap' }}
            onClick={() => {
              const capa: CapaSalva = {
                id: 'freq-mensal',
                titulo: 'FOLHA DE FREQUÊNCIA',
                subtitulo: 'NÃO ABRIR',
                ac: 'Melissa Lopes',
                orientacao: 'paisagem',
                modelo: 'colorido',
                local: '',
                endereco: '12° andar – Sala 03\nPrédio Executivo',
                criadaEm: '',
              };
              const win = window.open('', '_blank');
              if (!win) return;
              win.document.write(htmlColorido(capa));
              win.document.close();
              win.focus();
              setTimeout(() => { win.print(); win.close(); }, 400);
            }}
          >
            🖨️ Imprimir agora
          </button>
        </div>

        {/* Impressão rápida — GAPE */}
        <div style={{ background: isDark ? 'rgba(30,58,110,0.15)' : '#eff3ff', border: `1.5px solid ${isDark ? '#6366f1' : '#818cf8'}`, borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: isDark ? '#a5b4fc' : '#3730a3', marginBottom: 8 }}>📦 Capa para GAPE</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>De: EMEIEF LUIZ GONZAGA → GAPE — letras grandes. Coloque o conteúdo do envelope (opcional).</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ ...label, marginBottom: 4 }}>Conteúdo do envelope (opcional)</label>
              <input
                style={{ ...input, width: '100%', textTransform: 'uppercase', fontWeight: 700 }}
                placeholder="Ex: FOLHA DE FREQUÊNCIA"
                value={gapeConteudo}
                onChange={e => setGapeConteudo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const win = window.open('', '_blank');
                    if (!win) return;
                    win.document.write(htmlGape(gapeConteudo.trim().toUpperCase()));
                    win.document.close(); win.focus();
                    setTimeout(() => { win.print(); win.close(); }, 400);
                  }
                }}
              />
            </div>
            <button
              style={{ ...btn, background: '#3730a3', fontSize: 13, whiteSpace: 'nowrap' }}
              onClick={() => {
                const win = window.open('', '_blank');
                if (!win) return;
                win.document.write(htmlGape(gapeConteudo.trim().toUpperCase()));
                win.document.close(); win.focus();
                setTimeout(() => { win.print(); win.close(); }, 400);
              }}
            >
              🖨️ Imprimir GAPE
            </button>
          </div>
          {/* Atalhos rápidos GAPE */}
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { label: '📋 Folha de Frequência', txt: 'FOLHA DE FREQUÊNCIA' },
              { label: '🏫 Conselho de Escola', txt: 'CONSELHO DE ESCOLA' },
            ].map(({ label: lbl, txt }) => (
              <button
                key={txt}
                style={{ ...btn, fontSize: 12, padding: '6px 16px', background: isDark ? '#4338ca' : '#4f46e5' }}
                onClick={() => {
                  const win = window.open('', '_blank');
                  if (!win) return;
                  win.document.write(htmlGape(txt));
                  win.document.close(); win.focus();
                  setTimeout(() => { win.print(); win.close(); }, 400);
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Seleção de modelo */}
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Modelo</label>
          <div style={{ display: 'flex', gap: 12 }}>
            {([['classico', '📄 Clássico (borda azul)'], ['colorido', '🎨 Colorido (faixas — 2 páginas)']] as [Modelo, string][]).map(([m, lbl]) => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: theme.text, fontWeight: modelo === m ? 700 : 400, padding: '8px 14px', borderRadius: 8, border: `2px solid ${modelo === m ? theme.primary : theme.borderLight}`, background: modelo === m ? `${theme.primary}15` : 'transparent' }}>
                <input type="radio" value={m} checked={modelo === m} onChange={() => setModelo(m)} style={{ accentColor: theme.primary }} />
                {lbl}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={label}>Título principal *</label>
            <input style={{ ...input, width: '100%', textTransform: 'uppercase', fontWeight: 700 }} placeholder="Ex: FOLHA DE FREQUÊNCIA" value={titulo} onChange={e => setTitulo(e.target.value)} onKeyDown={e => e.key === 'Enter' && gerarCapa()} />
          </div>
          <div>
            <label style={label}>{modelo === 'colorido' ? 'Subtítulo (ex: NÃO ABRIR)' : 'Subtítulo (opcional)'}</label>
            <input style={{ ...input, width: '100%', textTransform: 'uppercase' }} placeholder={modelo === 'colorido' ? 'NÃO ABRIR' : 'Ex: MARÇO 2026'} value={subtitulo} onChange={e => setSubtitulo(e.target.value)} onKeyDown={e => e.key === 'Enter' && gerarCapa()} />
          </div>
          <div>
            <label style={label}>A/C — Nome do destinatário</label>
            <input style={{ ...input, width: '100%' }} placeholder="Ex: Melissa Lopes" value={ac} onChange={e => setAc(e.target.value)} onKeyDown={e => e.key === 'Enter' && gerarCapa()} />
          </div>
          {modelo === 'colorido' ? (
            <>
              <div>
                <label style={label}>Local (opcional)</label>
                <input style={{ ...input, width: '100%' }} placeholder="Ex: Secretaria" value={local} onChange={e => setLocal(e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Endereço do destinatário (uma linha por vez)</label>
                <textarea style={{ ...input, width: '100%', minHeight: 64, resize: 'vertical' }} placeholder={'Ex:\n12° andar – Sala 03\nPrédio Executivo'} value={endereco} onChange={e => setEndereco(e.target.value)} />
              </div>
            </>
          ) : null}
        </div>

        {modelo === 'classico' && (
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Orientação</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['paisagem', 'retrato'] as Orientacao[]).map(op => (
                <label key={op} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: theme.text, fontWeight: orientacao === op ? 700 : 400 }}>
                  <input type="radio" value={op} checked={orientacao === op} onChange={() => setOrientacao(op)} style={{ accentColor: theme.primary }} />
                  {op === 'paisagem' ? '🖼️ Paisagem' : '📄 Retrato'}
                </label>
              ))}
            </div>
          </div>
        )}

        <button style={{ ...btn, opacity: !titulo.trim() ? 0.5 : 1 }} disabled={!titulo.trim()} onClick={gerarCapa}>
          ✨ Gerar Capa
        </button>
      </div>

      {/* Preview da capa ativa */}
      {previewAtivo && (
        <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 24, marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>
              Pré-visualização {previewAtivo.modelo === 'colorido' ? <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 400 }}>— frente (imprime 2 páginas)</span> : ''}
            </h2>
            <button style={{ ...btn, background: '#16a34a', fontSize: 14 }} onClick={() => imprimir(previewAtivo)}>🖨️ Imprimir</button>
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
                    <button style={{ ...btn, fontSize: 11, padding: '4px 10px', background: '#16a34a' }} onClick={() => imprimir(c)}>🖨️ Imprimir</button>
                    <button style={{ ...btn, fontSize: 11, padding: '4px 10px', background: '#dc2626' }} onClick={() => excluir(c.id)}>🗑️</button>
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

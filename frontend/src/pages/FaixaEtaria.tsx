import { useMemo, useState } from 'react';
import { theme, card as cardStyle, input, label as labelStyle } from '../styles';
import { calcTabelaFaixaEtaria, classificarNascimento } from '../faixaEtariaCalculos';

const anoAtual = new Date().getFullYear();
const ANOS_DISPONIVEIS = [anoAtual, anoAtual + 1, anoAtual + 2, anoAtual + 3, anoAtual + 4];

function Tabela({ titulo, linhas }: { titulo: string; linhas: ReturnType<typeof calcTabelaFaixaEtaria> }) {
  return (
    <div style={cardStyle({ marginBottom: 20 })}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.borderLight}`, fontWeight: 800, color: theme.text, fontSize: 15 }}>
        {titulo}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--row-even)' }}>
              <th style={th}>Etapa</th>
              <th style={th}>Nasceu de</th>
              <th style={th}>até</th>
              <th style={th}>Idade completa em 31/03</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l.etapa} style={{ background: i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)' }}>
                <td style={td}>{l.etapa}</td>
                <td style={td}>{l.nascidoDe}</td>
                <td style={td}>{l.nascidoAte}</td>
                <td style={td}>{l.idade === 0 ? '0 a 2 anos' : `${l.idade} ${l.idade === 1 ? 'ano' : 'anos'} completos`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: theme.textSecondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 };
const td: React.CSSProperties = { padding: '9px 14px', color: theme.text, borderBottom: `1px solid ${theme.borderLight}` };

export default function FaixaEtaria() {
  const [anoLetivo, setAnoLetivo] = useState(anoAtual + 1);
  const [dataNasc, setDataNasc] = useState('');

  const tabela = useMemo(() => calcTabelaFaixaEtaria(anoLetivo), [anoLetivo]);
  const infantil = tabela.filter(l => l.grupo === 'Infantil');
  const fundamental = tabela.filter(l => l.grupo === 'Fundamental');

  const resultado = useMemo(() => {
    if (!dataNasc || dataNasc.length < 10) return null;
    return classificarNascimento(dataNasc, anoLetivo);
  }, [dataNasc, anoLetivo]);

  return (
    <div>
      <h2 style={{ color: theme.text, marginBottom: 4 }}>📅 Faixa Etária</h2>
      <p style={{ color: theme.textSecondary, fontSize: 14, marginBottom: 18 }}>
        Janela de nascimento por etapa, calculada pela data de corte oficial de 31/03 — a mesma regra usada pelo sistema SED.
        Só é possível ingressar em uma etapa no ano letivo em que a criança se encaixar na faixa; não há antecipação.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={cardStyle({ padding: 16, flex: '1 1 220px' })}>
          <label style={labelStyle}>Ano letivo</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ANOS_DISPONIVEIS.map(a => (
              <button
                key={a}
                onClick={() => setAnoLetivo(a)}
                style={{
                  padding: '8px 18px',
                  borderRadius: theme.radius,
                  border: `1.5px solid ${anoLetivo === a ? theme.primary : theme.border}`,
                  background: anoLetivo === a ? theme.primary : 'transparent',
                  color: anoLetivo === a ? '#fff' : theme.text,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div style={cardStyle({ padding: 16, flex: '2 1 360px' })}>
          <div style={{ fontWeight: 800, color: theme.text, marginBottom: 10, fontSize: 15 }}>🔎 Verificar etapa por data de nascimento</div>
          <div style={{ maxWidth: 200, marginBottom: resultado ? 10 : 0 }}>
            <input
              style={input}
              placeholder="dd/mm/aaaa"
              value={dataNasc}
              onChange={e => setDataNasc(e.target.value)}
            />
          </div>
          {resultado && (
            <div style={{ fontSize: 14, color: theme.text }}>
              {resultado.tipo === 'etapa' && (
                <>Em <strong>{anoLetivo}</strong>, essa criança se encaixa em: <strong style={{ color: theme.primary }}>{resultado.etapa.etapa}</strong> ({resultado.etapa.idade} {resultado.etapa.idade === 1 ? 'ano completo' : 'anos completos'} em 31/03/{anoLetivo}).</>
              )}
              {resultado.tipo === 'creche' && (
                <span style={{ color: theme.textSecondary }}>Em <strong>{anoLetivo}</strong>, essa criança estaria na faixa de <strong>Creche (0 a 2 anos)</strong> — matrícula contínua, sem data de corte fixa.</span>
              )}
              {resultado.tipo === 'fundamental_alem' && (
                <span>Em <strong>{anoLetivo}</strong>, essa criança já estaria cursando o <strong style={{ color: theme.warning }}>{resultado.serie}º Ano</strong> — fora da faixa atendida por esta escola, que vai até o 5º Ano.</span>
              )}
              {resultado.tipo === 'concluido' && (
                <span>Em <strong>{anoLetivo}</strong>, essa criança já teria concluído o Ensino Fundamental (09 anos) regular.</span>
              )}
              {resultado.tipo === 'invalido' && (
                <span style={{ color: theme.danger }}>Data de nascimento inválida.</span>
              )}
            </div>
          )}
        </div>
      </div>

      <Tabela titulo={`Educação Infantil — ano letivo ${anoLetivo}`} linhas={infantil} />
      <Tabela titulo={`Ensino Fundamental (09 anos) — ano letivo ${anoLetivo}`} linhas={fundamental} />

      <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
        ⚠️ A Creche (Berçário I e II) não segue a data de corte de 31/03 — a matrícula é contínua ao longo do ano para
        crianças de 0 a 2 anos, diferente das etapas com matrícula obrigatória a partir dos 4 anos.
        Uma criança de 3 anos não pode ser matriculada diretamente no Ensino Fundamental "adiantada" — o sistema SED
        bloqueia matrícula fora da janela de nascimento da etapa correspondente ao ano letivo.
      </div>
    </div>
  );
}

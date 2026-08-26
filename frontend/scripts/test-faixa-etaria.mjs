import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(tmpdir(), `faixa-etaria-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [path.join(raiz, 'src/faixaEtariaCalculos.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  });

  const { calcJanelaNascimento, calcTabelaFaixaEtaria, etapaParaNascimento } =
    await import(`${pathToFileURL(bundle).href}?${Date.now()}`);

  // ── Conferência linha a linha contra a tabela oficial do Anexo 01 (2027) ──
  // Fonte: Resumo_Inscricoes_DivisaoDemanda_2027_SantoAndre.pdf, página "Tabela
  // de Faixa Etária para ingresso em 2027".
  const tabela2027 = calcTabelaFaixaEtaria(2027);
  const porEtapa = Object.fromEntries(tabela2027.map(e => [e.etapa, e]));

  assert.equal(porEtapa['1º Ciclo Inicial (Maternal I)'].nascidoDe, '01/04/2024');
  assert.equal(porEtapa['1º Ciclo Inicial (Maternal I)'].nascidoAte, '31/03/2025');

  assert.equal(porEtapa['1º Ciclo Final (Maternal II)'].nascidoDe, '01/04/2023');
  assert.equal(porEtapa['1º Ciclo Final (Maternal II)'].nascidoAte, '31/03/2024');

  assert.equal(porEtapa['2º Ciclo Inicial — 1ª Etapa (Pré-escola)'].nascidoDe, '01/04/2022');
  assert.equal(porEtapa['2º Ciclo Inicial — 1ª Etapa (Pré-escola)'].nascidoAte, '31/03/2023');

  assert.equal(porEtapa['2º Ciclo Final — 2ª Etapa (Pré-escola)'].nascidoDe, '01/04/2021');
  assert.equal(porEtapa['2º Ciclo Final — 2ª Etapa (Pré-escola)'].nascidoAte, '31/03/2022');

  assert.equal(porEtapa['1º Ano'].nascidoDe, '01/04/2020');
  assert.equal(porEtapa['1º Ano'].nascidoAte, '31/03/2021');

  assert.equal(porEtapa['2º Ano'].nascidoDe, '01/04/2019');
  assert.equal(porEtapa['2º Ano'].nascidoAte, '31/03/2020');

  assert.equal(porEtapa['3º Ano'].nascidoDe, '01/04/2018');
  assert.equal(porEtapa['3º Ano'].nascidoAte, '31/03/2019');

  assert.equal(porEtapa['4º Ano'].nascidoDe, '01/04/2017');
  assert.equal(porEtapa['4º Ano'].nascidoAte, '31/03/2018');

  assert.equal(porEtapa['5º Ano'].nascidoDe, '01/04/2016');
  assert.equal(porEtapa['5º Ano'].nascidoAte, '31/03/2017');

  assert.equal(porEtapa['Berçário I e II (Creche)'].nascidoDe, '01/04/2025');
  console.log('Teste calcTabelaFaixaEtaria (conferência linha a linha com a tabela oficial de 2027): OK');

  // ── Generalização: mesma fórmula deve valer para outro ano letivo (2026) ──
  const j2026_pre4 = calcJanelaNascimento(2026, 4);
  assert.equal(j2026_pre4.nascidoDe, '01/04/2021');
  assert.equal(j2026_pre4.nascidoAte, '31/03/2022');
  console.log('Teste calcJanelaNascimento genérico (2026): OK');

  // ── etapaParaNascimento — identifica a etapa a partir da data de nascimento ──
  assert.equal(etapaParaNascimento('15/08/2022', 2027)?.etapa, '2º Ciclo Inicial — 1ª Etapa (Pré-escola)');
  assert.equal(etapaParaNascimento('31/03/2022', 2027)?.etapa, '2º Ciclo Final — 2ª Etapa (Pré-escola)', 'nascido no último dia da janela anterior ainda pertence a ela');
  assert.equal(etapaParaNascimento('01/04/2022', 2027)?.etapa, '2º Ciclo Inicial — 1ª Etapa (Pré-escola)', 'nascido no primeiro dia da nova janela já muda de etapa');
  assert.equal(etapaParaNascimento('01/04/2020', 2027)?.etapa, '1º Ano');
  assert.equal(etapaParaNascimento('', 2027), null);
  console.log('Teste etapaParaNascimento: OK');

  console.log('\nTodos os testes de Faixa Etária passaram.');
} finally {
  await rm(bundle, { force: true });
}

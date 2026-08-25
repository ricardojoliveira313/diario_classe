import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(tmpdir(), `analitico-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [path.join(raiz, 'src/analiticoCalculos.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  });

  const { calcIdadeEm31Marco, extrairSerie, etapaDaTurma, estaPendente, contaParaSequenciaReal } =
    await import(`${pathToFileURL(bundle).href}?${Date.now()}`);

  // ── calcIdadeEm31Marco ────────────────────────────────────────────────
  assert.equal(calcIdadeEm31Marco('15/08/2015', 2026), 10, 'nascido em agosto/2015: 10 anos em 31/03/2026');
  assert.equal(calcIdadeEm31Marco('01/04/2015', 2026), 10, 'aniversário logo depois de 31/03 ainda não conta o ano');
  assert.equal(calcIdadeEm31Marco('31/03/2015', 2026), 11, 'aniversário no próprio dia 31/03 já conta');
  assert.equal(calcIdadeEm31Marco('', 2026), 0, 'data vazia retorna 0');
  assert.equal(calcIdadeEm31Marco('data-invalida', 2026), 0, 'data mal formada retorna 0');
  console.log('Teste calcIdadeEm31Marco: OK');

  // ── extrairSerie ──────────────────────────────────────────────────────
  assert.equal(extrairSerie('1º Ano A'), 1);
  assert.equal(extrairSerie('5º Ano C'), 5);
  assert.equal(extrairSerie('1ª ETAPA A'), 1, 'ETAPA também bate no regex — por isso etapaDaTurma precisa filtrar antes');
  assert.equal(extrairSerie('EJA I – ALFABETIZAÇÃO'), null);
  assert.equal(extrairSerie('AEE MANHÃ'), null);
  console.log('Teste extrairSerie: OK');

  // ── etapaDaTurma ──────────────────────────────────────────────────────
  assert.equal(etapaDaTurma('1ª ETAPA A'), 'Infantil');
  assert.equal(etapaDaTurma('2ª ETAPA H'), 'Infantil');
  assert.equal(etapaDaTurma('1º Ano A'), 'Fundamental');
  assert.equal(etapaDaTurma('5º Ano D'), 'Fundamental');
  assert.equal(etapaDaTurma('EJA I – ALFABETIZAÇÃO'), 'EJA');
  assert.equal(etapaDaTurma('AEE MANHÃ'), 'AEE');
  console.log('Teste etapaDaTurma: OK');

  // ── estaPendente ──────────────────────────────────────────────────────
  assert.equal(estaPendente({ faltas: 0, conferido_sem_faltas: false }), true, 'zero sem confirmação = pendente');
  assert.equal(estaPendente({ faltas: 0, conferido_sem_faltas: undefined }), true, 'zero sem campo = pendente');
  assert.equal(estaPendente({ faltas: 0, conferido_sem_faltas: true }), false, 'zero confirmado = não pendente');
  assert.equal(estaPendente({ faltas: 3, conferido_sem_faltas: false }), false, 'com faltas reais nunca é pendente');
  assert.equal(estaPendente({ faltas: null, conferido_sem_faltas: false }), true, 'faltas null tratado como zero');
  console.log('Teste estaPendente: OK');

  // ── contaParaSequenciaReal (NCOM só considera dia-a-dia real) ─────────
  assert.equal(contaParaSequenciaReal({ origem_frequencia: 'DIA_A_DIA' }), true);
  assert.equal(contaParaSequenciaReal({ origem_frequencia: 'LANCAMENTO_RAPIDO' }), false,
    'Lançamento Rápido empilha faltas artificialmente — não pode virar "sequência real"');
  assert.equal(contaParaSequenciaReal({ origem_frequencia: null }), false,
    'registro antigo sem essa marcação também fica de fora, por segurança (falso negativo > falso positivo)');
  assert.equal(contaParaSequenciaReal({}), false);
  console.log('Teste contaParaSequenciaReal: OK');

  console.log('\nTodos os testes do Painel Analítico passaram.');
} finally {
  await rm(bundle, { force: true });
}

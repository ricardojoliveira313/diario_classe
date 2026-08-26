import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(tmpdir(), `educacenso-corte-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [path.join(raiz, 'src/educacensoCorte.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  });

  const { estavaMatriculadoNaData } = await import(`${pathToFileURL(bundle).href}?${Date.now()}`);

  const corte = new Date(2026, 4, 27); // 27/05/2026 — corte padrão do Educacenso

  // ── Caso do usuário: matriculado 10/03, transferido 29/05 (DEPOIS do corte) ──
  // Na data-base ainda era nosso — tem que contar, mesmo que a situação
  // ATUAL (na hora do cruzamento) já seja TRANSFERE-SE.
  assert.equal(estavaMatriculadoNaData({
    situacao: 'TRANSFERE-SE',
    data_inicio_matricula: '10/03/2026',
    data_movimentacao: '29/05/2026',
  }, corte), true, 'transferido DEPOIS do corte ainda era nosso na data-base');

  // ── Caso do usuário (o "contrário"): matriculado 10/03, transferido 10/04
  // (ANTES do corte) — na data-base já não era mais nosso, é da outra escola.
  assert.equal(estavaMatriculadoNaData({
    situacao: 'TRANSFERE-SE',
    data_inicio_matricula: '10/03/2026',
    data_movimentacao: '10/04/2026',
  }, corte), false, 'transferido ANTES do corte já não era nosso na data-base');

  // ── Matriculado DEPOIS do corte, mas ATIVO hoje — não era nosso na data-base ──
  assert.equal(estavaMatriculadoNaData({
    situacao: 'ATIVO',
    data_inicio_matricula: '05/06/2026',
  }, corte), false, 'matrícula começou depois do corte — não conta pro Censo desse ano');

  // ── Matriculado ANTES do corte e ainda ATIVO hoje — conta normalmente ──
  assert.equal(estavaMatriculadoNaData({
    situacao: 'ATIVO',
    data_inicio_matricula: '10/03/2026',
  }, corte), true, 'matriculado antes do corte e continua ativo — conta');

  // ── Transferido EXATAMENTE no dia do corte — ainda conta (era nosso até esse dia) ──
  assert.equal(estavaMatriculadoNaData({
    situacao: 'TRANSFERE-SE',
    data_inicio_matricula: '10/03/2026',
    data_movimentacao: '27/05/2026',
  }, corte), true, 'saída no próprio dia do corte ainda conta como nosso');

  // ── Sem nenhuma data de saída registrada — não dá pra confirmar, trata como não-nosso ──
  assert.equal(estavaMatriculadoNaData({
    situacao: 'TRANSFERE-SE',
    data_inicio_matricula: '10/03/2026',
  }, corte), false, 'saída sem data registrada — conservador, não conta');

  console.log('Todos os testes de estavaMatriculadoNaData (corte do Educacenso) passaram.');
} finally {
  await rm(bundle, { force: true });
}

import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(tmpdir(), `matriculas-mensais-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [path.join(raiz, 'src/matriculasMensais.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  });

  const { calcularMatriculasMensais } = await import(`${pathToFileURL(bundle).href}?${Date.now()}`);
  const turmas = [{ id: 'regular', nome: '2º ano B', tipo: 'REGULAR' }];
  const alunos = [{
    id: 'sem-data-saida',
    ra: 999,
    nome: 'ALUNO TESTE',
    turmaId: 'regular',
    sexo: 'M',
    situacao: 'TRAN',
    data_inicio_matricula: '04/02/2026',
    data_fim_matricula: null,
    data_movimentacao: null,
  }];

  const resumo = calcularMatriculasMensais(alunos, turmas, 2026, 2, 8, new Date(2026, 7, 20));
  assert.equal(resumo.meses[0].matriculados.total, 1, 'deve contar no mês de início');
  assert.equal(resumo.meses[1].matriculados.total, 0, 'não deve permanecer no mês seguinte');
  assert.equal(resumo.meses[6].matriculados.total, 0, 'não deve se estender até o mês atual');
  assert.equal(resumo.totalSaidas.total, 1, 'deve aparecer nas saídas com o fallback conservador');
  assert.equal(resumo.semDataSaida, 1, 'deve ser sinalizado como saída sem data oficial');

  console.log('Teste de matrícula com saída sem data: OK');
} finally {
  await rm(bundle, { force: true });
}

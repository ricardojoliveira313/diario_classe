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

  const { calcularMatriculasAtuais, calcularMatriculasMensais } = await import(`${pathToFileURL(bundle).href}?${Date.now()}`);
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
  assert.equal(resumo.meses[0].matriculados.total, 0,
    'saída sem data não deve ser presumida ativa no fechamento do mês de início');
  assert.equal(resumo.meses[1].matriculados.total, 0, 'não deve permanecer no mês seguinte');
  assert.equal(resumo.meses[6].matriculados.total, 0, 'não deve se estender até o mês atual');
  assert.equal(resumo.totalSaidas.total, 1, 'deve aparecer nas saídas com o fallback conservador');
  assert.equal(resumo.semDataSaida, 1, 'deve ser sinalizado como saída sem data oficial');

  const fotografia = [
    {
      id: 'transferido', ra: 100, nome: 'TRANSFERIDO', turmaId: 'regular', sexo: 'M',
      situacao: 'TRAN', data_inicio_matricula: '04/02/2026', data_fim_matricula: '10/08/2026',
    },
    {
      id: 'rema-origem', ra: 200, nome: 'REMANEJADO', turmaId: 'regular', sexo: 'F',
      situacao: 'REMA', data_inicio_matricula: '04/02/2026', data_fim_matricula: '20/05/2026',
    },
    {
      id: 'ativo-destino', ra: 200, nome: 'REMANEJADO', turmaId: 'regular', sexo: 'F',
      situacao: 'ATIVO', data_inicio_matricula: '20/05/2026', data_fim_matricula: '18/12/2026',
    },
    {
      id: 'rema-sem-destino', ra: 300, nome: 'REMA INCOMPLETO', turmaId: 'regular', sexo: 'M',
      situacao: 'REMA', data_inicio_matricula: '04/02/2026', data_fim_matricula: '20/05/2026',
    },
    {
      id: 'abandono', ra: 400, nome: 'ABANDONO', turmaId: 'regular', sexo: 'F',
      situacao: 'ABAN', data_inicio_matricula: '04/02/2026', data_fim_matricula: '10/06/2026',
    },
    {
      id: 'ncom', ra: 500, nome: 'NÃO COMPARECEU', turmaId: 'regular', sexo: 'M',
      situacao: 'N COM', data_inicio_matricula: '04/02/2026', data_fim_matricula: '10/02/2026',
    },
    {
      id: 'vazio', ra: 600, nome: 'SITUAÇÃO VAZIA', turmaId: 'regular', sexo: 'F',
      situacao: '', data_inicio_matricula: '04/02/2026', data_fim_matricula: '18/12/2026',
    },
    {
      id: 'ativo-sem-inicio', ra: 700, nome: 'ATIVO SEM INÍCIO', turmaId: 'regular', sexo: 'M',
      situacao: 'ATIVO', data_inicio_matricula: null, data_fim_matricula: '18/12/2026',
    },
  ];

  const atual = calcularMatriculasAtuais(fotografia, turmas);
  assert.deepEqual(atual, { masculino: 1, feminino: 2, naoInformado: 0, total: 3 },
    'fotografia atual deve contar ATIVO e situação vazia (mesma regra do Dashboard/Alunos/Faltas), ignorando as situações de saída');

  const setembro = calcularMatriculasMensais(fotografia, turmas, 2026, 9, 9, new Date(2026, 8, 3));
  assert.equal(setembro.totalAtual.total, 3, 'total atual deve ignorar todas as situações de saída');
  assert.equal(setembro.meses[0].matriculados.total, 3,
    'mês corrente deve reproduzir a fotografia ATIVO/vazio, inclusive ativo sem data de início');

  const maio = calcularMatriculasMensais(fotografia, turmas, 2026, 5, 5, new Date(2026, 8, 3));
  assert.equal(maio.totalEntradas.total, 0,
    'ATIVO de destino não pode virar nova entrada quando o mesmo RA tem REMA de origem');
  assert.equal(maio.totalSaidas.total, 0,
    'REMA é movimentação interna e não pode virar saída da escola');

  const trocaComTotalIgual = calcularMatriculasMensais([
    {
      id: 'menino-saiu', ra: 901, nome: 'MENINO SAIU', turmaId: 'regular', sexo: 'M',
      situacao: 'TRAN', data_inicio_matricula: '04/02/2026', data_fim_matricula: '28/08/2026',
    },
    {
      id: 'menina-permaneceu', ra: 902, nome: 'MENINA PERMANECEU', turmaId: 'regular', sexo: 'F',
      situacao: 'ATIVO', data_inicio_matricula: '04/02/2026', data_fim_matricula: '18/12/2026',
    },
    {
      id: 'menina-entrou', ra: 903, nome: 'MENINA ENTROU', turmaId: 'regular', sexo: 'F',
      situacao: 'ATIVO', data_inicio_matricula: '29/08/2026', data_fim_matricula: '18/12/2026',
    },
  ], turmas, 2026, 8, 8, new Date(2026, 8, 31));
  assert.equal(trocaComTotalIgual.totalAtual.total, 2,
    'o total atual pode permanecer igual mesmo com troca na composição');
  assert.deepEqual(trocaComTotalIgual.totalEntradas, { masculino: 0, feminino: 1, naoInformado: 0, total: 1 },
    'a nova coluna deve revelar a entrada de uma menina');
  assert.deepEqual(trocaComTotalIgual.totalSaidas, { masculino: 1, feminino: 0, naoInformado: 0, total: 1 },
    'a nova coluna deve revelar a saída de um menino');

  const transferenciaNoMes = calcularMatriculasMensais([{
    id: 'saiu-no-mes', ra: 800, nome: 'SAIU NO MÊS', turmaId: 'regular', sexo: 'M',
    situacao: 'TRAN', data_inicio_matricula: '04/02/2026', data_fim_matricula: '10/08/2026',
  }], turmas, 2026, 8, 8, new Date(2026, 8, 3));
  assert.equal(transferenciaNoMes.meses[0].matriculados.total, 0,
    'transferido durante agosto não deve permanecer na posição de fechamento de agosto');
  assert.equal(transferenciaNoMes.meses[0].saidas.total, 1,
    'a transferência continua preservada no histórico de saídas');

  console.log('Testes de fotografia atual, remanejamento e histórico mensal: OK');
} finally {
  await rm(bundle, { force: true });
}

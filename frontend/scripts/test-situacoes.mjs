import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(tmpdir(), `situacoes-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [path.join(raiz, 'src/situacoes.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  });

  const { consolidarPorAluno, registroVencedor, SITUACOES_NAO_ATIVAS } =
    await import(`${pathToFileURL(bundle).href}?${Date.now()}`);

  const idsPorNome = new Map();
  let seq = 0;
  function aluno({ nome, ra, situacao, dataInicio, dataMovimentacao, dataFim, bolsaFamilia, turmaId }) {
    seq += 1;
    return {
      id: `id-${seq}`,
      ra,
      nome,
      data_nascimento: '01/01/2016',
      situacao,
      turmaId: turmaId ?? 'turma-1',
      data_inicio_matricula: dataInicio ?? null,
      data_fim_matricula: dataFim ?? null,
      data_movimentacao: dataMovimentacao ?? null,
      bolsa_familia: !!bolsaFamilia,
    };
  }

  // ── Caso Isaac Antony de Souza Nascimento ─────────────────────────────────
  // BXTR em 22/06/2026 seguido de matrícula ATIVO em 06/08/2026 — o registro
  // mais recente (ATIVO) deve prevalecer e ele NÃO pode aparecer como
  // transferido.
  {
    const registros = [
      aluno({ nome: 'ISAAC ANTONY DE SOUZA NASCIMENTO', ra: 122337218, situacao: 'BXTR', dataMovimentacao: '22/06/2026', bolsaFamilia: true }),
      aluno({ nome: 'ISAAC ANTONY DE SOUZA NASCIMENTO', ra: 122337218, situacao: 'ATIVO', dataInicio: '06/08/2026', bolsaFamilia: true }),
    ];
    const [vencedor] = consolidarPorAluno(registros);
    assert.equal(vencedor.situacaoNorm, 'ATIVO', 'Isaac: o registro ATIVO mais recente deve vencer');
    assert.ok(!SITUACOES_NAO_ATIVAS.includes(vencedor.situacaoNorm), 'Isaac: não deve ser classificado como transferido');
    console.log('Teste Isaac Antony (BXTR + ATIVO mais recente): OK');
  }

  // ── Transferido sem nova matrícula ────────────────────────────────────────
  {
    const registros = [
      aluno({ nome: 'ALUNO TRANSFERIDO', ra: 111, situacao: 'TRAN', dataMovimentacao: '10/07/2026' }),
    ];
    const [vencedor] = consolidarPorAluno(registros);
    assert.equal(vencedor.situacaoNorm, 'TRAN');
    assert.equal(vencedor.data.toISOString().slice(0, 10), '2026-07-10');
    console.log('Teste transferido sem nova matrícula: OK');
  }

  // ── Remanejado ────────────────────────────────────────────────────────────
  // REMA na turma de origem + ATIVO na turma de destino no mesmo dia (ou
  // depois) representam a MESMA pessoa — o ATIVO deve vencer.
  {
    const registros = [
      aluno({ nome: 'ALUNO REMANEJADO', ra: 222, situacao: 'REMA', dataMovimentacao: '15/03/2026', turmaId: 'turma-origem' }),
      aluno({ nome: 'ALUNO REMANEJADO', ra: 222, situacao: 'ATIVO', dataInicio: '15/03/2026', turmaId: 'turma-destino' }),
    ];
    const [vencedor] = consolidarPorAluno(registros);
    assert.equal(vencedor.situacaoNorm, 'ATIVO', 'remanejado: ATIVO no destino deve vencer o REMA de origem');
    assert.equal(vencedor.aluno.turmaId, 'turma-destino');
    console.log('Teste remanejado (REMA origem + ATIVO destino no mesmo dia): OK');
  }

  // ── Aluno sem Bolsa Família ──────────────────────────────────────────────
  {
    const registros = [
      aluno({ nome: 'ALUNO SEM BF', ra: 333, situacao: 'BXTR', dataMovimentacao: '05/05/2026', bolsaFamilia: false }),
    ];
    const [vencedor] = consolidarPorAluno(registros);
    assert.equal(vencedor.aluno.bolsa_familia, false);
    console.log('Teste aluno sem Bolsa Família: OK');
  }

  // ── Dois registros com a mesma data (empate) ─────────────────────────────
  // No empate exato, ATIVO deve prevalecer sobre uma situação de saída.
  {
    const registros = [
      aluno({ nome: 'ALUNO EMPATE', ra: 444, situacao: 'BXTR', dataMovimentacao: '01/04/2026' }),
      aluno({ nome: 'ALUNO EMPATE', ra: 444, situacao: 'ATIVO', dataInicio: '01/04/2026' }),
    ];
    const vencedor = registroVencedor(registros);
    assert.equal(vencedor.situacaoNorm, 'ATIVO', 'empate de data: ATIVO deve vencer sobre BXTR');
    console.log('Teste empate de data (ATIVO prevalece): OK');

    // Empate entre duas situações de saída (sem ATIVO envolvido): mantém o
    // primeiro registro do grupo — comportamento determinístico documentado,
    // já que não há timestamp de criação para desempatar com mais precisão.
    const registrosSaida = [
      aluno({ nome: 'ALUNO EMPATE SAIDA', ra: 445, situacao: 'BXTR', dataMovimentacao: '01/04/2026' }),
      aluno({ nome: 'ALUNO EMPATE SAIDA', ra: 445, situacao: 'TRAN', dataMovimentacao: '01/04/2026' }),
    ];
    const vencedorSaida = registroVencedor(registrosSaida);
    assert.equal(vencedorSaida.situacaoNorm, 'BXTR', 'empate entre saídas: mantém o primeiro registro do grupo');
    console.log('Teste empate de data entre duas situações de saída: OK');
  }

  // ── Transferência seguida de nova matrícula em outro mês ─────────────────
  {
    const registros = [
      aluno({ nome: 'ALUNO VOLTOU DEPOIS', ra: 555, situacao: 'TRAN', dataMovimentacao: '10/03/2026' }),
      aluno({ nome: 'ALUNO VOLTOU DEPOIS', ra: 555, situacao: 'ATIVO', dataInicio: '20/06/2026' }),
    ];
    const [vencedor] = consolidarPorAluno(registros);
    assert.equal(vencedor.situacaoNorm, 'ATIVO', 'transferência seguida de matrícula em outro mês: ATIVO mais recente vence');
    console.log('Teste transferência seguida de nova matrícula em outro mês: OK');
  }

  // ── Ordem dos registros no array não deve importar ───────────────────────
  {
    const registros = [
      aluno({ nome: 'ALUNO ORDEM INVERTIDA', ra: 666, situacao: 'ATIVO', dataInicio: '06/08/2026' }),
      aluno({ nome: 'ALUNO ORDEM INVERTIDA', ra: 666, situacao: 'BXTR', dataMovimentacao: '22/06/2026' }),
    ];
    const [vencedor] = consolidarPorAluno(registros);
    assert.equal(vencedor.situacaoNorm, 'ATIVO', 'ordem dos registros na consulta não deve alterar o vencedor');
    console.log('Teste ordem dos registros invertida (mesmo resultado do Isaac): OK');
  }

  console.log('\nTodos os testes de consolidação de Situações passaram.');
} finally {
  await rm(bundle, { force: true });
}

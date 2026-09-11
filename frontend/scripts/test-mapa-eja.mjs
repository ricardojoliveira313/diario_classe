import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(tmpdir(), `mapa-eja-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [path.join(raiz, 'src/mapaEja.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  });
  const { calcularMapaEja, calcularIdade, faixaEtariaDe, ehTurmaEja, cicloEjaDaTurma } = await import(`${pathToFileURL(bundle).href}?${Date.now()}`);

  assert.equal(ehTurmaEja('EJA I – ALFABETIZAÇÃO'), true);
  assert.equal(ehTurmaEja('1ª ETAPA A'), false);
  assert.equal(cicloEjaDaTurma('EJA I – POS-ALFABETIZAÇÃO'), 'POS');
  assert.equal(cicloEjaDaTurma('EJA I – ALFABETIZAÇÃO'), 'ALFA');

  const hoje = new Date(2026, 8, 8); // 08/09/2026
  const idade50 = calcularIdade('10/05/1976', hoje);
  assert.equal(idade50, 50, 'idade calculada deve considerar se já fez aniversário no ano');
  assert.equal(faixaEtariaDe(50), '40 a 59');
  assert.equal(faixaEtariaDe(16), '15 a 17');
  assert.equal(faixaEtariaDe(65), 'acima de 60 anos');
  assert.equal(faixaEtariaDe(null), 'Não informada');

  const turmas = [
    { id: 'alfa', nome: 'EJA I – ALFABETIZAÇÃO', professora: 'Prof A', periodo: 'Noite' },
    { id: 'pos', nome: 'EJA I – POS-ALFABETIZAÇÃO', professora: 'Prof B', periodo: 'Noite' },
    { id: 'infantil', nome: '1ª ETAPA A', professora: 'Prof C', periodo: 'Manhã' },
  ];
  const alunos = [
    { id: '1', ra: 1, nome: 'ATIVO ANTIGO', turmaId: 'alfa', situacao: 'ATIVO', data_nascimento: '10/05/1976', data_inicio_matricula: '04/02/2026', deficiencia: 'AUTISTA INFANTIL' },
    { id: '2', ra: 2, nome: 'MATRICULA NOVA', turmaId: 'alfa', situacao: 'ATIVO', data_nascimento: '01/01/2000', data_inicio_matricula: '05/09/2026' },
    { id: '3', ra: 3, nome: 'EVADIDO', turmaId: 'alfa', situacao: 'ABAN', data_nascimento: '01/01/1990', data_inicio_matricula: '04/02/2026', data_fim_matricula: '10/09/2026' },
    { id: '4', ra: 4, nome: 'TRANSFERIDO', turmaId: 'pos', situacao: 'TRAN', data_nascimento: '01/01/1985', data_inicio_matricula: '04/02/2026', data_fim_matricula: '10/06/2026' },
    { id: '5', ra: 5, nome: 'RECLASSIFICADO', turmaId: 'pos', situacao: 'CLASSIFICADO', data_nascimento: '01/01/1995', data_inicio_matricula: '04/02/2026' },
    { id: '6', ra: 6, nome: 'ALUNO INFANTIL', turmaId: 'infantil', situacao: 'ATIVO', data_nascimento: '01/01/2021', data_inicio_matricula: '04/02/2026' },
  ];

  const resumo = calcularMapaEja(alunos, turmas, 9, 2026, hoje);
  assert.equal(resumo.linhas.length, 2, 'só deve considerar as 2 turmas de EJA, não o Infantil');

  const alfa = resumo.linhas.find(l => l.turmaId === 'alfa');
  assert.equal(alfa.alunosFrequentes, 2, 'ativo antigo + matrícula nova');
  assert.equal(alfa.matriculaNova, 1, 'só quem entrou dentro do mês de setembro conta como matrícula nova');
  assert.equal(alfa.vieramDoMesAnterior, 1);
  assert.equal(alfa.evasao, 1);
  assert.equal(alfa.evadidoMes, 1, 'saída em setembro deve contar no mês');
  assert.equal(alfa.cade, 1, 'CADE deve ser automático a partir do campo deficiencia vindo da SED, sem conferência manual');

  const pos = resumo.linhas.find(l => l.turmaId === 'pos');
  assert.equal(pos.transferencia, 1);
  assert.equal(pos.transferidoMes, 0, 'saída de junho não deve contar no mês de setembro');
  assert.equal(pos.reclassificados, 1, 'situação CLASSIFICADO deve contar como reclassificado');

  const faixa50 = resumo.faixaEtaria.find(f => f.label === '40 a 59');
  assert.equal(faixa50.atendimento, 1, 'aluno ativo de 50 anos deve entrar na faixa 40 a 59');

  // ─── Reconstrução por mês selecionado (não é uma foto fixa de "hoje") ───
  // Cenário real relatado: em Fevereiro a turma tinha 28 matriculados; em
  // Setembro (hoje), 3 já saíram (N COM) e viram só como situação atual —
  // mas ao selecionar Fevereiro no seletor de mês, o Mapa tem que mostrar
  // esses 3 como ainda ativos (a saída só ocorreu depois), e um aluno cuja
  // matrícula começou em Junho não pode aparecer em Fevereiro.
  const alunosHistorico = [
    { id: '10', ra: 10, nome: 'SEMPRE ATIVO', turmaId: 'alfa', situacao: 'ATIVO', data_nascimento: '10/05/1976', data_inicio_matricula: '04/02/2026' },
    { id: '11', ra: 11, nome: 'NUNCA COMPARECEU EM AGOSTO', turmaId: 'alfa', situacao: 'N COM', data_nascimento: '10/05/1980', data_inicio_matricula: '04/02/2026', data_movimentacao: '15/08/2026' },
    { id: '12', ra: 12, nome: 'MATRICULADO SO EM JUNHO', turmaId: 'alfa', situacao: 'ATIVO', data_nascimento: '01/01/1990', data_inicio_matricula: '10/06/2026' },
  ];
  const resumoFevereiro = calcularMapaEja(alunosHistorico, turmas, 2, 2026, hoje);
  const alfaFev = resumoFevereiro.linhas.find(l => l.turmaId === 'alfa');
  assert.equal(alfaFev.matriculaGeral, 2, 'em Fevereiro só existiam 2 matriculados — quem entrou em Junho ainda não contava');
  assert.equal(alfaFev.alunosFrequentes, 2, 'a saída de Agosto ainda não tinha ocorrido em Fevereiro — os dois contam como ativos');
  assert.equal(alfaFev.nuncaCompareceram, 0, 'em Fevereiro o N COM de Agosto ainda não existia');

  const resumoSetembro = calcularMapaEja(alunosHistorico, turmas, 9, 2026, hoje);
  const alfaSet = resumoSetembro.linhas.find(l => l.turmaId === 'alfa');
  assert.equal(alfaSet.matriculaGeral, 3, 'em Setembro os 3 já estavam matriculados em algum momento');
  assert.equal(alfaSet.alunosFrequentes, 2, 'em Setembro o N COM de Agosto já tinha saído');
  assert.equal(alfaSet.nuncaCompareceram, 1, 'em Setembro o N COM de Agosto já conta como eliminado');

  // ─── Ajuste manual fixo (aluno N COM que a SED parou de listar) ───────────
  // Caso real: 3 alunos "nunca compareceram" em agosto (2 na Alfa, 1 na Pós,
  // faixa 40-59) somem dos relatórios seguintes da SED e não têm mais como
  // virar um registro de Aluno de verdade. A escola lança a quantidade fixa
  // direto na turma — precisa somar no Mapa mesmo sem nenhum aluno real.
  const turmasComAjuste = [
    { id: 'alfa', nome: 'EJA I – ALFABETIZAÇÃO', professora: 'Prof A', periodo: 'Noite', ajuste_nunca_compareceram: 2, ajuste_faixa_nunca_compareceram: '40 a 59', ajuste_evasao: 1, ajuste_faixa_evasao: 'acima de 60 anos' },
    { id: 'pos', nome: 'EJA I – POS-ALFABETIZAÇÃO', professora: 'Prof B', periodo: 'Noite', ajuste_nunca_compareceram: 1, ajuste_faixa_nunca_compareceram: '40 a 59' },
  ];
  const alunosSoAtivos = [
    { id: '20', ra: 20, nome: 'ATIVO ALFA', turmaId: 'alfa', situacao: 'ATIVO', data_nascimento: '10/05/1976', data_inicio_matricula: '04/02/2026' },
    { id: '21', ra: 21, nome: 'ATIVO POS', turmaId: 'pos', situacao: 'ATIVO', data_nascimento: '10/05/1976', data_inicio_matricula: '04/02/2026' },
  ];
  const resumoAjuste = calcularMapaEja(alunosSoAtivos, turmasComAjuste, 9, 2026, hoje);
  const alfaAjuste = resumoAjuste.linhas.find(l => l.turmaId === 'alfa');
  const posAjuste = resumoAjuste.linhas.find(l => l.turmaId === 'pos');
  assert.equal(alfaAjuste.nuncaCompareceram, 2, 'ajuste manual soma no Nunca Comp. da Alfa mesmo sem aluno real');
  assert.equal(alfaAjuste.evasao, 1, 'ajuste manual soma na Evasão da Alfa mesmo sem aluno real');
  assert.equal(alfaAjuste.matriculaGeral, 4, 'ajuste manual soma na Matrícula Geral da Alfa (1 ativo + 2 nunca comp + 1 evasão)');
  assert.equal(posAjuste.nuncaCompareceram, 1, 'ajuste manual soma no Nunca Comp. da Pós mesmo sem aluno real');
  assert.equal(alfaAjuste.alunosFrequentes, 1, 'o ajuste não conta como frequente');
  const faixa4059Ajuste = resumoAjuste.faixaEtaria.find(f => f.label === '40 a 59');
  assert.equal(faixa4059Ajuste.nuncaComp, 3, 'os 3 do ajuste (2 Alfa + 1 Pós) somam juntos na faixa etária indicada');
  const faixa60Ajuste = resumoAjuste.faixaEtaria.find(f => f.label === 'acima de 60 anos');
  assert.equal(faixa60Ajuste.evasao, 1, 'o ajuste de evasão soma na faixa etária indicada, separado do ajuste de nunca comp.');

  console.log('Teste do Mapa EJA: OK');
} finally {
  await rm(bundle, { force: true });
}

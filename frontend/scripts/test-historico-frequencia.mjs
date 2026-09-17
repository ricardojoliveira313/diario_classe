import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/Historico.tsx', import.meta.url), 'utf8');

const checks = [
  ['histórico consulta competência e confirmação das faltas', page.includes("select('ano,mes,faltas,frequencia,conferido_sem_faltas')")],
  ['período é analisado mês a mês', page.includes('analisarFrequenciaPeriodo') && page.includes('porCompetencia')],
  ['registro zero não confirmado permanece pendente', page.includes('registro.conferido_sem_faltas === true')],
  ['mês sem lançamento gera pendência explícita', page.includes('mês sem lançamento de frequência para este aluno')],
  ['cada pendência informa seus dias letivos', page.includes('pendencia.diasLetivos')],
  ['zero manual confirma ausência inexistente', page.includes('0 também confirma')],
  ['totais ficam vazios enquanto falta conferência', page.includes("setTransferenciaPresencas('')") && page.includes("setTransferenciaAusencias('')")],
  ['presenças são calculadas só depois do total validado', page.includes('resumo.diasLetivos - ausencias')],
  ['salvar e imprimir são bloqueados com pendência', page.includes('antes de salvar ou imprimir')],
  ['alterar datas invalida cálculo anterior', page.includes('alterarDataTransferencia') && page.includes('setResumoFrequenciaPeriodo(null)')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
if (failed.length) process.exit(1);

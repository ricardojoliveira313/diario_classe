import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/Historico.tsx', import.meta.url), 'utf8');

const checks = [
  ['histórico consulta competência e confirmação das faltas', page.includes("select('ano,mes,faltas,frequencia,conferido_sem_faltas')")],
  ['período é analisado mês a mês', page.includes('analisarFrequenciaPeriodo') && page.includes('porCompetencia')],
  ['somente a competência atual fica pendente', page.includes('competenciaAberta = chave === competenciaAtual')],
  ['mês fechado sem lançamento é calculado com zero ausência', page.includes('mesesFechadosSemLancamento') && page.includes('zero ausência')],
  ['resultado fechado é preenchido antes do complemento', page.includes('resumo.diasLetivosApurados - resumo.ausenciasRegistradas')],
  ['cada pendência informa seus dias letivos', page.includes('pendencia.diasLetivos')],
  ['zero confirma que não houve faltas no mês aberto', page.includes('Não houve faltas (0)')],
  ['lançamento parcial pode ser reaproveitado', page.includes('ausenciasSugeridas') && page.includes('já lançada(s)')],
  ['complemento atualiza o período completo', page.includes('setTransferenciaDiasLetivos(String(resumo.diasLetivos))') && page.includes('resumo.diasLetivos - ausencias')],
  ['salvar rascunho continua permitido e somente impressão exige complemento', /const imprimir = async \(\) => \{[\s\S]{0,700}?pendenciasNaoConferidas[\s\S]{0,700}?antes de imprimir/.test(page)],
  ['alterar datas invalida cálculo anterior', page.includes('alterarDataTransferencia') && page.includes('setResumoFrequenciaPeriodo(null)')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
if (failed.length) process.exit(1);

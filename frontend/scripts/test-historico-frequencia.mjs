import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/Historico.tsx', import.meta.url), 'utf8');

const checks = [
  ['histórico consulta competência e confirmação das faltas', page.includes("select('ano,mes,faltas,frequencia,conferido_sem_faltas')")],
  ['período é analisado mês a mês', page.includes('analisarFrequenciaPeriodo') && page.includes('porCompetencia')],
  ['somente a competência atual fica pendente', page.includes('competenciaAberta = chave === competenciaAtual')],
  ['mês fechado sem lançamento é calculado com zero ausência', page.includes('mesesFechadosSemLancamento') && page.includes('zero ausência')],
  ['resultado completo é preenchido automaticamente', page.includes('setTransferenciaDiasLetivos(String(resumo.diasLetivos))') && page.includes('resumo.diasLetivos - ausencias')],
  ['cada pendência informa seus dias letivos', page.includes('pendencia.diasLetivos')],
  ['zero confirma que não houve faltas no mês aberto', page.includes('Não houve faltas (0)')],
  ['lançamento parcial pode ser reaproveitado', page.includes('ausenciasSugeridas') && page.includes('já lançada(s)')],
  ['complemento atualiza o período completo', page.includes('setTransferenciaDiasLetivos(String(resumo.diasLetivos))') && page.includes('resumo.diasLetivos - ausencias')],
  ['mês aberto assume automaticamente as faltas já lançadas ou zero', page.includes("complementosAutomaticos[pendencia.chave] = String(pendencia.ausenciasSugeridas)")],
  ['impressão não é bloqueada pelo mês aberto', /const imprimir = async \(\) => \{\s*const salvo = await salvarHistorico\(\);\s*if \(salvo\) window\.print\(\);\s*\}/.test(page) && !/const imprimir = async \(\) => \{[\s\S]{0,500}?pendenciasNaoConferidas/.test(page)],
  ['alterar datas invalida cálculo anterior', page.includes('alterarDataTransferencia') && page.includes('setResumoFrequenciaPeriodo(null)')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
if (failed.length) process.exit(1);

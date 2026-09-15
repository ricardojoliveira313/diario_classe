import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/EducacensoDocentes.tsx', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../../supabase/functions/censo-oficial-bridge/index.ts', import.meta.url), 'utf8');

const checks = [
  ['front exige reautenticação', page.includes("action: 'auth'") && page.includes('Senha do Diário')],
  ['token fica em sessionStorage', page.includes('sessionStorage.setItem(TOKEN_KEY') && !page.includes("localStorage.setItem(TOKEN_KEY")],
  ['front exige confirmação humana', page.includes('confirmacaoFinal: true') && page.includes('Declaro que conferi')],
  ['front não depende da extensão', !page.includes('censo-extension') && !page.includes('diario-censo')],
  ['backend restringe origem', edge.includes('origemPermitida') && edge.includes('Origem não autorizada')],
  ['CORS aceita cabeçalhos do cliente Supabase', edge.includes('authorization, x-client-info, apikey, content-type, x-censo-token')],
  ['backend restringe usuário administrativo', /norm\(username\)\s*!==?\s*['"]RICOJOLIVEIRA['"]/.test(edge)],
  ['backend valida RF na frequência', edge.includes('CensoFrequenciaServidor?ano=eq.2026&mes=eq.9')],
  ['backend reconfirma identidade', edge.includes('buscarServidorCenso') && edge.includes('Nome/CPF não correspondem ao RF')],
  ['backend exige confirmação final', /body\.confirmacaoFinal\s*!==\s*true/.test(edge)],
  ['payload usa contrato oficial', edge.includes('modalidades:d.modalidade') && edge.includes('filiacao1:d.nomeMae') && edge.includes(".join(', ')")],
  ['proteção contra envio duplicado', /duplicate\(d\.rf,d\.modalidade\)/.test(edge)],
  ['auditoria de envio', edge.includes('CensoEnvioLog') && edge.includes("'enviado'")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
if (failed.length) process.exit(1);

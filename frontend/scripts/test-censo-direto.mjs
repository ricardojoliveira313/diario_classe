import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/EducacensoDocentes.tsx', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../../supabase/functions/censo-oficial-bridge/index.ts', import.meta.url), 'utf8');
const educacensoEdge = fs.readFileSync(new URL('../../supabase/functions/censo-educacenso-base/index.ts', import.meta.url), 'utf8');

const checks = [
  ['front exige reautenticação', page.includes("action:'auth'") || page.includes("action: 'auth'")],
  ['token fica em sessionStorage', page.includes('sessionStorage.setItem(TOKEN_KEY') && !page.includes('localStorage.setItem(TOKEN_KEY')],
  ['front exige confirmação humana', /confirmacaoFinal\s*:\s*true/.test(page) && page.includes('assumo total responsabilidade pela veracidade dos dados fornecidos')],
  ['front não depende da extensão', !page.includes('censo-extension') && !page.includes('diario-censo')],
  ['backend restringe origem', edge.includes('origemPermitida') && edge.includes('Origem não autorizada')],
  ['CORS aceita cabeçalhos Supabase', edge.includes('authorization, x-client-info, apikey, content-type, x-censo-token')],
  ['preflight 204 sem corpo', edge.includes('new Response(null,{status:204') || edge.includes('new Response(null, { status: 204')],
  ['backend restringe usuário administrativo', /norm\(username\)!==['"]RICOJOLIVEIRA['"]/.test(edge)],
  ['backend valida RF na frequência', edge.includes('CensoFrequenciaServidor?ano=eq.2026&mes=eq.9')],
  ['backend reconfirma identidade', edge.includes('buscarServidorCenso') && edge.includes('Nome/CPF não correspondem ao RF')],
  ['backend exige confirmação final', /body\.confirmacaoFinal!==true/.test(edge)],
  ['listas dinâmicas vêm do formulário oficial', edge.includes("officialCall('obterOpcoesGraduacao')") && edge.includes("officialCall('obterOpcoesInstituicoes')") && edge.includes("officialCall('obterOpcoesPosGraduacao')")],
  ['graduação usa selects encadeados', page.includes('areasGrad(c)') && page.includes('cursosGrad(c)') && page.includes('categoriasInst(c)') && page.includes('instituicoesInst(c)')],
  ['graduação possui ano conclusão', page.includes('Ano Conclusão') && edge.includes('ano:c.ano')],
  ['pós possui ano conclusão', edge.includes("area:p.area||'',ano:p.ano||''")],
  ['ano da pós é aproveitado da ficha cadastral', page.includes('anosPosFicha') && page.includes('preencherAnosPos') && page.includes('[37,43,45]')],
  ['payload de graduação replica contrato oficial', edge.includes("tipo:c.tipo||'',area:c.area||'',curso:c.curso||'',instituicao:c.instituicao||'',ano:c.ano||'',entregue:Boolean(c.entregue)")],
  ['payload não envia UF/categoria dentro do curso', !edge.includes('ufInstituicao:c.ufInstituicao') && !edge.includes('categoriaOrg:c.categoriaOrg')],
  ['texto interno oficial de altas habilidades', page.includes('Altas Habilidades / Superdotação') && edge.includes('Altas Habilidades / Superdotação')],
  ['curso TIC usa value oficial', page.includes('Educação e Tecnologia de Informação e Comunicação (TIC)') && edge.includes('Educação e Tecnologia de Informação e Comunicação (TIC)')],
  ['relações étnico-raciais usa value oficial completo', page.includes('Educação para as relações étnico-raciais e história e cultura afro-brasileira e africana')],
  ['obrigatórios refletem cliente oficial', /if\s*\(!draft\.modalidade\)\s*faltam\.push\('Modalidade'\)/.test(page) && /if\s*\(!draft\.email\)\s*faltam\.push\('E-mail'\)/.test(page) && /if\s*\(!draft\.grauFormacao\)\s*faltam\.push\('Grau de Formação'\)/.test(page)],
  ['proteção contra envio duplicado', /duplicate\(d\.rf,d\.modalidade\)/.test(edge)],
  ['auditoria de envio', edge.includes('CensoEnvioLog') && edge.includes("'enviado'")],
  ['consulta Educacenso usa função protegida separada', page.includes("supabase.functions.invoke('censo-educacenso-base'") && educacensoEdge.includes('validateToken')],
  ['consulta Educacenso restringe origem', educacensoEdge.includes('origemPermitida') && educacensoEdge.includes('Origem não autorizada')],
  ['consulta Educacenso usa snapshot atual por CPF', educacensoEdge.includes('EducacensoProfissionalAtual?cpf=eq.') && educacensoEdge.includes('cpf.length !== 11')],
  ['sexo vem do Educacenso quando válido', /sexoEdu\s*=\s*inOptions\(educacenso\?\.sexo,\s*SEXOS\)/.test(page) && /sexo\s*:\s*sexoEdu/.test(page)],
  ['cor raça vem do Educacenso com mapeamento', page.includes('cor_raca_oficial') && /norm\(['"]Não declarado['"]\)/.test(page) && /return\s*['"]Não declarada['"]/.test(page)],
  ['nacionalidade e grau usam valores oficiais do snapshot', page.includes('nacionalidade_oficial') && page.includes('grau_formacao_oficial')],
  ['pós e cursos 80h usam snapshot recente', page.includes('pos_graduacao_raw') && page.includes('cursos_especificos_raw') && page.includes('parsePosEducacenso') && page.includes('parseCursosEducacenso')],
  ['fonte Educacenso fica visível na conferência', page.includes('Base Educacenso aplicada') && page.includes('referenciaData')],
  ['ficha cadastral alimenta graduação', page.includes('academicoReferencia') && page.includes('formacaoPrincipal') && page.includes('resolveGraduacao') && page.includes('resolveInstituicao')],
  ['ano de conclusão da ficha é aproveitado', page.includes('anosFicha') && page.includes('anoConclusao')],
  ['UF nascimento não é presumida sem fonte', page.includes('UF de nascimento não existe na relação atual do Educacenso nem na ficha cadastrada')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
if (failed.length) process.exit(1);

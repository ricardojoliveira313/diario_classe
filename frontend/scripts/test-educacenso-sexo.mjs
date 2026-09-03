import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import XLSX from 'xlsx';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(tmpdir(), `educacenso-${process.pid}.mjs`);
const bundleCruzamento = path.join(tmpdir(), `cruzamento-educacenso-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [path.join(raiz, 'src/educacenso.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  });
  const { extrairLinhasEducacenso } = await import(`${pathToFileURL(bundle).href}?${Date.now()}`);

  const linhas = extrairLinhasEducacenso([
    [],
    ['', 'Ordem', 'Identificação única', 'Nome', 'Data de nascimento', 'CPF', 'Nacionalidade', 'Cor/Raça', 'Sexo'],
    ['', 1, 'ID-1', 'ALUNO TESTE', '01/02/2017', '123.456.789-01', 'Brasileira', 'Parda', 'Masculino'],
    ['', 2, 'ID-2', 'ALUNA TESTE', '02/03/2017', '109.876.543-21', 'Brasileira', 'Branca', 'Feminino'],
  ]);
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0].sexo, 'M');
  assert.equal(linhas[1].sexo, 'F');
  assert.equal(linhas[0].cpf, '12345678901');

  await build({
    entryPoints: [path.join(raiz, 'src/cruzamentoEducacenso.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundleCruzamento,
  });
  const { cruzarSEDComEducacenso } = await import(`${pathToFileURL(bundleCruzamento).href}?${Date.now()}`);
  const cruzamento = cruzarSEDComEducacenso([
    { id: 'a1', ra: 1, nome: 'ALUNO TESTE', data_nascimento: '01/02/2017', cpf: '12345678901', turmaId: 't1', situacao: 'ATIVO' },
    { id: 'a2', ra: 2, nome: 'ALUNA TESTE', data_nascimento: '02/03/2017', cpf: '', turmaId: 't1', situacao: 'ATIVO' },
    { id: 'a3', ra: 3, nome: 'SOMENTE SED', data_nascimento: '03/04/2017', cpf: '', turmaId: 't1', situacao: 'ATIVO' },
    { id: 'a4', ra: 4, nome: 'TRANSFERIDO', data_nascimento: '04/05/2017', cpf: '', turmaId: 't1', situacao: 'TRAN' },
    { id: 'a5', ra: 5, nome: 'SITUACAO VAZIA', data_nascimento: '05/06/2017', cpf: '', turmaId: 't1', situacao: '' },
    { id: 'a6', ra: 6, nome: 'REMANEJADO', data_nascimento: '06/07/2017', cpf: '', turmaId: 't1', situacao: 'REMA' },
    { id: 'a7', ra: 6, nome: 'REMANEJADO', data_nascimento: '06/07/2017', cpf: '', turmaId: 't1', situacao: 'ATIVO' },
  ], [{ id: 't1', nome: '2º ANO B', tipo: 'REGULAR' }], linhas);
  assert.equal(cruzamento.encontrados.length, 2, 'deve cruzar primeiro por CPF e depois por nome+nascimento');
  assert.equal(cruzamento.masculino, 1);
  assert.equal(cruzamento.feminino, 1);
  assert.equal(cruzamento.somenteSED.length, 3);
  assert.equal(cruzamento.totalSED, 5,
    'deve contar ATIVO e situação vazia (mesma regra do Dashboard/Alunos/Faltas): transferido e REMA ficam fora; destino ATIVO entra uma vez');

  if (process.argv[2]) {
    const wb = XLSX.readFile(process.argv[2], { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const oficiais = extrairLinhasEducacenso(rows);
    assert.ok(oficiais.length > 0, 'o relatório real deve conter registros');
    assert.equal(oficiais.filter(a => !a.sexo).length, 0, 'o relatório real não deve deixar sexo vazio');
    console.log(`Relatório real validado: ${oficiais.length} registros com sexo oficial.`);
  }

  console.log('Teste do parser Educacenso por sexo: OK');
} finally {
  await rm(bundle, { force: true });
  await rm(bundleCruzamento, { force: true });
}

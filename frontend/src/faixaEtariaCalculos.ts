// ─── Cálculo da janela de nascimento por faixa etária ───────────────────────
// Regra oficial da Secretaria de Educação (data de corte 31/03): uma criança
// que vai completar X anos até 31/03 do ano letivo Y nasceu entre 01/04 do
// ano (Y-X-1) e 31/03 do ano (Y-X). Fórmula validada linha a linha contra a
// tabela oficial do Anexo 01 (Resumo_Inscricoes_DivisaoDemanda_2027) para
// idades de 2 a 10 anos — ver scripts/test-faixa-etaria.mjs.

export type EtapaFaixaEtaria = {
  etapa: string;
  idade: number; // idade completa em 31/03 do ano letivo
  grupo: 'Infantil' | 'Fundamental';
  nascidoDe: string; // dd/mm/aaaa
  nascidoAte: string; // dd/mm/aaaa
};

function formatarData(dia: number, mes: number, ano: number): string {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

// Janela de nascimento para quem completa `idade` anos até 31/03 do `anoLetivo`.
export function calcJanelaNascimento(anoLetivo: number, idade: number): { nascidoDe: string; nascidoAte: string } {
  return {
    nascidoDe: formatarData(1, 4, anoLetivo - idade - 1),
    nascidoAte: formatarData(31, 3, anoLetivo - idade),
  };
}

const ETAPAS_INFANTIL: { etapa: string; idade: number }[] = [
  { etapa: '1º Ciclo Inicial (Maternal I)', idade: 2 },
  { etapa: '1º Ciclo Final (Maternal II)', idade: 3 },
  { etapa: '2º Ciclo Inicial — 1ª Etapa (Pré-escola)', idade: 4 },
  { etapa: '2º Ciclo Final — 2ª Etapa (Pré-escola)', idade: 5 },
];

const ETAPAS_FUNDAMENTAL: { etapa: string; idade: number }[] = [
  { etapa: '1º Ano', idade: 6 },
  { etapa: '2º Ano', idade: 7 },
  { etapa: '3º Ano', idade: 8 },
  { etapa: '4º Ano', idade: 9 },
  { etapa: '5º Ano', idade: 10 },
];

// Berçário I e II (Creche) não segue a data de corte de 31/03 — a matrícula é
// contínua ao longo do ano para crianças de 0 a 2 anos (não é etapa
// obrigatória via SED), por isso a janela é aberta ("a partir de"), diferente
// das demais etapas que fecham em 31/03.
export function calcTabelaFaixaEtaria(anoLetivo: number): EtapaFaixaEtaria[] {
  const creche: EtapaFaixaEtaria = {
    etapa: 'Berçário I e II (Creche)',
    idade: 0,
    grupo: 'Infantil',
    nascidoDe: formatarData(1, 4, anoLetivo - 2),
    nascidoAte: `${anoLetivo}`,
  };
  const infantil = ETAPAS_INFANTIL.map(({ etapa, idade }) => ({
    etapa,
    idade,
    grupo: 'Infantil' as const,
    ...calcJanelaNascimento(anoLetivo, idade),
  }));
  const fundamental = ETAPAS_FUNDAMENTAL.map(({ etapa, idade }) => ({
    etapa,
    idade,
    grupo: 'Fundamental' as const,
    ...calcJanelaNascimento(anoLetivo, idade),
  }));
  return [creche, ...infantil, ...fundamental];
}

// Dada uma data de nascimento (dd/mm/aaaa), identifica em qual etapa a
// criança se encaixaria no ano letivo informado — usado para simulação
// individual ("essa criança pode entrar em que ano?").
export function etapaParaNascimento(dataNasc: string, anoLetivo: number): EtapaFaixaEtaria | null {
  const partes = dataNasc.split('/');
  if (partes.length !== 3) return null;
  const nasc = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
  if (isNaN(nasc.getTime())) return null;
  const tabela = calcTabelaFaixaEtaria(anoLetivo).filter(e => e.idade > 0); // ignora Creche (janela aberta)
  for (const linha of tabela) {
    const [dIni, mIni, aIni] = linha.nascidoDe.split('/').map(Number);
    const [dFim, mFim, aFim] = linha.nascidoAte.split('/').map(Number);
    const ini = new Date(aIni, mIni - 1, dIni);
    const fim = new Date(aFim, mFim - 1, dFim);
    if (nasc >= ini && nasc <= fim) return linha;
  }
  return null;
}

export type ResultadoClassificacao =
  | { tipo: 'etapa'; etapa: EtapaFaixaEtaria }
  | { tipo: 'creche' }
  | { tipo: 'fundamental_alem'; serie: number } // 6º a 9º Ano — além do 5º Ano atendido por esta escola
  | { tipo: 'concluido' } // já teria concluído o Ensino Fundamental (09 anos) regular
  | { tipo: 'invalido' };

// Idade completa em 31/03 do ano letivo — mesma regra de corte usada na tabela.
function calcIdadeEm31Marco(nasc: Date, anoLetivo: number): number {
  const ref = new Date(anoLetivo, 2, 31);
  let idade = ref.getFullYear() - nasc.getFullYear();
  const m = ref.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nasc.getDate())) idade--;
  return idade;
}

// Classificação completa: cobre a tabela (Creche ao 5º Ano) e também informa,
// fora da janela atendida por esta escola, se a criança já estaria cursando
// um ano mais avançado do Fundamental (6º a 9º) ou já teria concluído — em
// vez de só dizer "fora da faixa calculada", como fazia a versão anterior.
export function classificarNascimento(dataNasc: string, anoLetivo: number): ResultadoClassificacao {
  const partes = dataNasc.split('/');
  if (partes.length !== 3) return { tipo: 'invalido' };
  const nasc = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
  if (isNaN(nasc.getTime())) return { tipo: 'invalido' };

  const etapa = etapaParaNascimento(dataNasc, anoLetivo);
  if (etapa) return { tipo: 'etapa', etapa };

  const idade = calcIdadeEm31Marco(nasc, anoLetivo);
  if (idade < 2) return { tipo: 'creche' };
  const serie = idade - 5; // 1º Ano = idade 6 → série 1
  if (serie > 5 && serie <= 9) return { tipo: 'fundamental_alem', serie };
  if (serie > 9) return { tipo: 'concluido' };
  return { tipo: 'invalido' };
}

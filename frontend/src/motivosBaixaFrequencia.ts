// Catálogo oficial de motivos de baixa frequência (Programa Bolsa Família / MEC, 2026).
// Usado para justificar F/J/A no lançamento de faltas — cada código vem do documento
// "Motivos de baixa frequência, situações coletivas e outros".
export interface MotivoBF {
  codigo: string;
  descricao: string;
}

export interface CategoriaMotivoBF {
  categoria: string;
  itens: MotivoBF[];
}

export const MOTIVOS_BAIXA_FREQUENCIA: CategoriaMotivoBF[] = [
  {
    categoria: 'Atenção à saúde do estudante',
    itens: [
      { codigo: '1a', descricao: 'Doença/problemas físicos que impeçam a frequência escolar no curto ou médio prazo' },
      { codigo: '1b', descricao: 'Consultas/exames médicos/tratamento odontológico' },
      { codigo: '1c', descricao: 'Saúde Menstrual' },
      { codigo: '1d', descricao: 'Gravidez na adolescência/pós-parto' },
      { codigo: '1e', descricao: 'Condições de Saúde Mental/sofrimento psíquico do estudante' },
    ],
  },
  {
    categoria: 'Atenção à saúde na família do estudante',
    itens: [
      { codigo: '2a', descricao: 'Doença/problemas físicos de pessoa da família' },
      { codigo: '2b', descricao: 'Condições de Saúde Mental/sofrimento psíquico de pessoa da família' },
      { codigo: '2c', descricao: 'Óbito de pessoa da família' },
    ],
  },
  {
    categoria: 'Fatos que impedem o deslocamento/acesso do estudante à escola',
    itens: [
      { codigo: '3a', descricao: 'Desastres naturais (enchentes, tempestades, secas etc.)' },
      { codigo: '3b', descricao: 'Falta de transporte' },
      { codigo: '3c', descricao: 'Estradas intransitáveis' },
      { codigo: '3d', descricao: 'Violência na área onde mora/no trajeto para a escola' },
      { codigo: '3e', descricao: 'Grande distância entre a residência e a escola' },
    ],
  },
  {
    categoria: 'Aplicação de medida disciplinar pedagógica',
    itens: [
      { codigo: '4a', descricao: 'Aplicação de medida disciplinar fora da escola' },
    ],
  },
  {
    categoria: 'Participação em atividade(s) fora do ambiente escolar',
    itens: [
      { codigo: '5a', descricao: 'A atividade realizada não está prevista no projeto pedagógico e/ou no calendário escolar' },
    ],
  },
  {
    categoria: 'Preconceito/Discriminação/Bullying no ambiente escolar',
    itens: [
      { codigo: '6a', descricao: 'Preconceito/Discriminação/Bullying ou outro tipo de violência ocorrida no ambiente escolar' },
    ],
  },
  {
    categoria: 'Ausência às aulas por respeito a questões sociais, culturais, étnicas e/ou religiosas',
    itens: [
      { codigo: '7a', descricao: 'Indígenas' },
      { codigo: '7b', descricao: 'Quilombolas' },
      { codigo: '7c', descricao: 'Circenses' },
      { codigo: '7d', descricao: 'Ciganos' },
      { codigo: '7e', descricao: 'Questões religiosas' },
      { codigo: '7f', descricao: 'Outras questões sociais, culturais ou étnicas' },
    ],
  },
  {
    categoria: 'Beneficiário se encontra em situação de rua',
    itens: [
      { codigo: '8a', descricao: 'Beneficiário se encontra em situação de rua' },
    ],
  },
  {
    categoria: 'Trabalho infantil',
    itens: [
      { codigo: '9a', descricao: 'A escola sabe que o estudante conta com atenção da rede de proteção local' },
      { codigo: '9b', descricao: 'A escola não sabe se o estudante conta com atenção da rede de proteção local' },
    ],
  },
  {
    categoria: 'Adolescente em regime de trabalho (em descumprimento com o Estatuto da Criança e Adolescente)',
    itens: [
      { codigo: '10a', descricao: 'Adolescente em Regime de Trabalho (em descumprimento com o Estatuto da Criança e Adolescente)' },
    ],
  },
  {
    categoria: 'Exploração e abuso sexual de criança e adolescente',
    itens: [
      { codigo: '11a', descricao: 'Exploração sexual de criança e adolescente' },
      { codigo: '11b', descricao: 'Abuso sexual de criança e adolescente' },
    ],
  },
  {
    categoria: 'Envolvimento com drogas',
    itens: [
      { codigo: '12a', descricao: 'Envolvimento com drogas' },
    ],
  },
  {
    categoria: 'Desmotivação pelos estudos',
    itens: [
      { codigo: '13a', descricao: 'Desmotivação pelos estudos' },
    ],
  },
  {
    categoria: 'Evasão escolar',
    itens: [
      { codigo: '14a', descricao: 'Evasão escolar' },
    ],
  },
  {
    categoria: 'Questões socioeconômicas, educacionais e/ou familiares',
    itens: [
      { codigo: '15a', descricao: 'Necessidade de cuidar de familiares (idoso, criança, pessoa com deficiência)' },
      { codigo: '15b', descricao: 'Viagem com a família para trabalho (trabalho sazonal/agricultura temporária/colheita/outros)' },
      { codigo: '15c', descricao: 'Casamento do(a) estudante' },
      { codigo: '15d', descricao: 'Falta de uniforme/calçado/material escolar essencial' },
      { codigo: '15e', descricao: 'Conflitos familiares' },
      { codigo: '15f', descricao: 'Violência intrafamiliar' },
      { codigo: '15g', descricao: 'Violência contra a mulher' },
      { codigo: '15h', descricao: 'Violência de gênero' },
      { codigo: '15i', descricao: 'Inexistência de pessoa para levar à escola' },
    ],
  },
  {
    categoria: 'Envolvimento em atos infracionais',
    itens: [
      { codigo: '16a', descricao: 'Envolvimento em atos infracionais' },
    ],
  },
  {
    categoria: 'Situações coletivas que impedem a escola de receber o estudante',
    itens: [
      { codigo: '17a', descricao: 'Greve' },
      { codigo: '17b', descricao: 'Calamidade pública que atingiu a escola e/ou exigiu o uso do seu espaço' },
      { codigo: '17c', descricao: 'Escola sem professor' },
      { codigo: '17d', descricao: 'Reforma geral da escola' },
      { codigo: '17e', descricao: 'Escola fechada por situações diversas' },
      { codigo: '17f', descricao: 'Falta de merenda escolar' },
      { codigo: '17g', descricao: 'Férias' },
    ],
  },
  {
    categoria: 'Situações de Cadastro',
    itens: [
      { codigo: '18a', descricao: 'Estudante concluiu o ensino médio' },
      { codigo: '18b', descricao: 'Óbito do estudante' },
    ],
  },
  {
    categoria: 'Problemas com inclusão educacional',
    itens: [
      { codigo: '19a', descricao: 'Inexistência de condições de acesso, permanência, aprendizagem ou participação no ambiente escolar para o beneficiário com deficiência, transtorno do espectro autista, altas habilidades ou superdotação' },
    ],
  },
  {
    categoria: 'Não foi identificado o motivo que corresponda à justificativa da infrequência escolar',
    itens: [
      { codigo: '20a', descricao: 'Não foi identificado motivo que corresponda à justificativa da infrequência escolar' },
    ],
  },
];

// Mapa "código → descrição" para exibição rápida (ex.: tooltip, relatórios, exportações).
export const MOTIVO_BF_POR_CODIGO: Record<string, string> = Object.fromEntries(
  MOTIVOS_BAIXA_FREQUENCIA.flatMap(cat => cat.itens.map(i => [i.codigo, i.descricao])),
);

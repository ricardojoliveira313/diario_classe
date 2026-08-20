// ─── Sugestão de sexo pelo primeiro nome ────────────────────────────────────
// Usado SOMENTE para pré-marcar sugestões na tela de conferência em lote —
// nunca grava nada no banco sozinho. A confirmação final é sempre de um
// administrador, clicando em "Menino"/"Menina" (individual ou em lote), com
// o dado ficando registrado como conferência humana, não como inferência
// automática. Nomes fora desta lista voltam null e exigem conferência manual
// sem sugestão nenhuma — evita "adivinhar" nomes raros ou ambíguos.

const MASCULINOS = [
  'ALAN','ALEX','ALEXANDRE','ALEXSANDRO','ALVINO','ANTHONY','ANTONIO','ARTHUR','AUGUSTO','BENJAMIN','BENJAMYN',
  'BERNARDO','BRAYAN','BRENNO','BRENO','BRUNO','BRYAN','CAIO','CARLOS','CAUA','CAUÃ','CESAR','CICERO',
  'DANIEL','DAVI','DAVID','DIEGO','DOUGLAS','EDUARDO','ELIAS','ENRICO','ENZO','ERICK','ESAU','EZEQUIEL',
  'FELIPE','FERNANDO','FRANCISCO','GABRIEL','GAEL','GUILHERME','GUSTAVO','HEITOR','HENRIQUE','HUGO',
  'IAGO','IAN','IGOR','ISAAC','ISAQUE','JOAO','JOÃO','JOAQUIM','JORGE','JOSE','JOSÉ','JOSHUA','JOSMAR','JUAN',
  'KAIKY','KAUA','KAUÃ','KAUAN','KAUE','KAUÊ','LAURO','LEANDRO','LEONARDO','LEVI','LORENZO','LUAN',
  'LUCA','LUCAS','LUCCA','LUIGI','LUIS','LUIZ','MANOEL','MARCELO','MARCOS','MATEUS','MATHEUS','MATHIAS',
  'MATTEO','MAURICIO','MAYCON','MICAEL','MIGUEL','MURILO','MURILLO','NATAN','NATHAN','NICOLAS','NOAH',
  'OLIVER','OTAVIO','OTÁVIO','PABLO','PATRICK','PAULO','PEDRO','PIETRO','RAFAEL','RAMON','RAUL','RAY',
  'REINALDO','RENAN','RICARDO','ROBERTO','RODRIGO','RYAN','SAMUEL','SANTIAGO','SERGIO','TALES','THALES',
  'THEO','THÉO','THIAGO','THOMAS','THOMAZ','TIAGO','VALENTIM','VALENTIN','VICTOR','VINICIUS','VINÍCIUS',
  'VITOR','VÍTOR','WESLEY','WILLIAN','YAGO','YURI',
];

const FEMININOS = [
  'AGATHA','AGATA','ALANIS','ALICE','ALICIA','ALINE','ALLANA','ALLANIS','AMANDA','ANA','ANTONELLA',
  'ANTONELA','APARECIDA','BEATRIZ','BELLA','BIANCA','BRENDA','CAROLINA','CAROLINE','CATARINA','CECILIA',
  'CECÍLIA','CICERA','CLARA','DANIELA','DANIELLE','DAYANE','DEBORA','DÉBORA','DEONISIA','DIANA','EDUARDA',
  'ELIANE','ELISA','ELOAH','ELOA','EMANUELLY','EMANUELE','EMILY','ESTER','ESTHER','EVELYN','FERNANDA',
  'FRANCISCA','GABRIELA','GABRIELLY','GERACINA','GIOVANNA','GIULIA','HELENA','HELOISA','HELOÍSA','ISABEL',
  'ISABELA','ISABELLA','ISADORA','IVONE','JULIA','JÚLIA','JULIANA','KAROLINA','LANNA','LARA','LARISSA','LAURA',
  'LAVINIA','LAVÍNIA','LETICIA','LETÍCIA','LIVIA','LÍVIA','LIZ','LORENA','LUANA','LUCIA','LÚCIA',
  'LUIZA','LUÍZA','MANOELA','MANUELA','MARCIA','MÁRCIA','MARIA','MARIANA','MARINA','MARLENE','MEL',
  'MELISSA','MIRELLA','MIRELA','NATALIA','NATÁLIA','NICOLE','OLIVIA','OLÍVIA','PATRICIA','PATRÍCIA',
  'PIETRA','RAFAELA','REBECA','REBECCA','ROSA','SABRINA','SARA','SOFIA','SOPHIA','STELLA','STEPHANY',
  'TAINA','TAINÁ','TAIS','TAÍS','TAMIRES','TEREZA','THAIS','THAÍS','VALDENORA','VALENTINA','VITORIA',
  'VITÓRIA','VIVIAN','YASMIM','YASMIN','YOHANNA',
];

let cacheDicionario: Map<string, 'M' | 'F'> | null = null;

function dicionario(): Map<string, 'M' | 'F'> {
  if (cacheDicionario) return cacheDicionario;
  const mapa = new Map<string, 'M' | 'F'>();
  for (const nome of MASCULINOS) mapa.set(nome, 'M');
  for (const nome of FEMININOS) mapa.set(nome, 'F');
  cacheDicionario = mapa;
  return mapa;
}

function primeiroNomeNormalizado(nomeCompleto: string): string {
  const primeiro = String(nomeCompleto ?? '').trim().split(/\s+/)[0] ?? '';
  return primeiro
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Sugere o sexo pelo primeiro nome, usando uma lista curada de nomes
 * brasileiros comuns. Retorna null quando o nome não está na lista — nesse
 * caso a interface NÃO deve mostrar nenhuma sugestão, só o nome pra
 * conferência manual sem viés.
 */
export function sugerirSexoPeloNome(nomeCompleto: string): 'M' | 'F' | null {
  const chave = primeiroNomeNormalizado(nomeCompleto);
  if (!chave) return null;
  return dicionario().get(chave) ?? null;
}

// Script: vincula professoras às turmas via Supabase REST API
const SUPABASE_URL = 'https://hxmwpleyhagwcukuhzxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

// Dados da planilha TURMA-PROFESSORES-PERÍODO.xlsx
const planilha = [
  { sala: 1,  turma: '1ª ETAPA A', professora: 'MARIA LUCIA',      periodo: 'Manhã' },
  { sala: 2,  turma: '1ª ETAPA B', professora: 'DENISE',           periodo: 'Manhã' },
  { sala: 3,  turma: '1ª ETAPA C', professora: 'FERNANDA',         periodo: 'Manhã' },
  { sala: 5,  turma: '1ª ETAPA D', professora: 'CELINA',           periodo: 'Manhã' },
  { sala: 1,  turma: '1ª ETAPA E', professora: 'DEBORA',           periodo: 'Tarde' },
  { sala: 2,  turma: '1ª ETAPA F', professora: 'ANDRESSA',         periodo: 'Tarde' },
  { sala: 3,  turma: '1ª ETAPA G', professora: 'ROSANGELA',        periodo: 'Tarde' },
  { sala: 5,  turma: '1ª ETAPA H', professora: 'ADRIANA ZENOIDES', periodo: 'Tarde' },

  { sala: 6,  turma: '2ª ETAPA A', professora: 'LILIANE',          periodo: 'Manhã' },
  { sala: 8,  turma: '2ª ETAPA B', professora: 'SILVANA',          periodo: 'Manhã' },
  { sala: 9,  turma: '2ª ETAPA C', professora: 'MICHELE',          periodo: 'Manhã' },
  { sala: 10, turma: '2ª ETAPA D', professora: 'SOLANGE',          periodo: 'Manhã' },
  { sala: 6,  turma: '2ª ETAPA E', professora: 'SABRINA',          periodo: 'Tarde' },
  { sala: 8,  turma: '2ª ETAPA F', professora: 'ANGELITA',         periodo: 'Tarde' },
  { sala: 9,  turma: '2ª ETAPA G', professora: 'KAMILA',           periodo: 'Tarde' },
  { sala: 10, turma: '2ª ETAPA H', professora: 'DANIELLE',         periodo: 'Tarde' },

  { sala: 11, turma: '1º ano A',   professora: 'ROSELI PEREIRA',   periodo: 'Manhã' },
  { sala: 25, turma: '1º ano B',   professora: 'BRUNA',            periodo: 'Manhã' },
  { sala: 11, turma: '1º ano C',   professora: 'LUCIANY',          periodo: 'Tarde' },
  { sala: 24, turma: '1º ano D',   professora: 'SILENE',           periodo: 'Tarde' },
  { sala: 25, turma: '1º ano E',   professora: 'BIANCA',           periodo: 'Tarde' },

  { sala: 20, turma: '2º ano A',   professora: 'IONE',             periodo: 'Manhã' },
  { sala: 21, turma: '2º ano B',   professora: 'SANDRA',           periodo: 'Manhã' },
  { sala: 24, turma: '2º ano C',   professora: 'GILMARA',          periodo: 'Manhã' },
  { sala: 20, turma: '2º ano D',   professora: 'PAULA',            periodo: 'Tarde' },
  { sala: 21, turma: '2º ano E',   professora: 'MARTA',            periodo: 'Tarde' },

  { sala: 22, turma: '3º ano A',   professora: 'MAGNUS',           periodo: 'Manhã' },
  { sala: 23, turma: '3º ano B',   professora: 'THABATA',          periodo: 'Manhã' },
  { sala: 22, turma: '3º ano C',   professora: 'CÁTIA',            periodo: 'Tarde' },
  { sala: 23, turma: '3º ano D',   professora: 'ADRIANA CAETANO',  periodo: 'Tarde' },

  { sala: 15, turma: '4º ano A',   professora: 'JULIANA',          periodo: 'Manhã' },
  { sala: 19, turma: '4º ano B',   professora: 'CAMILA P',         periodo: 'Manhã' },
  { sala: 15, turma: '4º ano C',   professora: 'CIDA DRIGO',       periodo: 'Tarde' },
  { sala: 19, turma: '4º ano D',   professora: 'KARINE',           periodo: 'Tarde' },

  { sala: 13, turma: '5º ano A',   professora: 'ROSELI ZAMANA',    periodo: 'Manhã' },
  { sala: 14, turma: '5º ano B',   professora: 'JESSICA',          periodo: 'Manhã' },
  { sala: 13, turma: '5º ano C',   professora: 'ALESSANDRA',       periodo: 'Tarde' },
  { sala: 14, turma: '5º ano D',   professora: 'RAQUEL',           periodo: 'Tarde' },

  // EJA — duas entradas com mesmo nome "EJA I": usamos sala para diferenciar
  { sala: 14, turma: 'EJA I',      professora: 'MARIA DOS ANJOS',  periodo: 'Noturno' },
  { sala: 15, turma: 'EJA II',     professora: 'FRANCISCO',        periodo: 'Noturno' },
  // ⚠️ A planilha tinha duas linhas "EJA I" — assumi que a segunda é EJA II.
  //    Confirme se o nome correto é EJA II ou outro.
];

// Normaliza para comparação (sem acento, sem ordinal, maiúsculas, espaço simples)
const norm = s => (s ?? '')
  .toUpperCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[ªº°]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

async function main() {
  console.log('📡 Buscando turmas no banco...\n');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/Turma?select=id,nome,professora,periodo&order=nome`, {
    headers: HEADERS,
  });

  if (!res.ok) {
    console.error('❌ Erro ao buscar turmas:', res.status, await res.text());
    process.exit(1);
  }

  const turmas = await res.json();
  console.log(`📋 ${turmas.length} turmas encontradas no sistema.\n`);

  let ok = 0, naoencontrou = 0, erros = 0;
  const naoEncontradas = [];

  for (const item of planilha) {
    const match = turmas.find(t => norm(t.nome) === norm(item.turma));

    if (!match) {
      console.log(`❌ NÃO ENCONTROU: "${item.turma}" (Sala ${item.sala})`);
      naoEncontradas.push(item);
      naoencontrou++;
      continue;
    }

    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/Turma?id=eq.${match.id}`,
      {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ professora: item.professora, periodo: item.periodo }),
      }
    );

    if (patchRes.ok || patchRes.status === 204) {
      console.log(`✅ ${item.turma.padEnd(16)} → Prof. ${item.professora.padEnd(20)} (${item.periodo})`);
      ok++;
    } else {
      console.log(`⚠️  ERRO ao atualizar "${item.turma}": ${patchRes.status}`);
      erros++;
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log(`  ✅ Vinculadas com sucesso : ${ok}`);
  console.log(`  ❌ Turmas não encontradas : ${naoencontrou}`);
  console.log(`  ⚠️  Erros de API          : ${erros}`);
  console.log('═══════════════════════════════════════════');

  if (naoEncontradas.length > 0) {
    console.log('\n📌 Turmas NÃO encontradas (verifique o nome no sistema):');
    naoEncontradas.forEach(t => console.log(`   Sala ${t.sala}: "${t.turma}"`));
    console.log('\n   Dica: veja como estão cadastradas em Turmas e ajuste o nome.');
  }
}

main().catch(console.error);

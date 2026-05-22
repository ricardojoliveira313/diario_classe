// Cria todas as 38 turmas já com professora e período vinculados
const SUPABASE_URL = 'https://hxmwpleyhagwcukuhzxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ';
const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

// EMEIEF LUIZ GONZAGA — Turmas + Professoras + Período
// ⚠️  A planilha tinha dois "EJA I" (salas 14 e 15).
//     Assumi: sala 14 = EJA I (Maria dos Anjos), sala 15 = EJA II (Francisco).
//     Corrija abaixo se necessário.
const turmas = [
  // === EDUCAÇÃO INFANTIL — 1ª ETAPA ===
  { nome: '1ª ETAPA A', etapa: 'EI', periodo: 'Manhã',   professora: 'MARIA LUCIA',      sala: 1  },
  { nome: '1ª ETAPA B', etapa: 'EI', periodo: 'Manhã',   professora: 'DENISE',            sala: 2  },
  { nome: '1ª ETAPA C', etapa: 'EI', periodo: 'Manhã',   professora: 'FERNANDA',          sala: 3  },
  { nome: '1ª ETAPA D', etapa: 'EI', periodo: 'Manhã',   professora: 'CELINA',            sala: 5  },
  { nome: '1ª ETAPA E', etapa: 'EI', periodo: 'Tarde',   professora: 'DEBORA',            sala: 1  },
  { nome: '1ª ETAPA F', etapa: 'EI', periodo: 'Tarde',   professora: 'ANDRESSA',          sala: 2  },
  { nome: '1ª ETAPA G', etapa: 'EI', periodo: 'Tarde',   professora: 'ROSANGELA',         sala: 3  },
  { nome: '1ª ETAPA H', etapa: 'EI', periodo: 'Tarde',   professora: 'ADRIANA ZENOIDES',  sala: 5  },

  // === EDUCAÇÃO INFANTIL — 2ª ETAPA ===
  { nome: '2ª ETAPA A', etapa: 'EI', periodo: 'Manhã',   professora: 'LILIANE',           sala: 6  },
  { nome: '2ª ETAPA B', etapa: 'EI', periodo: 'Manhã',   professora: 'SILVANA',           sala: 8  },
  { nome: '2ª ETAPA C', etapa: 'EI', periodo: 'Manhã',   professora: 'MICHELE',           sala: 9  },
  { nome: '2ª ETAPA D', etapa: 'EI', periodo: 'Manhã',   professora: 'SOLANGE',           sala: 10 },
  { nome: '2ª ETAPA E', etapa: 'EI', periodo: 'Tarde',   professora: 'SABRINA',           sala: 6  },
  { nome: '2ª ETAPA F', etapa: 'EI', periodo: 'Tarde',   professora: 'ANGELITA',          sala: 8  },
  { nome: '2ª ETAPA G', etapa: 'EI', periodo: 'Tarde',   professora: 'KAMILA',            sala: 9  },
  { nome: '2ª ETAPA H', etapa: 'EI', periodo: 'Tarde',   professora: 'DANIELLE',          sala: 10 },

  // === ENSINO FUNDAMENTAL — 1º ANO ===
  { nome: '1º ANO A',   etapa: 'EF1', periodo: 'Manhã',  professora: 'ROSELI PEREIRA',    sala: 11 },
  { nome: '1º ANO B',   etapa: 'EF1', periodo: 'Manhã',  professora: 'BRUNA',             sala: 25 },
  { nome: '1º ANO C',   etapa: 'EF1', periodo: 'Tarde',  professora: 'LUCIANY',           sala: 11 },
  { nome: '1º ANO D',   etapa: 'EF1', periodo: 'Tarde',  professora: 'SILENE',            sala: 24 },
  { nome: '1º ANO E',   etapa: 'EF1', periodo: 'Tarde',  professora: 'BIANCA',            sala: 25 },

  // === ENSINO FUNDAMENTAL — 2º ANO ===
  { nome: '2º ANO A',   etapa: 'EF1', periodo: 'Manhã',  professora: 'IONE',              sala: 20 },
  { nome: '2º ANO B',   etapa: 'EF1', periodo: 'Manhã',  professora: 'SANDRA',            sala: 21 },
  { nome: '2º ANO C',   etapa: 'EF1', periodo: 'Manhã',  professora: 'GILMARA',           sala: 24 },
  { nome: '2º ANO D',   etapa: 'EF1', periodo: 'Tarde',  professora: 'PAULA',             sala: 20 },
  { nome: '2º ANO E',   etapa: 'EF1', periodo: 'Tarde',  professora: 'MARTA',             sala: 21 },

  // === ENSINO FUNDAMENTAL — 3º ANO ===
  { nome: '3º ANO A',   etapa: 'EF1', periodo: 'Manhã',  professora: 'MAGNUS',            sala: 22 },
  { nome: '3º ANO B',   etapa: 'EF1', periodo: 'Manhã',  professora: 'THABATA',           sala: 23 },
  { nome: '3º ANO C',   etapa: 'EF1', periodo: 'Tarde',  professora: 'CÁTIA',             sala: 22 },
  { nome: '3º ANO D',   etapa: 'EF1', periodo: 'Tarde',  professora: 'ADRIANA CAETANO',   sala: 23 },

  // === ENSINO FUNDAMENTAL — 4º ANO ===
  { nome: '4º ANO A',   etapa: 'EF1', periodo: 'Manhã',  professora: 'JULIANA',           sala: 15 },
  { nome: '4º ANO B',   etapa: 'EF1', periodo: 'Manhã',  professora: 'CAMILA P',          sala: 19 },
  { nome: '4º ANO C',   etapa: 'EF1', periodo: 'Tarde',  professora: 'CIDA DRIGO',        sala: 15 },
  { nome: '4º ANO D',   etapa: 'EF1', periodo: 'Tarde',  professora: 'KARINE',            sala: 19 },

  // === ENSINO FUNDAMENTAL — 5º ANO ===
  { nome: '5º ANO A',   etapa: 'EF1', periodo: 'Manhã',  professora: 'ROSELI ZAMANA',     sala: 13 },
  { nome: '5º ANO B',   etapa: 'EF1', periodo: 'Manhã',  professora: 'JESSICA',           sala: 14 },
  { nome: '5º ANO C',   etapa: 'EF1', periodo: 'Tarde',  professora: 'ALESSANDRA',        sala: 13 },
  { nome: '5º ANO D',   etapa: 'EF1', periodo: 'Tarde',  professora: 'RAQUEL',            sala: 14 },

  // === EJA ===
  // ⚠️  Planilha tinha dois "EJA I". Ajuste o nome se necessário.
  { nome: 'EJA I',      etapa: 'EJA', periodo: 'Noturno', professora: 'MARIA DOS ANJOS',  sala: 14 },
  { nome: 'EJA II',     etapa: 'EJA', periodo: 'Noturno', professora: 'FRANCISCO',         sala: 15 },
];

async function main() {
  console.log('🏫 EMEIEF LUIZ GONZAGA — Criando turmas com professoras\n');
  console.log(`📋 Total a criar: ${turmas.length} turmas\n`);

  // Verifica se já existem turmas
  const check = await fetch(`${SUPABASE_URL}/rest/v1/Turma?select=id,nome&limit=5`, { headers: HEADERS });
  const existing = await check.json();
  if (existing.length > 0) {
    console.log(`⚠️  Já existem ${existing.length}+ turmas no banco!`);
    console.log('   Primeiras:', existing.map(t => t.nome).join(', '));
    console.log('   Abortando para não criar duplicatas.\n');
    console.log('   Se quiser recriar, exclua as turmas existentes primeiro via app.');
    process.exit(0);
  }

  let ok = 0, erros = 0;
  const errosList = [];

  for (const t of turmas) {
    const body = {
      nome: t.nome,
      etapa: t.etapa,
      periodo: t.periodo,
      professora: t.professora,
      numero: t.sala,
      letra: t.nome.split(' ').pop() ?? 'A', // pega a última letra/letra do nome
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/Turma`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
    });

    if (res.ok || res.status === 201) {
      const emoji = t.etapa === 'EI' ? '🌱' : t.etapa === 'EJA' ? '🌙' : '📚';
      console.log(`${emoji} ${t.nome.padEnd(14)} | Prof. ${t.professora.padEnd(22)} | ${t.periodo}`);
      ok++;
    } else {
      const errText = await res.text();
      console.log(`❌ ERRO: ${t.nome} — ${res.status}: ${errText.slice(0, 100)}`);
      errosList.push({ nome: t.nome, status: res.status, err: errText.slice(0, 100) });
      erros++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ✅ Turmas criadas com sucesso : ${ok}`);
  console.log(`  ❌ Erros                      : ${erros}`);
  console.log('═══════════════════════════════════════════════════');

  if (ok > 0) {
    console.log(`\n✅ Pronto! Abra o app e vá em Turmas para confirmar.`);
    console.log(`\n⚠️  ATENÇÃO: A planilha tinha DOIS "EJA I".`);
    console.log(`   Criei como: EJA I (Maria dos Anjos) e EJA II (Francisco).`);
    console.log(`   Confirme se o nome correto é EJA II ou outro (ex: EJA A, EJA B).`);
  }
}

main().catch(console.error);

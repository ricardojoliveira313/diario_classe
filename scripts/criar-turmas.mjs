const BASE = 'https://hxmwpleyhagwcukuhzxg.supabase.co/rest/v1/Turma';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ';
const H    = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

const turmas = [
  { nome: '1ª ETAPA A', professora: 'MARIA LUCIA',     periodo: 'Manhã'   },
  { nome: '1ª ETAPA B', professora: 'DENISE',           periodo: 'Manhã'   },
  { nome: '1ª ETAPA C', professora: 'FERNANDA',         periodo: 'Manhã'   },
  { nome: '1ª ETAPA D', professora: 'CELINA',           periodo: 'Manhã'   },
  { nome: '1ª ETAPA E', professora: 'DEBORA',           periodo: 'Tarde'   },
  { nome: '1ª ETAPA F', professora: 'ANDRESSA',         periodo: 'Tarde'   },
  { nome: '1ª ETAPA G', professora: 'ROSANGELA',        periodo: 'Tarde'   },
  { nome: '1ª ETAPA H', professora: 'ADRIANA ZENOIDES', periodo: 'Tarde'   },
  { nome: '2ª ETAPA A', professora: 'LILIANE',          periodo: 'Manhã'   },
  { nome: '2ª ETAPA B', professora: 'SILVANA',          periodo: 'Manhã'   },
  { nome: '2ª ETAPA C', professora: 'MICHELE',          periodo: 'Manhã'   },
  { nome: '2ª ETAPA D', professora: 'SOLANGE',          periodo: 'Manhã'   },
  { nome: '2ª ETAPA E', professora: 'SABRINA',          periodo: 'Tarde'   },
  { nome: '2ª ETAPA F', professora: 'ANGELITA',         periodo: 'Tarde'   },
  { nome: '2ª ETAPA G', professora: 'KAMILA',           periodo: 'Tarde'   },
  { nome: '2ª ETAPA H', professora: 'DANIELLE',         periodo: 'Tarde'   },
  { nome: '1º ANO A',   professora: 'ROSELI PEREIRA',   periodo: 'Manhã'   },
  { nome: '1º ANO B',   professora: 'BRUNA',            periodo: 'Manhã'   },
  { nome: '1º ANO C',   professora: 'LUCIANY',          periodo: 'Tarde'   },
  { nome: '1º ANO D',   professora: 'SILENE',           periodo: 'Tarde'   },
  { nome: '1º ANO E',   professora: 'BIANCA',           periodo: 'Tarde'   },
  { nome: '2º ANO A',   professora: 'IONE',             periodo: 'Manhã'   },
  { nome: '2º ANO B',   professora: 'SANDRA',           periodo: 'Manhã'   },
  { nome: '2º ANO C',   professora: 'GILMARA',          periodo: 'Manhã'   },
  { nome: '2º ANO D',   professora: 'PAULA',            periodo: 'Tarde'   },
  { nome: '2º ANO E',   professora: 'MARTA',            periodo: 'Tarde'   },
  { nome: '3º ANO A',   professora: 'MAGNUS',           periodo: 'Manhã'   },
  { nome: '3º ANO B',   professora: 'THABATA',          periodo: 'Manhã'   },
  { nome: '3º ANO C',   professora: 'CÁTIA',       periodo: 'Tarde'   },
  { nome: '3º ANO D',   professora: 'ADRIANA CAETANO',  periodo: 'Tarde'   },
  { nome: '4º ANO A',   professora: 'JULIANA',          periodo: 'Manhã'   },
  { nome: '4º ANO B',   professora: 'CAMILA P',         periodo: 'Manhã'   },
  { nome: '4º ANO C',   professora: 'CIDA DRIGO',       periodo: 'Tarde'   },
  { nome: '4º ANO D',   professora: 'KARINE',           periodo: 'Tarde'   },
  { nome: '5º ANO A',   professora: 'ROSELI ZAMANA',    periodo: 'Manhã'   },
  { nome: '5º ANO B',   professora: 'JESSICA',          periodo: 'Manhã'   },
  { nome: '5º ANO C',   professora: 'ALESSANDRA',       periodo: 'Tarde'   },
  { nome: '5º ANO D',   professora: 'RAQUEL',           periodo: 'Tarde'   },
  { nome: 'EJA I',            professora: 'MARIA DOS ANJOS',  periodo: 'Noturno' },
  { nome: 'EJA II',           professora: 'FRANCISCO',        periodo: 'Noturno' },
];

async function run() {
  console.log('🏫 EMEIEF LUIZ GONZAGA — criando turmas...\n');
  let ok = 0, err = 0;
  for (const t of turmas) {
    const res = await fetch(BASE, { method: 'POST', headers: H, body: JSON.stringify(t) });
    const sym = t.periodo === 'Noturno' ? '🌙' : t.periodo === 'Tarde' ? '🌆' : '🌅';
    if (res.status === 201 || res.ok) {
      console.log(`${sym} ${t.nome.padEnd(15)} | ${t.professora.padEnd(22)} | ${t.periodo}`);
      ok++;
    } else {
      const msg = await res.text();
      console.log(`❌ ERRO ${t.nome}: ${msg.slice(0, 100)}`);
      err++;
    }
  }
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  ✅ Turmas criadas : ${ok}`);
  console.log(`  ❌ Erros          : ${err}`);
  console.log(`${'═'.repeat(56)}`);
  if (err === 0) {
    console.log('\n✅ Todas as turmas criadas! Abra o app em Turmas para confirmar.');
    console.log('\n⚠️  A planilha tinha DOIS "EJA I" (salas 14 e 15).');
    console.log('   Criei como EJA I (Maria dos Anjos) e EJA II (Francisco).');
    console.log('   Confirme no app se o nome correto é EJA II ou outro.');
  }
}

run().catch(console.error);

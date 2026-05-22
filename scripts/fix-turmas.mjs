const BASE = 'https://hxmwpleyhagwcukuhzxg.supabase.co/rest/v1/Turma';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ';
const H    = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function main() {
  // 1. Busca todas as turmas ordenadas por criação
  const res = await fetch(`${BASE}?select=id,nome,professora,created_at&order=created_at`, { headers: H });
  const todas = await res.json();
  console.log(`Total atual: ${todas.length} turmas\n`);

  // 2. Mantém a PRIMEIRA ocorrência de cada nome, coleta duplicatas para deletar
  const vistos = new Map(); // nome → id mantido
  const deletar = [];
  for (const t of todas) {
    if (vistos.has(t.nome)) {
      deletar.push(t.id);
    } else {
      vistos.set(t.nome, t.id);
    }
  }
  console.log(`Duplicatas a remover: ${deletar.length}`);

  // 3. Deleta duplicatas
  let delOk = 0;
  for (const id of deletar) {
    const r = await fetch(`${BASE}?id=eq.${id}`, { method: 'DELETE', headers: H });
    if (r.status === 204 || r.ok) delOk++;
  }
  console.log(`✅ Deletadas: ${delOk}\n`);

  // 4. Corrige nomes dos professores do EJA
  const correcoes = [
    { nome: 'EJA I',  professora: 'MARIA DOS ANJOS FERREIRA DO CARMO' },
    { nome: 'EJA II', professora: 'ELAINE APARECIDA DA SILVA FIGUEIREDO' },
  ];

  for (const c of correcoes) {
    const id = vistos.get(c.nome);
    if (!id) { console.log(`❌ Não encontrou: ${c.nome}`); continue; }
    const r = await fetch(`${BASE}?id=eq.${id}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ professora: c.professora }),
    });
    if (r.status === 204 || r.ok) {
      console.log(`✅ ${c.nome} → Prof. ${c.professora}`);
    } else {
      console.log(`❌ Erro ao atualizar ${c.nome}: ${r.status}`);
    }
  }

  // 5. Confirmação final
  const conf = await fetch(`${BASE}?select=id,nome,professora&order=nome`, { headers: H });
  const final = await conf.json();
  console.log(`\nTotal final: ${final.length} turmas`);
  const ejas = final.filter(t => t.nome.includes('EJA'));
  console.log('\nEJA:');
  ejas.forEach(t => console.log(`  ${t.nome} → ${t.professora}`));
}

main().catch(console.error);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hxmwpleyhagwcukuhzxg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ'
);

async function main() {
  // Add NIS column
  const { error: e1 } = await supabase.rpc('exec_sql', { 
    sql: 'ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS nis TEXT DEFAULT NULL;'
  }).single();
  console.log('NIS col:', e1 ? { message: e1.message } : 'OK');

  const { error: e2 } = await supabase.rpc('exec_sql', { 
    sql: 'ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS responsavel TEXT DEFAULT NULL;'
  }).single();
  console.log('Responsavel col:', e2 ? { message: e2.message } : 'OK');
}

main().catch(e => console.error(e.message));

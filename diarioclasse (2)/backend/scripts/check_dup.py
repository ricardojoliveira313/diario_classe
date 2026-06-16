import sqlite3
c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()

# Count all
cur.execute('SELECT COUNT(*) FROM Aluno')
print(f'Total registros: {cur.fetchone()[0]}')

# Duplicates by (ra, turmaId)
cur.execute('SELECT ra, turmaId, COUNT(*) as cnt FROM Aluno GROUP BY ra, turmaId HAVING cnt > 1')
dups = cur.fetchall()
print(f'Duplicatas (RA+Turma): {len(dups)}')
for d in dups[:5]:
    cur.execute('SELECT nome FROM Aluno WHERE ra = ? AND turmaId = ?', (d[0], d[1]))
    nomes = [r[0] for r in cur.fetchall()]
    print(f'  RA={d[0]} cnt={d[2]}: {nomes}')

# Count by number of turmas per student
cur.execute('SELECT nome, ra, COUNT(*) as cnt FROM Aluno GROUP BY nome, ra HAVING cnt > 1 ORDER BY cnt DESC LIMIT 15')
print('\nAlunos em multiplas turmas (top 15):')
for r in cur.fetchall():
    print(f'  {r[0][:35]:35s} | RA: {r[1]:10s} | {r[2]} turmas')

c.close()

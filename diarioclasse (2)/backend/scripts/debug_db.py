import sqlite3
conn = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = conn.cursor()

print('=== HELENA VITORYA ===')
cur.execute("SELECT id, nome, ra, dataInicioMatric, dataFimMatric, situacao, turmaId FROM Aluno WHERE nome LIKE '%HELENA%VIT%'")
for r in cur.fetchall():
    cur.execute('SELECT nome FROM Turma WHERE id = ?', (r[6],))
    t = cur.fetchone()
    print(f'Nome: {r[1]}')
    print(f'RA: {r[2]}')
    print(f'Situacao: {r[5]}')
    print(f'Turma: {t[0]}')
    print(f'Data Inicio: {r[3]} | Data Fim: {r[4]}')
    print()

print('=== DUPLICATAS (mesmo nome + RA) ===')
cur.execute("SELECT nome, ra, COUNT(*) as cnt FROM Aluno GROUP BY nome, ra HAVING cnt > 1")
dups = cur.fetchall()
print(f'Total duplicatas: {len(dups)}')
for d in dups[:15]:
    print(f'  {d[0][:30]:30s} | RA: {d[1]:10s} | {d[2]}x')

conn.close()

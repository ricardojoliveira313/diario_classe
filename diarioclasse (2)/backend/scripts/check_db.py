import sqlite3
conn = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = conn.cursor()

cur.execute('SELECT COUNT(*) FROM Aluno')
print(f'Total alunos: {cur.fetchone()[0]}')

cur.execute("SELECT COUNT(*) FROM Aluno WHERE dataInicioMatric != ''")
print(f'Com dataInicioMatric: {cur.fetchone()[0]}')

cur.execute("SELECT COUNT(*) FROM Aluno WHERE dataFimMatric != ''")
print(f'Com dataFimMatric: {cur.fetchone()[0]}')

cur.execute("SELECT nome, dataInicioMatric, dataFimMatric FROM Aluno WHERE dataInicioMatric != '' LIMIT 5")
for r in cur.fetchall():
    print(f'  {r[0][:30]:30s} | inicio: {r[1]:12s} | fim: {r[2]}')

print()
cur.execute("SELECT nome, dataInicioMatric, dataFimMatric FROM Aluno LIMIT 3")
for r in cur.fetchall():
    print(f'  {r[0][:30]:30s} | inicio: {r[1]:12s} | fim: {r[2]}')

conn.close()

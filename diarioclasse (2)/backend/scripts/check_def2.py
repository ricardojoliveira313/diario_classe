import sqlite3
c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()

cur.execute("SELECT COUNT(*) FROM Aluno WHERE deficiencia != ''")
print(f'Alunos com deficiencia: {cur.fetchone()[0]}')

cur.execute("SELECT COUNT(*) FROM Aluno")
print(f'Total alunos: {cur.fetchone()[0]}')

cur.execute("SELECT DISTINCT deficiencia FROM Aluno WHERE deficiencia != '' ORDER BY deficiencia")
print('\nTipos de deficiencia:')
for r in cur.fetchall():
    cur.execute("SELECT COUNT(*) FROM Aluno WHERE deficiencia = ?", (r[0],))
    print(f'  {r[0][:50]:50s} | {cur.fetchone()[0]}')

c.close()

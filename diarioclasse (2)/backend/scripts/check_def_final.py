import sqlite3
c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()
cur.execute("SELECT DISTINCT deficiencia FROM Aluno WHERE deficiencia != '' ORDER BY deficiencia")
for r in cur.fetchall():
    cur.execute("SELECT COUNT(*) FROM Aluno WHERE deficiencia = ?", (r[0],))
    print('  ' + str(r[0][:50]) + ' | ' + str(cur.fetchone()[0]))
cur.execute("SELECT COUNT(*) FROM Aluno WHERE deficiencia != ''")
print('\nTotal com deficiencia: ' + str(cur.fetchone()[0]))
cur.execute("SELECT COUNT(*) FROM Aluno")
print('Total alunos: ' + str(cur.fetchone()[0]))
c.close()

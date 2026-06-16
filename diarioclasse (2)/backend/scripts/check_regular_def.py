import sqlite3
c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()

cur.execute("SELECT COUNT(*) FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome NOT LIKE '%AEE%' AND a.deficiencia != ''")
print('Regulares com deficiencia: ' + str(cur.fetchone()[0]))

cur.execute("SELECT COUNT(*) FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome LIKE '%AEE%' AND a.deficiencia != ''")
print('AEE com deficiencia: ' + str(cur.fetchone()[0]))

cur.execute("SELECT COUNT(*) FROM Aluno")
print('Total alunos: ' + str(cur.fetchone()[0]))

c.close()

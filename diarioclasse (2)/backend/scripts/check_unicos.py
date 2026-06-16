import sqlite3
c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()

# Alunos unicos (por RA)
cur.execute('SELECT COUNT(DISTINCT ra) FROM Aluno')
print('Alunos unicos (por RA): ' + str(cur.fetchone()[0]))

# Unicos em cada modalidade
cur.execute('SELECT COUNT(DISTINCT a.ra) FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome NOT LIKE "%AEE%"')
print('Unicos em classes REGULARES: ' + str(cur.fetchone()[0]))

cur.execute('SELECT COUNT(DISTINCT a.ra) FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome LIKE "%AEE%"')
print('Unicos em AEE: ' + str(cur.fetchone()[0]))

# Que estao em AMBAS
cur.execute('''
    SELECT COUNT(*) FROM (
        SELECT a.ra FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome NOT LIKE "%AEE%"
        INTERSECT
        SELECT a.ra FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome LIKE "%AEE%"
    )
''')
print('Unicos em AMBAS (regular + AEE): ' + str(cur.fetchone()[0]))

# So regular
cur.execute('''
    SELECT COUNT(*) FROM (
        SELECT a.ra FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome NOT LIKE "%AEE%"
        EXCEPT
        SELECT a.ra FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome LIKE "%AEE%"
    )
''')
print('So REGULAR: ' + str(cur.fetchone()[0]))

# So AEE
cur.execute('''
    SELECT COUNT(*) FROM (
        SELECT a.ra FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome LIKE "%AEE%"
        EXCEPT
        SELECT a.ra FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome NOT LIKE "%AEE%"
    )
''')
print('So AEE: ' + str(cur.fetchone()[0]))

c.close()

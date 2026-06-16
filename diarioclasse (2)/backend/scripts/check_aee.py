import sqlite3
c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()

cur.execute('SELECT id, nome FROM Turma WHERE nome LIKE "%AEE%"')
print('Turmas AEE:')
for r in cur.fetchall():
    cur.execute('SELECT COUNT(*) FROM Aluno WHERE turmaId = ?', (r[0],))
    total = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM Aluno WHERE turmaId = ? AND deficiencia != ""', (r[0],))
    com_def = cur.fetchone()[0]
    print(f'  {r[1][:40]:40s} | Total: {total} | Com def: {com_def}')

cur.execute('SELECT COUNT(*) FROM Aluno WHERE turmaId IN (SELECT id FROM Turma WHERE nome LIKE "%AEE%")')
total_aee = cur.fetchone()[0]
print(f'\nTotal alunos em AEE: {total_aee}')

cur.execute('SELECT COUNT(*) FROM Aluno WHERE turmaId IN (SELECT id FROM Turma WHERE nome LIKE "%AEE%") AND deficiencia != ""')
print(f'Com deficiencia em AEE: {cur.fetchone()[0]}')

c.close()

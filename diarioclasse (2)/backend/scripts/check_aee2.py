import sqlite3
c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()

# AEE students
cur.execute('SELECT a.ra, a.nome, a.turmaId, a.deficiencia FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome LIKE "%AEE%"')
aee = {r[0]: r for r in cur.fetchall()}

# Count unique AEE students
print(f'Total AEE: {len(aee)}')

# Which AEE students also appear in regular classes?
cur.execute('SELECT DISTINCT a.ra FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome NOT LIKE "%AEE%"')
regular_ras = {r[0] for r in cur.fetchall()}

tambem_regular = aee.keys() & regular_ras
so_aee = aee.keys() - regular_ras

print(f'AEE que tambem estao em regular: {len(tambem_regular)}')
print(f'So AEE: {len(so_aee)}')

if so_aee:
    print('\nAlunos SO AEE (nao estao em regular):')
    for ra in sorted(list(so_aee))[:10]:
        nome = aee[ra][1]
        print(f'  {nome[:35]:35s} | RA: {ra}')

c.close()

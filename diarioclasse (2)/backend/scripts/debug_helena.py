import sqlite3
conn = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = conn.cursor()

# Buscar Helena Vitorya
cur.execute("SELECT nome, ra, dataInicioMatric, dataFimMatric, turmaId, situacao, deficiencia FROM Aluno WHERE nome LIKE '%HELENA%VIT%'")
for r in cur.fetchall():
    print(f'{r[0]}')
    print(f'  RA: {r[1]}')
    print(f'  Inicio: {r[2]} | Fim: {r[3]}')
    print(f'  Situacao: {r[5]}')
    print(f'  Deficiencia: {r[6]}')
    print(f'  turmaId: {r[4]}')

# Mostrar turmas
cur.execute("SELECT id, nome FROM Turma")
turmas = {r[0]: r[1] for r in cur.fetchall()}

print('\n--- Turmas ---')
for tid, tnome in turmas.items():
    cur.execute("SELECT COUNT(*) FROM Aluno WHERE turmaId = ?", (tid,))
    count = cur.fetchone()[0]
    print(f'{tid[:8]}... | {tnome[:40]:40s} | {count} alunos')

conn.close()

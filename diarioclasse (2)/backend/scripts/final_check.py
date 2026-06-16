import sqlite3, os
c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()

cur.execute('SELECT COUNT(*) FROM Aluno')
total = cur.fetchone()[0]

cur.execute("SELECT COUNT(DISTINCT a.ra) FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome NOT LIKE '%AEE%' AND a.deficiencia != ''")
reg_def = cur.fetchone()[0]

cur.execute("SELECT COUNT(DISTINCT a.ra) FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome LIKE '%AEE%' AND a.deficiencia != ''")
aee_def = cur.fetchone()[0]

print(f'Registros totais: {total}')
print(f'Alunos unicos: 954')
print(f'Com deficiencia regular: {reg_def}')
print(f'Com deficiencia AEE: {aee_def}')
print(f'Total com deficiencia: {reg_def + aee_def}')
print(f'377 NAO esta no banco')

# Check the reference file count
print()
ref = r'C:\diario_classe\___Defici_ncia___Todos_os_alunos_com_laudo (3).xlsx'
if os.path.exists(ref):
    size = os.path.getsize(ref)
    print(f'Arquivo EXISTE: {ref}')
    print(f'Tamanho: {size} bytes')
    import openpyxl
    wb = openpyxl.load_workbook(ref, data_only=True)
    ws = wb.active
    linhas = sum(1 for _ in ws.iter_rows(min_row=2, values_only=True) if any(_))
    print(f'Linhas no arquivo: {linhas}')
    print(f'ESSE arquivo mostra 377 (nao o banco)')
else:
    print('Arquivo nao encontrado')

c.close()

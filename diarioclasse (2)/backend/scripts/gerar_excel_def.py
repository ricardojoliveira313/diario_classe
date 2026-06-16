import sqlite3, re
from openpyxl import Workbook

c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()

# Buscar alunos com deficiencia em turmas REGULARES (nao AEE)
cur.execute("""
    SELECT DISTINCT a.nome, a.ra, a.deficiencia, t.nome, a.turmaId
    FROM Aluno a
    JOIN Turma t ON a.turmaId = t.id
    WHERE t.nome NOT LIKE '%AEE%'
    AND a.deficiencia != ''
    ORDER BY a.nome
""")
alunos = cur.fetchall()
print(f'Alunos regulares com deficiencia: {len(alunos)}')

# Buscar se eles tambem estao em AEE
cur.execute("SELECT DISTINCT a.ra FROM Aluno a JOIN Turma t ON a.turmaId = t.id WHERE t.nome LIKE '%AEE%'")
aee_ras = {r[0] for r in cur.fetchall()}

# Criar novo Excel
wb = Workbook()
ws = wb.active
ws.title = 'Alunos com Deficiencia'

# Header
headers = ['Nome', 'RA', 'Deficiencia', 'Turma Regular', 'Professora', 'AEE']
ws.append(headers)

for nome, ra, deficiencia, turma, tid in alunos:
    # Determinar professora (da turma)
    cur.execute("SELECT professor, periodo FROM Turma WHERE id = ?", (tid,))
    t_info = cur.fetchone()
    professora = t_info[0] if t_info and t_info[0] else ''
    
    # Marcar AEE
    tem_aee = 'SIM' if ra in aee_ras else ''
    
    ws.append([nome, ra, deficiencia, turma, professora, tem_aee])

# Salvar
output = r'C:\diario_classe\___Deficiencia___Todos_os_alunos_com_laudo.xlsx'
wb.save(output)
print(f'Arquivo gerado: {output}')

c.close()

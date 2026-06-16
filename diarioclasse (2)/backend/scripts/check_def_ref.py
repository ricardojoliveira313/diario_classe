import sqlite3, re, openpyxl

# Ler arquivo de referencia
wb = openpyxl.load_workbook(r'C:\diario_classe\___Defici_ncia___Todos_os_alunos_com_laudo (3).xlsx', data_only=True)
ws = wb.active
ref = {}
for row in ws.iter_rows(min_row=2, values_only=True):
    if not any(row): continue
    ra = re.sub(r'\D', '', str(row[1] or '')).lstrip('0')
    nome = str(row[0] or '').strip().upper()
    if ra in ref:
        print(f'DUPLICADO: {nome} | RA: {ra}')
    ref[ra] = nome

print(f'\nTotal no arquivo: {len(ref)}')

# DB
c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()
cur.execute('SELECT ra, nome, deficiencia, turmaId FROM Aluno WHERE deficiencia != ""')
banco = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}

# Ver turmas
cur.execute('SELECT id, nome FROM Turma')
turmas = {r[0]: r[1] for r in cur.fetchall()}

# Classificar
aee = 0
regular = 0
for ra, (nome, defi, tid) in banco.items():
    t = turmas.get(tid, '')
    if 'AEE' in t.upper():
        aee += 1
    else:
        regular += 1

print(f'No banco com deficiencia - Regular: {regular}, AEE: {aee}, Total: {regular + aee}')
c.close()

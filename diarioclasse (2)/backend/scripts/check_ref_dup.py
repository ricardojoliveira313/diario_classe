import openpyxl, re, sqlite3

wb = openpyxl.load_workbook(r'C:\diario_classe\___Defici_ncia___Todos_os_alunos_com_laudo (3).xlsx', data_only=True)
ws = wb.active

ras = {}
for row in ws.iter_rows(min_row=2, values_only=True):
    if not any(row): continue
    ra = re.sub(r'\D', '', str(row[1] or '')).lstrip('0')
    nome = str(row[0] or '').strip().upper()
    if not ra: continue
    ras[ra] = nome

print('Total RAs unicos no arquivo: ' + str(len(ras)))

c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()
cur.execute('SELECT ra, deficiencia FROM Aluno')
db_def = {}
for r in cur.fetchall():
    ra = r[0]
    defi = r[1] or ''
    db_def[ra] = defi

ras_db = set(db_def.keys())
com_def_no_db = {ra for ra, d in db_def.items() if d}
no_arquivo = ras.keys() & ras_db
com_def_no_arquivo = ras.keys() & com_def_no_db

print('No DB (total): ' + str(len(ras_db)))
print('No DB com deficiencia: ' + str(len(com_def_no_db)))
print('No arquivo de referencia: ' + str(len(ras)))
print('No arquivo E no DB: ' + str(len(no_arquivo)))
print('Com deficiencia no DB E no arquivo: ' + str(len(com_def_no_arquivo)))

# Faltando
faltando = ras.keys() - com_def_no_db
print('\nNo arquivo mas SEM deficiencia no DB: ' + str(len(faltando)))
for i, ra in enumerate(sorted(list(faltando))):
    if i >= 5: break
    cur.execute("SELECT nome, deficiencia FROM Aluno WHERE ra = ?", (ra,))
    row = cur.fetchone()
    if row:
        print('  ' + row[0][:35] + ' | RA: ' + ra + ' | Def atual: ' + (row[1] or '(vazio)'))
    else:
        print('  RA: ' + ra + ' - NAO ENCONTRADO no DB')

# Extra
extra = com_def_no_db - ras.keys()
print('\nCom deficiencia no DB mas NAO no arquivo: ' + str(len(extra)))
for i, ra in enumerate(sorted(list(extra))):
    if i >= 5: break
    row = db_def[ra]
    cur.execute("SELECT nome FROM Aluno WHERE ra = ?", (ra,))
    nome = cur.fetchone()
    nome_str = nome[0][:35] if nome else '?'
    print('  ' + nome_str + ' | RA: ' + ra + ' | Def: ' + row)

c.close()

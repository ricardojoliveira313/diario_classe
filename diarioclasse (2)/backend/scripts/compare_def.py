import openpyxl, sqlite3, re

# Ler arquivo de deficiencia
wb = openpyxl.load_workbook(r'C:\diario_classe\___Defici_ncia___Todos_os_alunos_com_laudo (3).xlsx', data_only=True)
ws = wb.active
exp = set()
for row in ws.iter_rows(min_row=2, values_only=True):
    if not any(row): continue
    ra = re.sub(r'\D', '', str(row[1] or '')).lstrip('0')
    exp.add(ra)

print(f'Esperados (arquivo deficiencia): {len(exp)}')

# Ler banco
c = sqlite3.connect(r'C:\diario_classe\diarioclasse (2)\backend\prisma\dev.db')
cur = c.cursor()
cur.execute('SELECT ra, nome, deficiencia FROM Aluno WHERE deficiencia != ""')
banco = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
print(f'No banco com deficiencia: {len(banco)}')

# Comparar
ra_extra = set(banco.keys()) - exp
ra_faltando = exp - set(banco.keys())
print(f'\nNo banco mas NAO no arquivo: {len(ra_extra)}')
print(f'No arquivo mas NAO no banco: {len(ra_faltando)}')

if ra_extra:
    print('\nExemplos de EXTRA (banco tem, arquivo nao):')
    for ra in list(ra_extra)[:10]:
        nome, defi = banco[ra]
        print(f'  {nome[:35]:35s} | RA: {ra:10s} | Def: {defi}')

if ra_faltando:
    print('\nExemplos de FALTANDO (arquivo tem, banco nao):')
    for ra in list(ra_faltando)[:10]:
        print(f'  RA: {ra}')

c.close()

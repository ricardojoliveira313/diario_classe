import json, re, pdfplumber, openpyxl

def limpar_nome(nome):
    return re.sub(r'\s+', ' ', nome).strip().upper()

def extrair_ra(ra):
    return re.sub(r'\D', '', str(ra)).lstrip('0')

def normalizar_data(data):
    data = str(data or '').strip()
    if not data: return ''
    partes = re.findall(r'\d+', data)
    if len(partes) == 3:
        return f'{partes[0]}/{partes[1]}/{partes[2]}'
    return data

# Read Excel
wb = openpyxl.load_workbook(r'C:\diario_classe\ALUNOS - ATIPICOS\alunos atipicos - SED.xlsx', data_only=True)
ws = wb.active
excel_alunos = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if not any(row): continue
    nome = limpar_nome(str(row[4] or ''))
    ra = extrair_ra(str(row[5] or ''))
    nasc = normalizar_data(str(row[8] or ''))
    data_ini = normalizar_data(str(row[9] or ''))
    data_fim = normalizar_data(str(row[10] or ''))
    excel_alunos.append({'nome': nome, 'ra': ra, 'nasc': nasc, 'ini': data_ini, 'fim': data_fim})
    
print(f'Excel: {len(excel_alunos)} alunos')
print(f'Amostra Excel:', [(a['nome'][:30], a['ra'], a['nasc'], a['ini']) for a in excel_alunos[:3]])

# Read first PDF student
with pdfplumber.open(r'C:\diario_classe\FUNDAMENTAL.pdf') as pdf:
    page = pdf.pages[0]
    tables = page.extract_tables()
    table = tables[0]
    header = table[0]
    row = table[1]
    nome = limpar_nome(str(row[2] or ''))
    ra = extrair_ra(str(row[3] or ''))
    nasc = normalizar_data(str(row[6] or ''))
    print(f'\nPDF sample:')
    print(f'  nome: {repr(nome)}')
    print(f'  ra: {repr(ra)}')
    print(f'  nasc: {repr(nasc)}')

# Try to find match
for e in excel_alunos:
    if e['nome'] == nome and e['ra'] == ra and e['nasc'] == nasc:
        print(f'\nMATCH FOUND!')
        print(f'  Excel: {e}')
        print(f'  PDF: nome={nome}, ra={ra}, nasc={nasc}')
        break
else:
    print(f'\nNO MATCH! Checking why...')
    for e in excel_alunos:
        if e['nome'] == nome:
            print(f'  Same name: excel ra={repr(e["ra"])} pdf ra={repr(ra)} match={e["ra"] == ra}')
            break
    for e in excel_alunos:
        if e['ra'] == ra:
            print(f'  Same ra: excel nome={repr(e["nome"][:30])} pdf nome={repr(nome)} nasc={repr(e["nasc"])} pdf nasc={repr(nasc)}')
            break

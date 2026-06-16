import json, re, pdfplumber, openpyxl, unicodedata

def limpar_nome(nome):
    return re.sub(r'\s+', ' ', nome).strip().upper()

def extrair_ra(ra):
    return re.sub(r'\D', '', str(ra)).lstrip('0')

def normalizar_data(data):
    data = str(data or '').strip()
    if not data: return ''
    partes = re.findall(r'\d+', data)
    return f'{partes[0]}/{partes[1]}/{partes[2]}' if len(partes) == 3 else data

def tirar_acentos(texto):
    return unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode()

# Read INFANTIL Excel
wb = openpyxl.load_workbook(r'C:\diario_classe\ALUNOS - ATIPICOS\INFANTIL - ATIPICOS.xlsx', data_only=True)
ws = wb.active
print('=== Busca Helena no Excel INFANTIL ===')
for row in ws.iter_rows(min_row=2, values_only=True):
    if not any(row): continue
    nome = limpar_nome(str(row[4] or ''))
    ra = extrair_ra(str(row[5] or ''))
    if 'HELENA' in nome and 'VIT' in nome:
        print(f'  Nome: {nome}')
        print(f'  RA: {ra}')
        print(f'  Nasc: {normalizar_data(str(row[8] or ""))}')
        print(f'  Nº: {row[3]}')
        print(f'  Data Inicio: {normalizar_data(str(row[9] or ""))}')
        print(f'  Data Fim: {normalizar_data(str(row[10] or ""))}')
        print(f'  Turma Excel - Nº Classe: {row[0]}')

# Read the INFANTIL PDF for turma 300558900
print('\n=== Busca Helena no PDF INFANTIL ===')
with pdfplumber.open(r'C:\diario_classe\INFANTIL.pdf') as pdf:
    for page in pdf.pages:
        text = page.extract_text() or ''
        if '300558900' not in text:
            continue
        print(f'  Pagina com classe 300558900 encontrada')
        tables = page.extract_tables()
        for table in tables:
            for row in table[1:]:
                nome = limpar_nome(str(row[2] or ''))
                ra = extrair_ra(str(row[3] or ''))
                if 'HELENA' in nome and 'VIT' in nome:
                    print(f'  PDF encontrou: {nome}')
                    print(f'  RA: {ra}')
                    print(f'  Dados: {row}')
                    break

# Now check what the matching does
print('\n=== Teste de matching ===')
# Read all Excel INFANTIL
excel_alunos = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if not any(row): continue
    nome = limpar_nome(str(row[4] or ''))
    ra = extrair_ra(str(row[5] or ''))
    nasc = normalizar_data(str(row[8] or ''))
    data_ini = normalizar_data(str(row[9] or ''))
    data_fim = normalizar_data(str(row[10] or ''))
    excel_alunos.append({'nome': nome, 'ra': ra, 'nasc': nasc, 'ini': data_ini, 'fim': data_fim})

# Build match index
excel_index = {}
for a in excel_alunos:
    chave = (a['nome'], a['ra'], a['nasc'])
    excel_index[chave] = a

# Find Helena in PDF
with pdfplumber.open(r'C:\diario_classe\INFANTIL.pdf') as pdf:
    for page in pdf.pages:
        text = page.extract_text() or ''
        if '300558900' not in text:
            continue
        tables = page.extract_tables()
        for table in tables:
            for row in table[1:]:
                nome = limpar_nome(str(row[2] or ''))
                ra = extrair_ra(str(row[3] or ''))
                if 'HELENA' in nome and 'VIT' in nome:
                    nasc = normalizar_data(str(row[6] or ''))
                    chave = (nome, ra, nasc)
                    print(f'Chave PDF: {chave}')
                    match = excel_index.get(chave)
                    if match:
                        print(f'MATCH ENCONTRADO!')
                        print(f'  Inicio: {match["ini"]}')
                        print(f'  Fim: {match["fim"]}')
                    else:
                        print(f'SEM MATCH!')
                        # Check what's close
                        for k, v in excel_index.items():
                            if k[1] == ra:
                                print(f'  Proximo (RA match): {k}')
                                print(f'    Diferenca nome: {k[0] == nome}')
                                print(f'    Diferenca nasc: {k[2] == nasc}')

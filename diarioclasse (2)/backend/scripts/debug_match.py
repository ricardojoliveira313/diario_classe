#!/usr/bin/env python3
import re
import pandas as pd
import pdfplumber

# Check Excel
df = pd.read_excel(r'C:\diario_classe\ALUNOS - ATIPICOS\alunos atipicos - SED.xlsx')
print('=== EXCEL ===')
print(f'Total linhas: {len(df)}')
print(f'Colunas: {list(df.columns)}')
print(f'RA dtype: {df["RA"].dtype}')
print(f'RA sample: {df["RA"].head(5).tolist()}')
print(f'RA raw: {[repr(str(x)) for x in df["RA"].head(5)]}')
print()

# Try different RA formats
for i, r in enumerate(df['RA'].head(5)):
    raw = str(r)
    digits = re.sub(r'\D', '', raw)
    print(f'  Excel RA[{i}]: raw={repr(raw)} -> digits={digits} (len={len(digits)})')

print()

# Check PDF RA format
print('=== PDF (AEE.pdf page 1) ===')
with pdfplumber.open(r'C:\diario_classe\AEE.pdf') as pdf:
    page = pdf.pages[0]
    tables = page.extract_tables()
    for table in tables:
        for row in table[1:4]:
            ra_raw = str(row[3] or '').strip() if len(row) > 3 else ''
            nome = str(row[2] or '').strip() if len(row) > 2 else ''
            ra_digits = re.sub(r'\D', '', ra_raw)
            print(f'  PDF RA: raw={repr(ra_raw)} -> digits={ra_digits} (len={len(ra_digits)}) | Nome: {nome[:30]}')

print()

# Test matching
print('=== TEST MATCHING ===')
# Get first 3 PDF students
pdf_alunos = []
with pdfplumber.open(r'C:\diario_classe\FUNDAMENTAL.pdf') as pdf:
    page = pdf.pages[0]
    tables = page.extract_tables()
    for table in tables:
        for row in table[1:4]:
            nome = re.sub(r'\s+', ' ', str(row[2] or '')).strip().upper() if len(row) > 2 else ''
            ra_raw = str(row[3] or '').strip() if len(row) > 3 else ''
            nasc = str(row[6] or '').strip() if len(row) > 6 else ''
            ra_digits = re.sub(r'\D', '', ra_raw)
            pdf_alunos.append({'nome': nome, 'ra': ra_digits, 'nasc': nasc})

# Get first 3 Excel students
excel_alunos = []
for _, row in df.head(5).iterrows():
    nome = re.sub(r'\s+', ' ', str(row['Nome do Aluno'] or '')).strip().upper()
    ra_raw = str(row['RA'])
    ra_digits = re.sub(r'\D', '', ra_raw)
    nasc = str(row['Data de Nascimento'] or '').strip()
    excel_alunos.append({'nome': nome, 'ra': ra_digits, 'nasc': nasc})

print('PDF students:')
for a in pdf_alunos:
    print(f'  nome={repr(a["nome"])} ra={repr(a["ra"])} nasc={repr(a["nasc"])}')
print()
print('Excel students:')
for a in excel_alunos:
    print(f'  nome={repr(a["nome"])} ra={repr(a["ra"])} nasc={repr(a["nasc"])}')

# Try matching
print()
for p in pdf_alunos:
    for e in excel_alunos:
        match = p['nome'] == e['nome'] and p['ra'] == e['ra'] and p['nasc'] == e['nasc']
        if match:
            print(f'MATCH: {p["nome"]}')

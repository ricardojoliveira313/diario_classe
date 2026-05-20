import os, re
os.chdir('C:/diario_classe')
with open('formulario_completo_35082806 (1).txt', encoding='utf-8') as f:
    texto = f.read()

registros = []
for m in re.finditer(r'Nome:\s*(.+?)\n.*?Dt\.\s*Nasc\.:\s*(\d{2}/\d{2}/\d{4})\n.*?NIS:\s*(\d{11})', texto, re.DOTALL):
    nome = m.group(1).strip()
    nasc = m.group(2)
    nis = m.group(3)
    registros.append({'nome': nome, 'nasc': nasc, 'nis': nis})

print(f'Registros: {len(registros)}')
for r in registros[:5]:
    print(f"  {r['nome']} | {r['nasc']} | NIS: {r['nis']}")

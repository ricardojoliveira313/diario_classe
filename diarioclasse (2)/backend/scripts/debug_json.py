import json
with open('C:\\diario_classe\\import_result.json', encoding='utf-8') as f:
    d = json.load(f)

print('Chaves do JSON:', list(d.keys()))
print('Total alunos:', len(d['alunos']))

# Check first 3
for a in d['alunos'][:5]:
    print(f'{a["nome"][:40]:40s} | RA: {a["ra"]:10s} | ini: {a["dataInicioMatric"]:12s} | fim: {a["dataFimMatric"]}')

# Count with/without data
com = sum(1 for a in d['alunos'] if a.get('dataInicioMatric'))
sem = sum(1 for a in d['alunos'] if not a.get('dataInicioMatric'))
print(f'\nCom data: {com}')
print(f'Sem data: {sem}')

# Find Alice
for a in d['alunos']:
    if 'ALICE' in a['nome'] and 'BARROS' in a['nome']:
        print(f'\nALICE: {a}')
        break

import json
with open('C:\\diario_classe\\import_result.json', encoding='utf-8') as f:
    d = json.load(f)

# Find all Alice Lopes Barros entries
for a in d['alunos']:
    if 'ALICE' in a['nome'] and 'BARROS' in a['nome']:
        print(f'Turma: {a["turma"]:40s} | ini: {a["dataInicioMatric"]:12s} | fim: {a["dataFimMatric"]}')

# Count students with data per turma type
com = sum(1 for a in d['alunos'] if a.get('dataInicioMatric'))
sem = sum(1 for a in d['alunos'] if not a.get('dataInicioMatric'))
print(f'\nCom data: {com}')
print(f'Sem data: {sem}')

# Show first 3 that HAVE data
print('\n--- Primeiros 3 com data ---')
for a in d['alunos']:
    if a.get('dataInicioMatric'):
        print(f'{a["nome"][:40]:40s} | turma: {a["turma"][:30]:30s} | ini: {a["dataInicioMatric"]}')
        break
for a in d['alunos']:
    if a.get('dataInicioMatric') and a['nome'] != d['alunos'][0]['nome']:
        print(f'{a["nome"][:40]:40s} | turma: {a["turma"][:30]:30s} | ini: {a["dataInicioMatric"]}')
        break

# Show combo dos PDFs turmas que tem match
from collections import Counter
turmas_com = Counter()
turmas_sem = Counter()
for a in d['alunos']:
    if a.get('dataInicioMatric'):
        turmas_com[a['turma'].split(' - ')[0].strip()] += 1
    else:
        turmas_sem[a['turma'].split(' - ')[0].strip()] += 1

print('\n--- Turmas SEM data (top 10) ---')
for t, c in turmas_sem.most_common(10):
    print(f'  {t:40s}: {c}')

print('\n--- Turmas COM data (top 10) ---')
for t, c in turmas_com.most_common(10):
    print(f'  {t:40s}: {c}')

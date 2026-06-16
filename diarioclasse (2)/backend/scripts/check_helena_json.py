import json
with open(r'C:\diario_classe\import_result.json', encoding='utf-8') as f:
    d = json.load(f)

# Find Helena
for a in d['alunos']:
    if 'HELENA' in a['nome'] and 'VIT' in a['nome']:
        print(f'{a["nome"]}')
        print(f'  Turma: {a["turma"]}')
        print(f'  NrClasse: {a.get("nrClasse","")}')
        print(f'  NrAluno: {a.get("numeroAluno","")}')
        print(f'  Inicio: {a["dataInicioMatric"]}')
        print(f'  Fim: {a["dataFimMatric"]}')
        print(f'  Situacao: {a["situacao"]}')
        print(f'  DataMov: {a["dataMovimentacao"]}')
        print()

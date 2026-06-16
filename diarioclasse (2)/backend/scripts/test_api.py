import urllib.request, json

# Get turmas
r = urllib.request.urlopen('http://localhost:3001/api/turmas', timeout=10)
turmas = json.loads(r.read())
print(f'{len(turmas)} turmas no banco')

if turmas:
    t = turmas[0]
    tid = t['id']
    print(f'Turma: {t["nome"]}')
    
    r2 = urllib.request.urlopen(f'http://localhost:3001/api/turmas/{tid}', timeout=10)
    turma = json.loads(r2.read())
    for a in turma.get('alunos', [])[:3]:
        print(f'  {a["nome"]}')
        print(f'    dataInicioMatric: {a.get("dataInicioMatric", "N/A")}')
        print(f'    dataFimMatric: {a.get("dataFimMatric", "N/A")}')

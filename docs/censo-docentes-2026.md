# Censo Docentes 2026

Nova aba do Diário de Classe para preparar o preenchimento do formulário oficial da Secretaria de Educação.

## Fontes usadas

- `ServidorCenso`: RF ativo, nome, cargo, período e escola.
- `Turma`: turma/atuação e modalidade sugerida.
- Ficha cadastral XLS/XLSX importada localmente na própria tela.
- Folha de frequência: será adicionada como validação final dos vínculos em exercício.

## Regras principais

1. O RF ativo do cadastro funcional tem prioridade.
2. A ficha cadastral é cruzada primeiro por RF e depois por nome normalizado.
3. RFs históricos permanecem apenas como histórico e não substituem o vínculo atual.
4. Cor/raça, deficiência/TEA, nacionalidade e declaração final não são inferidos automaticamente.
5. O botão `Abrir + RF` abre o formulário oficial e copia o RF atual para acelerar o preenchimento.

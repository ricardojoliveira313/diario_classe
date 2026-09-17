update public."CensoDocenteMestre"
set dados = (
  dados - array[
    '2º Tipo',
    '2º Área',
    '2º Curso — sugestão Censo',
    '2º Curso — declarado na ficha',
    '2º Ano Conclusão',
    '2º UF Instituição',
    '2º Categoria/Org.',
    '2º Instituição',
    '2º Cópia entregue UE'
  ]::text[]
) || jsonb_build_object(
  '1º UF Instituição', 'SP',
  '1º Categoria/Org.', 'PRIVADA',
  '1º Instituição', 'Faculdades Integradas Senador Fláquer'
)
where ano = 2026
  and rf = '417467';

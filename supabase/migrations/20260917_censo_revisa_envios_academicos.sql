-- Auditoria dos envios do Censo Docentes realizada em 17/09/2026.
--
-- Não apaga comprovantes nem respostas oficiais. Apenas retira do estado
-- "enviado/concluído" os envios que precisam de reconferência acadêmica e
-- grava o motivo no próprio JSON de auditoria.
--
-- A condição status='enviado' torna o script idempotente: depois de revisado,
-- rodar novamente não altera o registro.

update public."CensoEnvioLog"
set status = 'revisao_necessaria',
    resposta = coalesce(resposta, '{}'::jsonb) || jsonb_build_object(
      'auditoria_20260917',
      jsonb_build_object(
        'status_original', 'enviado',
        'revisao_em', now(),
        'motivo', case regexp_replace(coalesce(rf,''),'\D','','g')
          when '595608' then 'Comprovante declarou não possuir pós-graduação, mas ficha cadastral da mesma identidade registra posPossui=SIM e dois cursos; exige reconferência antes de considerar concluído.'
          when '554472' then 'Comprovante enviou duas especializações como área Educação; Educacenso atual registra a segunda como Saúde e bem-estar, e a ficha histórica vinculada possui origem identitária divergente.'
          when '614513' then 'Duas pós-graduações foram preenchidas a partir de bloco acadêmico cuja origem histórica diverge em CPF/data de nascimento; Educacenso atual não informa pós-graduação.'
          else 'Revisão acadêmica necessária após auditoria de origem.'
        end
      )
    )
where status = 'enviado'
  and regexp_replace(coalesce(rf,''),'\D','','g') in ('595608','554472','614513');

# Censo Docentes — sincronização da coleta individual com o envio oficial

Quando um RF que possui convite individual é registrado em `CensoEnvioLog` com status `enviado` ou `confirmado_secretaria`, qualquer convite ainda `aberto` ou `respondido` é encerrado automaticamente como `cancelado`.

No painel **Coleta individual com professores**, o RF continua visível para fins de controle e passa a aparecer como **CONFERIDO E ENVIADO** ou **CONFIRMADO PELA SECRETARIA**, com a data/hora do registro oficial. O link individual deixa de oferecer qualquer ação.

O painel consulta essa situação periodicamente e também permite atualização manual.
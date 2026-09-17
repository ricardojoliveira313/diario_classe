# Censo oficial bridge

Backend server-side da integração direta do Censo Docentes.

- Acesso do navegador restrito ao domínio do Diário e localhost de desenvolvimento.
- Reautenticação específica do usuário administrativo autorizado.
- Sessão curta, com token aleatório armazenado no navegador apenas em `sessionStorage`; o banco guarda somente o hash SHA-256.
- Dados sensíveis de ficha e perfis são consultados somente no servidor com `service_role` e somente após selecionar um RF docente válido na competência de frequência escolhida na tela.
- A tela seleciona por padrão a competência mais recente disponível e envia ano/mês ao backend, que repete a validação antes de preparar e antes de enviar.
- A formação acadêmica usa primeiro os campos oficiais validados da base estruturada; a ficha histórica só atua como complemento quando a identidade é compatível.
- Antes de enviar, o backend reconfirma o RF no formulário oficial e compara nome + CPF.
- O envio exige confirmação explícita do usuário e gera registro de auditoria.
- O botão/link do formulário oficial permanece como fallback manual.

A função implantada no Supabase deve corresponder ao `index.ts` deste diretório. A migration associada está em `supabase/migrations/20260914_censo_integracao_direta_segura.sql`.

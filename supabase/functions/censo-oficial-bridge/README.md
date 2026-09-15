# Censo oficial bridge

Backend server-side da integração direta do Censo Docentes.

- Acesso do navegador restrito ao domínio do Diário e localhost de desenvolvimento.
- Reautenticação específica do usuário administrativo autorizado.
- Sessão curta, com token aleatório armazenado no navegador apenas em `sessionStorage`; o banco guarda somente o hash SHA-256.
- Dados sensíveis de ficha e perfis são consultados somente no servidor com `service_role` e somente após selecionar um RF válido da frequência de setembro/2026.
- Antes de enviar, o backend reconfirma o RF no formulário oficial e compara nome + CPF.
- O envio exige confirmação explícita do usuário e gera registro de auditoria.
- O botão/link do formulário oficial permanece como fallback manual.

A função implantada no Supabase deve corresponder ao `index.ts` deste diretório. A migration associada está em `supabase/migrations/20260914_censo_integracao_direta_segura.sql`.

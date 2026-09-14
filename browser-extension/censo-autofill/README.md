# Extensão Censo Docentes - Diário de Classe

Extensão local para Edge/Chrome que faz a ponte entre o Diário de Classe e o formulário oficial do Cadastro Censo Escolar 2026.

## O que ela faz

1. Recebe do Diário o pacote do professor selecionado.
2. Abre o formulário oficial da Secretaria.
3. Preenche o RF.
4. Confere se RF + nome exibidos no modal correspondem ao professor selecionado.
5. Confirma o modal somente quando os dois dados conferem.
6. Preenche os campos objetivos já conhecidos.
7. **Nunca envia o formulário automaticamente.**

Campos autodeclaratórios/sensíveis (Cor/Raça, deficiência/TEA etc.), formação complexa, pós-graduação e declaração final ficam para conferência humana.

## Instalação no Microsoft Edge

1. Abra `edge://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione esta pasta `browser-extension/censo-autofill`.
5. Recarregue o Diário de Classe.

Quando estiver ativa, a aba Censo Docentes mostrará **🤖 Autopreenchimento ativo**.

## Segurança

- Os dados ficam no armazenamento local da extensão apenas para transferir o cadastro entre as duas páginas.
- O pacote expira logicamente após 10 minutos.
- Não há envio para servidor de terceiros além do formulário oficial que o próprio usuário abriu.
- O formulário oficial nunca é submetido automaticamente.

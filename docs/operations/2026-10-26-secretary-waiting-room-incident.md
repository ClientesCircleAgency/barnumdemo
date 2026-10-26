# Sala de Espera: erro reportado por secretária

Estado: causa do incidente por confirmar. Não considerar corrigido apenas pela publicação do diagnóstico.

- Sintoma: secretária recebe «erro ao atualizar o estado»; administrador consegue mover.
- Schema de produção inspecionado em 26/10: `can_manage_appointments` inclui `secretary`; RPC de estado acessível a `authenticated`, com autorização interna.
- Teste local com role secretária: criação, leitura, movimentos para waiting/in_progress/completed passaram. Fixtures revertidas; zero triggers HTTP no ambiente local.
- `version` é NOT NULL DEFAULT 1; campos de conclusão opcionais não demonstram a causa.
- Não foi usada nem solicitada a password da secretária. A conta afetada e a resposta técnica do pedido falhado ainda não foram identificadas.

Alteração de diagnóstico: mensagens conhecidas para concorrência, permissões, sessão, transição inválida, leitura e rede; fallback com código técnico validado. Nunca mostrar detalhes arbitrários do servidor nem dados de pacientes. Toast durante 12 segundos em movimento e conclusão.

Após publicação, atualizar a página da secretária e recolher a mensagem/código apresentado numa tentativa normal. Não alterar permissões nem dados por hipótese.

# Tratamentos — análise preliminar de compatibilidade para Samuel/agente

Estado em 27/10/2026: protótipo aprovado, sem migrações de Tratamentos implementadas. Este documento define o que auditar; não certifica código ou BD ainda inexistentes. Nenhuma alteração de produção foi efetuada nesta análise.

## Contrato existente a preservar

- `save_appointment_team`: grava uma consulta real e respetiva equipa, com `professional_names` completo na gravação que gera o evento inicial.
- `set_appointment_state`: controla estados, versão e conclusão. `final_notes` integra o fluxo existente de mensagens; não reutilizar para observações médicas internas. Preservar `send_review` e a data original `finalized_at`.
- Conversão de pedidos: PATCH `status=converted` + `accepted_slot` continua suportado, com equipa, tipo e duração. `source_request_id` identifica o pedido; não o reutilizar para tratamento.
- `appointments` e `appointment_requests` têm webhooks de produção. Um UPDATE técnico pode gerar evento mesmo sem alterar data ou estado. Conversão já pode produzir INSERT + UPDATE; filtros/deduplicação são necessários.
- Workbench: webhooks externos desligados. Não importar exports de produção sem sanitização.

## Matriz de impacto prevista — sujeita a implementação e testes

| Ação | Implementação pretendida | Impacto no n8n |
|---|---|---|
| Criar tratamento/etapas sem data | Tabelas próprias, sem appointments nem webhooks externos | Nenhuma mensagem prevista; provar ausência de eventos |
| Comentar/editar observações internas | Tabelas próprias, autoria, auditoria e acesso controlado | Nenhuma mensagem ou conteúdo clínico externo; provar que appointments não é atualizado como efeito lateral |
| Marcar etapa | Criar appointment pelo fluxo de equipa existente e ligar à etapa | Confirmação normal esperada; não é uma operação sem impacto |
| Reagendar/cancelar consulta | Atualizar a mesma consulta com o contrato atual | Mensagens normais previstas; garantir ausência de duplicados |
| Concluir consulta | Manter notas internas separadas das notas para o paciente | Preservar a avaliação atual; não enviar comentários clínicos |
| Encerrar tratamento manualmente | Alterar apenas o estado do tratamento | Nenhuma alteração automática aos estados das consultas nem avaliação adicional |
| Associar consulta existente a uma etapa | Preferir relação interna sem tocar na linha appointments | Evitar evento técnico; se a implementação exigir UPDATE em appointments, validar filtro n8n |
| Marcar várias etapas | Vários appointments reais | Pode haver uma confirmação por consulta. Uma mensagem consolidada exige alteração explícita no n8n e decisão de produto |

## Desenho de integração recomendado, ainda não implementado

Guardar o vínculo na etapa (`appointment_id` único e opcional), preservando appointments avulsos e evitando um segundo UPDATE só para ligar o tratamento. Uma consulta só pode pertencer a uma etapa/tratamento; validar que paciente da etapa e consulta coincidem. Nomes de tabelas e RPCs definitivos ficam na especificação.

Marcação deve ser atómica: criação da consulta e ligação à etapa confirmam juntas. Uma repetição/retry da marcação não cria outra consulta. A verificação de disponibilidade deve considerar todos os médicos e toda a duração, reutilizando a lógica existente.

Comentários são por consulta/etapa, não conversa geral. Todos os médicos leem; só os participantes da consulta, secretárias e admins comentam. Autor edita o próprio texto se ainda autorizado; admins editam qualquer texto, preservando autor e histórico. Nenhuma destas operações deve acionar mensagens externas.

## O que precisamos do agente do Samuel

Ainda não existe patch obrigatório identificado no n8n para Tratamentos. Antes da validação final, confirmar com a versão atual dos workflows:

1. Que filtros distinguem criação/reagendamento/cancelamento de atualizações técnicas e como é feita a deduplicação por consulta/evento.
2. Quais os campos efetivamente usados nas confirmações, lembretes e avaliações; se existe encaminhamento do record completo para serviços externos.
3. Que a correção de contactos B–E e a reabertura/conclusão não causam reenvios. A validação posterior a `05d2218` não está registada como concluída.
4. Para cada consulta criada através do tratamento: uma confirmação esperada, com nomes corretos; sem confirmação adicional por ligar a etapa ou comentar.
5. Se for escolhida marcação de todo o tratamento numa operação, acordar previamente se serão várias mensagens ou uma mensagem consolidada. Não presumir suporte a lotes.

Testes externos apenas com dados fictícios e o número autorizado pelo Samuel; não usar pacientes reais. A correção dos webhooks públicos e a rotação de chaves continuam trabalhos coordenados separados, sem assumir que já foram concluídos.

## Evidência necessária para fechar a auditoria

Migração e diff revistos; testes locais de schema/RLS/RPC; observadores locais a demonstrar eventos e ausência de texto interno; testes de consultas avulsas/equipas/WhatsApp existentes; idempotência e rollback; confirmação do agente do Samuel para os casos externos afetados. Só depois classificar a implementação como compatível, indicando as limitações que subsistirem.

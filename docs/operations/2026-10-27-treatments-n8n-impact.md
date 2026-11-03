# Tratamentos — análise preliminar de compatibilidade para Samuel/agente

> Atualização 02/11/2026: integração local concluída; a análise abaixo preserva o checkpoint histórico de 27/10. O documento de respostas do Samuel já foi recebido. Consultar [validação atual](2026-11-02-treatments-validation.md) e [contrato atualizado para Samuel](2026-11-02-tratamentos-contrato-para-samuel.md), incluindo a proteção de colisões de pacientes. Tratamentos ainda não publicados.

Estado em 27/10/2026: três migrações implementadas e aplicadas exclusivamente no Docker local. A integração completa na interface e a validação ponta a ponta ainda estão em curso. Nenhuma alteração de produção foi efetuada nesta análise. As secções de previsão abaixo continuam a distinguir os casos ainda não medidos; os resultados efetivos estão nesta atualização.

## Atualização: evidência local e orientação para o agente do Samuel

### Objetos implementados

Aplicar futuramente por esta ordem, apenas depois da validação final:

1. `20261027042724_treatments_schema.sql`: treatments, treatment_professionals, treatment_sessions, treatment_session_professionals e treatment_state_events; permissões e gestão dos planos.
2. `20261027042857_treatment_booking.sql`: `book_treatment_sessions(uuid,jsonb)` e `link_treatment_appointment(uuid,bigint,uuid)`; validação do vínculo paciente/especialidade.
3. `20261027043038_treatment_clinical_records.sql`: treatment_session_comments, treatment_comment_revisions, appointment_clinical_observations e clinical_observation_revisions; gravação, revisões, leitura do contexto e conclusão atómica.

As migrações não substituem as assinaturas de `save_appointment_team` nem de `set_appointment_state`. Não adicionam colunas clínicas a appointments, não fazem backfill e não eliminam dados existentes. A etapa guarda `appointment_id`, único e opcional. A RPC de marcação reutiliza `save_appointment_team`; a conclusão nova reutiliza `set_appointment_state` na mesma transação.

### Eventos efetivamente medidos

O teste `supabase/tests/treatment_events.test.sql` instala um observador transacional local, captura a linha inteira de appointments e termina com ROLLBACK. Não envia HTTP.

| Operação testada | Eventos appointments |
|---|---|
| Criar tratamento e etapa, criar e editar comentário | 0 |
| Marcar uma etapa e ligar a consulta | 1 INSERT, 0 UPDATE |
| Repetir exatamente a marcação | 0 eventos adicionais |
| Concluir com texto público e observação interna | 1 UPDATE |
| Repetir a conclusão já aplicada | 0 eventos adicionais |
| Encerrar o tratamento após conclusão | 0 eventos adicionais |

O payload completo capturado não contém os marcadores usados nos comentários nem na observação médica. `final_notes` contém apenas a mensagem pública. Isto demonstra separação no fluxo local testado; não certifica workflows externos que consultem diretamente outras tabelas.

Outros testes locais passaram: permissões, autoria e revisões; rollback de lote com conflito; repetição idempotente; duas transações da mesma etapa criam uma consulta; duas etapas concorrentes disputando o mesmo médico/hora aceitam apenas uma. Um médico retirado da equipa perde escrita, incluindo nos próprios textos; o novo participante ganha escrita.

Verificação final deste checkpoint: **107 assertions SQL em oito suites**, incluindo consultas/equipas, conversão de pedidos e hardening existentes; **69 testes Vitest em 18 ficheiros**; TypeScript sem erros; build concluído. O build mantém avisos sobre tamanho dos bundles e dados Browserslist desatualizados. Estes resultados validam o código presente, não funcionalidades de interface ainda por integrar nem o n8n remoto.

### Impacto real a rever no n8n

- **Eventos normais continuam a existir:** uma marcação cria uma consulta real; a conclusão atualiza-a. Não classificar estas ações como “sem impacto”. São os eventos que as automações já consomem.
- **Nova restrição intencional:** o trigger `guard_treatment_patient_link` rejeita alterações de patient_id ou specialty_id que deixem uma consulta ligada incompatível com o tratamento. Consultas avulsas não têm esse vínculo. Se algum node mudar esses campos para corrigir/reassociar uma consulta ligada, poderá receber `patient_or_specialty_mismatch`. Confirmar se existe esse comportamento antes de publicar; não remover a proteção para contornar o erro.
- **Lotes:** cada sessão marcada cria um appointment e pode originar uma mensagem. A transação é única, mas os eventos não são consolidados numa mensagem. Não existe funcionalidade nova de mensagem agregada.
- **Não é necessário chamar a nova conclusão no n8n** para manter o comportamento existente. `finalize_appointment_with_observation(uuid,bigint,text,boolean,text)` serve a aplicação quando há registo clínico interno; o contrato atual de `set_appointment_state` continua disponível.
- Não consultar, copiar ou acrescentar às mensagens as quatro tabelas de comentários/observações/revisões. Estes textos são internos.

Exemplo fictício da marcação (chamada da aplicação, não requisito para alterar o n8n):

```json
{
  "p_treatment_id": "10000000-0000-0000-0000-000000000001",
  "p_slots": [{
    "session_id": "20000000-0000-0000-0000-000000000001",
    "expected_version": 1,
    "date": "2026-11-10",
    "time": "10:00"
  }]
}
```

### O que ainda impede certificar/publicar

Faltam a integração e validação integral da UI, mais casos da matriz abaixo, revisão independente e comparação com o schema remoto atual. As regressões SQL existentes de conversão passaram localmente; a execução real pelo WhatsApp continua por validar. O agente do Samuel deve confirmar os filtros/deduplicação dos workflows atuais e a ausência de alterações incompatíveis de paciente/especialidade. Depois, testar ponta a ponta com dados fictícios e o número autorizado: confirmação, lembrete, conclusão/review e lote.

Publicação futura: validar primeiro as migrações e dependências num ambiente isolado; preparar recuperação/backup; aplicar BD aditiva antes do frontend que chama as novas RPCs; só depois disponibilizar a interface. Se houver problema, voltar ao frontend anterior preservando tabelas e dados novos. Não fazer DROP das tabelas clínicas como rollback. Tratar qualquer correção de BD com migração corretiva e verificar novamente os contratos do n8n.

**Conclusão atual:** os casos locais medidos preservam os eventos normais e isolam os textos internos. Não há ainda evidência suficiente para certificar toda a versão ou afirmar que não exige qualquer validação do Samuel.

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

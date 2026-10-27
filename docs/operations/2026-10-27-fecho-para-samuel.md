# Fecho das correções e prevenção de mensagens perdidas

27/10/2026. Documento para o utilizador entregar ao Samuel/agente. Não foi enviado automaticamente. Não constitui relatório de publicação.

## 1. Pacote de correções pronto para validação conjunta

Base de produção confirmada por fetch: `origin/dev` em `05d2218`. Branch local de entrega: `release/samuel-followup`, primeiro commit `0cf36d4`. Contém apenas as cinco correções de `2026-10-27-samuel-followup.md`, os testes e a remoção do ficheiro local sensível do controlo de versões. Não inclui schema, hooks ou interface de Tratamentos.

Migração única: `20261027151407_samuel_followup_safety.sql`. Antes de a aplicar remotamente, comparar as funções atuais de produção com a base; não sobrescrever alterações posteriores do parceiro. Aplicar BD antes do frontend. A branch `dev` publica automaticamente; a branch de entrega não deve ser confundida com produção.

Samuel precisa de confirmar dois contratos concretos:

1. `p_final_notes = null`/omitido significa manter; `p_final_notes = ""` significa apagar. Garantir que nenhum node envia vazio quando pretende preservar notas.
2. Um UPDATE exclusivamente de nome/telefone pode conservar `version`. Não é nova consulta, reagendamento nem conclusão; A1 não deve enviar uma mensagem por esse UPDATE. Consultas concluídas há mais de 4h deixam de ter os contactos históricos reescritos.

Testar com o número autorizado: apagar notas após reabertura e concluir, corrigir contacto com modal aberto, converter pedido com contacto diferente, criar paciente com NIF já existente, pedido público normal. Não usar pacientes reais nem inventar confirmações de execução.

## 2. Decisão proposta para prevenção (não implementada nem ativada)

Objetivo: recuperar mensagens que nem chegaram a ser processadas, complementando os retries/alertas que Samuel já implementou. Não criar um segundo sender independente a competir com A2/A6.

**Abordagem recomendada:** A2 e A6 passam a consultar pendências a cada 10 minutos e usam o mesmo registo de entregas tanto no horário normal como na recuperação. O horário normal das 8h de Lisboa e o início dos pedidos de avaliação 2h após conclusão mantêm-se. Regras propostas para validação do parceiro:

- Lembretes: recuperar apenas durante o dia anterior à consulta, entre 08:00 e 20:00 Europe/Lisbon. Não enviar um lembrete atrasado quando a consulta já passou ou deixou de estar confirmada.
- Avaliações: elegíveis entre 2h e 24h após finalized_at, com estado completed e send_review=true, entre 08:00 e 20:00. Ativação tardia de review só recupera dentro desta janela.
- Fora da janela ou com envio incerto: alerta ao Samuel, sem envio automático tardio.
- Cancelamento, falta, reabertura ou desativação de review invalida a pendência correspondente. Rever novamente estado e destino imediatamente antes de enviar.
- Reagendamento invalida o lembrete do horário anterior; o novo horário recebe identidade própria. Alterar só a equipa ou o telefone não cria outro lembrete para o mesmo horário.

Estes limites são uma proposta conservadora para fechar a decisão, não descrição do comportamento hoje em produção. Se o parceiro precisar de limites diferentes, ajustar antes de implementar/ativar.

## 3. Registo de entrega mínimo e contrato a acordar

Preferir uma tabela interna separada, sem webhook, em vez de atualizar appointments apenas para assinalar envio. Campos propostos: appointment_id, kind (reminder/review), occurrence_key, state, attempt_token, attempt_count, reserved_at, provider_message_id, sent_at, last_error_code. Sem texto clínico, conteúdo da mensagem ou segredos. RLS sem acesso público; mutações apenas por RPC autorizada ao serviço.

Unicidade obrigatória: `(appointment_id, kind, occurrence_key)`.

- Reminder occurrence_key: data e hora da consulta, normalizadas em Europe/Lisbon. Nunca usar a version genérica, que também muda por outras ações.
- Review occurrence_key: finalized_at original. Reabrir e concluir mantém essa data, pelo que não gera segunda avaliação já enviada.

As RPCs futuras devem reservar atomicamente uma pendência, devolver um token único da tentativa e aceitar conclusão apenas com esse token. Duas execuções concorrentes não podem obter a mesma reserva. Não confirmar o envio antes de o fornecedor o aceitar.

Estados mínimos: pending, reserved, sent, failed, unknown, expired. Distinção essencial:

| Resultado | Ação |
|---|---|
| Fornecedor confirmou aceitação e devolveu ID | Registar sent e provider_message_id; nunca repetir automaticamente |
| Rejeição comprovada, sem mensagem criada | Retry limitado com intervalo, reutilizando a identidade da mensagem |
| Timeout ou processo termina depois de iniciar a chamada | unknown; verificar o fornecedor/alertar antes de repetir |
| Reserva abandonada | Não presumir que nada foi enviado; investigar como unknown |

Samuel deve confirmar se a versão de UAZAPI usada suporta idempotência ou consulta fiável do resultado. Sem essa garantia, não prometer “exatamente uma entrega”: o comportamento seguro é reter resultados incertos para revisão. Não sobrepor retries novos aos existentes sem mapear onde cada retry ocorre.

Para avaliações recuperadas depois de 4h, ler o contacto atual da ficha verificada do paciente; o snapshot histórico de appointments já não é sincronizado após essa janela. Ler final_notes/send_review atuais; nunca ler tabelas de observações clínicas ou comentários de tratamentos para mensagens.

## 4. Ativação sem reenviar mensagens antigas

1. Samuel disponibiliza o contrato atual de A2/A6 e capacidades do fornecedor; alinhar os pontos acima.
2. Implementar e testar tabela/RPCs localmente; implementar o uso dessas RPCs no n8n. Não criar colunas isoladas como se isso bastasse.
3. Definir um instante de corte e importar apenas confirmações de envio que sejam comprováveis. Ausência de registo antigo não significa que não houve envio.
4. Na primeira ativação, excluir da recuperação automática as ocorrências anteriores ao corte sem prova do estado. Usar alerta/revisão, não reenvio em massa.
5. Fazer o sender normal e a recuperação passarem pelo mesmo mecanismo antes de ativar o polling novo. Não manter dois caminhos de envio em paralelo.
6. Testar: duas execuções simultâneas; falha comprovada; timeout após aceitação; processo interrompido; reagendamento; cancelamento; review desligado/ligado tarde; mudança de hora de Lisboa; nenhuma mensagem histórica inesperada.
7. Se houver incidente, suspender o novo polling e preservar o registo. Não voltar ao sender antigo sem considerar mensagens já enviadas pelo novo.

## 5. Segurança e bloqueios externos

- Repositório confirmado público. A sessão de navegador disponível devolveu 404 nas definições do repositório, logo não permitiu alterar a visibilidade. O conector tem acesso a metadados mas não expõe alteração de visibilidade. Tornar privado continua pendente.
- A remoção do ficheiro de credenciais está no pacote. Chaves antigas continuam válidas até rotação; não afirmar contenção completa com remoção de ficheiro ou mudança de visibilidade.
- A rotação precisa de janela comum: inventariar site, Edge Functions, n8n e restantes consumidores; criar/substituir credenciais; testar; revogar antigas; verificar rejeição das antigas. Usar canal seguro, nunca este documento.
- O segredo dos dois Database Webhooks precisa de ser disponibilizado por canal seguro. Acrescentar o header sem mudar URLs/eventos, validar a receção e só então ligar a verificação no n8n.
- Rever a conta demo de administrador e sessões ativas antes de a dar como neutralizada. Não testámos a password pública nem alterámos contas reais.

## Resultado necessário para fechar

Correções publicadas e verificadas, contratos A1/A6 confirmados, segurança remota resolvida e prevenção implementada/testada dos dois lados. Até lá, o que está pronto é o pacote local e este acordo técnico; não existe recuperação automática nova em produção.

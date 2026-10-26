# Barnun — consultas com vários profissionais

Data: 24 de outubro de 2026.
Estado: decisões funcionais acordadas; especificação pronta para revisão escrita. Implementação ainda não iniciada.

## Objetivo

Permitir associar outro médico a uma consulta, através de «Adicionar profissional» por baixo do médico principal. A consulta ocupa a agenda de todos os participantes durante toda a sua duração e apresenta todos os médicos nos detalhes e no histórico. Existe uma única consulta, com um único estado, paciente, horário e duração.

## Decisões acordadas

- O médico adicional cumpre os mesmos requisitos do principal: especialidade, tipo de consulta, horário de trabalho, ausência de férias/folgas e disponibilidade durante todo o intervalo.
- Todos os médicos participam desde o início até ao fim. Não existem segmentos individuais de tempo.
- Os médicos associados podem consultar os detalhes e acrescentar notas identificadas com o respetivo autor.
- Apenas secretárias e administradores podem reagendar, alterar os profissionais ou cancelar a consulta.
- O médico principal, os médicos adicionais, as secretárias e os administradores podem concluir a consulta. Uma conclusão atualiza a consulta para todos.
- O novo perfil de médico com informação de outros pacientes ocultada fica para um plano separado. Esta funcionalidade não redefine o acesso global a pacientes.

## Experiência na aplicação

Na confirmação de um pedido, criação manual e edição de uma consulta, apresentar o médico principal seguido de «Adicionar profissional». Cada profissional adicional tem um seletor e uma ação «Remover». Não permitir selecionar o principal novamente nem repetir adicionais. Uma consulta pode continuar a ter apenas o principal.

Os seletores apresentam profissionais elegíveis para a especialidade, tipo, data, hora e duração escolhidos. Alterar estes campos volta a validar toda a equipa. Uma seleção que deixe de ser válida fica assinalada e impede guardar; não se remove silenciosamente um médico.

Mostrar o motivo de indisponibilidade quando uma seleção existente deixa de ser válida. Se os dados de disponibilidade não carregarem, impedir a confirmação e permitir tentar novamente. Antes de guardar, o servidor volta a verificar as condições: a lista apresentada pode ter ficado desatualizada.

Na agenda geral, a consulta conta uma vez. Na agenda filtrada de cada participante, aparece a mesma consulta. Em vistas com uma coluna por médico, pode aparecer em cada coluna, sempre ligada ao mesmo identificador. Detalhes, histórico do paciente e sala de espera mostram todos os nomes, identificando o principal.

## Modelo de dados e compatibilidade

Manter `appointments.professional_id` como fonte do médico principal, preservando os contratos existentes. Acrescentar uma relação de profissionais adicionais, proposta como `appointment_additional_professionals`, com chave composta por consulta e profissional e referências às entidades existentes. A relação contém apenas os adicionais; o conjunto completo é a união com o principal.

Impedir duplicados e impedir que o principal também exista na relação de adicionais, incluindo em alterações do principal. Consultas existentes, sem linhas adicionais, mantêm o comportamento de um único médico. A migração é aditiva e não elimina dados.

Centralizar a leitura da equipa para que agendas, histórico, disponibilidade e permissões usem a mesma definição. Os registos históricos mantêm as associações após conclusão ou cancelamento; desativar um profissional não deve apagar a sua participação histórica.

Na confirmação direta de um pedido, enviar a equipa selecionada juntamente com os restantes dados à operação de conversão. A consulta e todos os participantes são criados na mesma transação; o pedido só fica convertido se a operação completa tiver sucesso.

Para propostas de horários alternativos, cada opção guarda a equipa a que se refere, mantendo o campo escalar do principal para compatibilidade. A aceitação volta a validar todos os participantes. Opções antigas sem equipa adicional equivalem a uma consulta apenas com o principal. Uma proposta pendente não reserva a agenda.

## Disponibilidade e gravação

Usar uma regra comum para criação manual, confirmação de pedidos, alternativas, edição e reagendamento. Para cada participante, verificar requisitos profissionais, horário semanal, férias/folgas e conflitos tanto como principal como adicional noutras consultas.

O intervalo é do início, inclusive, ao fim, exclusive: uma consulta pode começar exatamente quando outra termina. Validar a duração completa no horário local da clínica, Europe/Lisbon. Preservar as convenções existentes para profissionais sem configuração explícita de horários e os estados que ocupam agenda; uma consulta cancelada liberta o intervalo para todos.

A validação no cliente melhora a interação; a validação no servidor é obrigatória. Gravar consulta e equipa atomicamente, sem estados em que só um médico ficou reservado. Uma falha mantém intactos o pedido ou a consulta anteriores e identifica o conflito.

Serializar gravações concorrentes que envolvam os mesmos profissionais, adquirindo os bloqueios numa ordem consistente e verificando conflitos depois de adquirir os bloqueios. Todos os caminhos de escrita relevantes, incluindo integrações, devem respeitar esta garantia. Não basta validar antes de inserir nem proteger apenas a interface.

Aplicar autorização no servidor e impedir alterações diretas às tabelas que contornem as operações autorizadas. Na edição, validar também a versão da consulta para evitar que dois utilizadores sobrescrevam alterações recentes.

## Ciclo de vida e permissões

| Ação | Principal | Adicional associado | Secretária | Admin |
|---|---|---|---|---|
| Ver a consulta partilhada | Sim | Sim | Sim | Sim |
| Acrescentar notas com autoria | Sim | Sim | Sim | Sim |
| Concluir | Sim | Sim | Sim | Sim |
| Reagendar | Não | Não | Sim | Sim |
| Alterar equipa | Não | Não | Sim | Sim |
| Cancelar | Não | Não | Sim | Sim |

Esta matriz trata consultas partilhadas e não concede acesso adicional a médicos que não participam nelas. Preservar as regras existentes para edição de notas; acrescentar participação não permite alterar a autoria de outra pessoa.

Reagendar move toda a equipa após validar o novo intervalo. Remover um adicional liberta apenas esse profissional. Cancelar liberta todos. Concluir altera o estado uma única vez, registando quem executou a ação; duas tentativas concorrentes de conclusão não produzem dois eventos nem duas notificações.

Sala de espera e estados de atendimento pertencem à consulta, sem um estado independente por médico. Atualizações devem refletir-se nas sessões abertas dos participantes, com atualização das consultas de dados e subscrição de alterações relevantes. Uma falha de ligação deve permitir recuperar o estado atual ao reconectar.

## Notificações e integrações

O paciente recebe uma mensagem por evento da consulta, independentemente do número de médicos. Identificar os eventos pela consulta e transição, sem emitir um evento por linha de participante.

Preservar os campos existentes do médico principal e acrescentar a equipa quando necessário. Verificar os consumidores e automações antes de alterar formatos. O trabalho do Samuel nas notificações não deve ser sobrescrito; alterações externas necessárias devem ser coordenadas através do contrato de dados. A validação final inclui confirmar que as mensagens não duplicam.

## Áreas identificadas no código

- `src/types/clinic.ts` e `src/context/ClinicContext.tsx`: representação e mapeamento da consulta, atualmente centrados no principal.
- `src/hooks/useAppointments.ts` e `src/hooks/useAppointmentRequests.ts`: leitura, gravação e conversão de pedidos.
- `src/components/admin/AppointmentWizard.tsx`, `src/pages/admin/RequestsPage.tsx` e `src/components/admin/SuggestAlternativesModal.tsx`: seleção de equipa e validação.
- `src/utils/availability.ts` e `src/utils/professionalWorkingHours.ts`: reunir as regras de conflitos e horários usadas pelos diferentes fluxos.
- `src/components/admin/WeekView.tsx`, `src/pages/admin/PatientDetailPage.tsx`, `src/pages/admin/WaitingRoomPage.tsx` e `src/components/admin/AppointmentDetailDrawer.tsx`: filtros, nomes, ações e estado partilhado.
- Migrações e operações da base de dados: participantes, validação transacional, autorização e concorrência.

Estes pontos resultam da exploração existente. O plano técnico deve confirmar todos os consumidores do identificador do principal e os contratos de alternativas e automações antes de listar as alterações concretas.

## Ordem de construção

1. **Dados e regras no servidor:** relações, leitura da equipa, autorização, disponibilidade comum e gravação transacional com proteção contra concorrência.
2. **Formulários:** adicionar/remover profissionais na confirmação de pedidos, criação manual, edição e alternativas; apresentar erros compreensíveis.
3. **Agendas e histórico:** incluir cada participante nos filtros, apresentar todos os nomes e manter contagens globais sem duplicação.
4. **Ciclo de vida e sincronização:** reagendar, cancelar, concluir, notas, sala de espera, sessões abertas e contratos de notificações.
5. **Validação e publicação:** executar os cenários de aceitação, confirmar compatibilidade com consultas antigas e verificar as automações afetadas.

Esta sequência define dependências do desenho; o plano de implementação detalhado será preparado após a revisão desta especificação.

## Critérios de aceitação

1. Uma consulta com dois médicos ocupa o mesmo intervalo nas duas agendas e aparece uma única vez no histórico, com os dois nomes.
2. Não é possível adicionar o principal novamente ou repetir um adicional.
3. Um adicional sem a especialidade/tipo exigidos, fora do horário, em folga ou ocupado é recusado. O cenário de segunda-feira às 13h para um médico que começa às 16h falha em todos os fluxos.
4. Um conflito em que o médico está como adicional noutra consulta também impede a marcação. Intervalos adjacentes são permitidos.
5. Falhar a reserva de um participante não cria consulta parcial nem marca o pedido como convertido.
6. Duas marcações simultâneas para o mesmo médico e intervalo não são ambas aceites, mesmo quando este é principal numa e adicional noutra.
7. Reagendar atualiza todos; um conflito conserva o horário original. Remover um adicional conserva a consulta e liberta apenas esse profissional.
8. Cancelar liberta as agendas de todos e preserva o histórico. Concluir pelo principal, adicional, secretária ou admin atualiza todos uma única vez.
9. Os médicos associados conseguem acrescentar notas com autoria; tentativas de reagendar, alterar equipa ou cancelar através da API são recusadas.
10. A aceitação de uma alternativa revalida a equipa completa. Uma opção antiga mantém compatibilidade com um único médico.
11. Sessões abertas refletem alterações de estado, horário e equipa; após reconexão recuperam os dados atuais.
12. O paciente recebe uma única notificação por evento, e as consultas antigas continuam a funcionar.

## Fora deste trabalho

Novo perfil de médico com dados ocultados, participação apenas numa parte da consulta, faturação por participante, reformulação visual global, limpeza de dados e alterações independentes aos contactos ou à marca.

## Revisão da especificação

Revisão interna realizada quanto a âmbito, coerência e critérios verificáveis. A distinção entre consulta única e participação múltipla, a duração integral, a conclusão pelos quatro intervenientes e a restrição das alterações de agenda estão refletidas acima. Este documento não representa uma implementação nem uma validação em produção.

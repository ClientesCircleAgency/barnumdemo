# Tratamentos, sessões e comentários clínicos — desenho

Data: 27/10/2026. Estado: desenho visual e regras conversacionais aprovados; especificação escrita pronta para revisão. Não implementado na aplicação ou na BD. Protótipo: `prototypes/treatments/`, branch `workbench/barnun`.

## Objetivo e âmbito

Organizar o tratamento de um paciente como uma sequência de consultas/cirurgias, planeáveis antes de terem data. Permitir acompanhar evolução, marcar consultas reais com disponibilidade da equipa, registar observações internas e comentar cada sessão. Preservar consultas avulsas e o funcionamento atual do n8n.

O tratamento contém nome, paciente, especialidade, objetivo, equipa e estado. Cada sessão contém nome, tipo (consulta/cirurgia), tipo de consulta existente, duração, equipa prevista e ordem. Contadores mostram sessões concluídas, marcadas e por marcar, além do total de consultas e cirurgias. Não inferir conclusão clínica a partir da última marcação: o tratamento é encerrado manualmente.

## Desenho aprovado

Nova aba Tratamentos na ficha do paciente, com lista de tratamentos e acesso ao detalhe. Cabeçalho do detalhe com objetivo, especialidade, equipa e progresso. Cada linha apresenta a sessão à esquerda e exclusivamente os seus comentários à direita. Em telemóvel, comentários imediatamente abaixo da sessão. Não existe chat geral do tratamento.

Profissionais apresentados em lista, um por linha e com ponto da respetiva cor. Datas/estados/observações permanecem junto da sessão. Comentários têm autor, data/hora e indicação de edição com histórico consultável.

Estado Por marcar mostra ação Marcar; estado Marcada mostra detalhes e Reagendar; Concluída mostra o registo e histórico. O protótipo ainda tem botões/seletores simulados que não representam estas regras finais.

## Alternativas e escolha proposta

1. **Tratamento e etapas em tabelas próprias, ligação opcional ao appointment: recomendado.** Permite planear sem reservar agenda e evita alterar a linha da consulta só para identificar o tratamento.
2. Criar appointments provisórios para todas as etapas: rejeitado para este desenho, porque pode ocupar agenda e produzir mensagens antes da marcação.
3. Guardar o plano num campo JSON: rejeitado por dificultar permissões por sessão, relações, concorrência e histórico de edições.

## Modelo de dados proposto

Novas tabelas, com nomes finais sujeitos à verificação de colisões na implementação:

- `treatments`: id, patient_id, specialty_id, name, objective, status (`active`, `completed`, `cancelled`), version, created_by/at, updated_at, closed_by/at.
- `treatment_professionals`: relação entre tratamento e profissionais, com identificação do responsável principal.
- `treatment_sessions`: id, treatment_id, ordinal, name, kind (`consultation`, `surgery`), consultation_type_id, duration, primary_professional_id, appointment_id opcional e único, disposition (`planned`, `omitted`), version e metadados de autoria. Data e estado de uma sessão marcada vêm do appointment, não de uma segunda cópia editável.
- `treatment_session_professionals`: profissionais adicionais previstos para a sessão sem data. Ao marcar, a equipa efetiva passa a ser a equipa do appointment; mudanças efetuadas na agenda têm de refletir-se no painel sem depender de cópias desatualizadas.
- `treatment_session_comments`: sessão, autor imutável, texto, version e datas. Sem anexos, menções ou mensagens externas na primeira versão.
- `treatment_comment_revisions`: comentário, versão anterior, texto anterior, editor e data. Append-only; criada pelo servidor na mesma transação da edição.
- `appointment_clinical_observations` e revisões: registos internos por consulta, com autor, versão e histórico, separados de `appointments.final_notes`. Disponíveis também para consultas avulsas; quando associadas a tratamento aparecem na sessão correspondente.

Não reutilizar `source_request_id` nem mudar o significado das colunas existentes. Não copiar comentários/observações médicas para `final_notes`, `notes`, payloads de webhooks ou templates externos. Rever a tabela existente `appointment_notes` no plano: só reutilizar se o seu contrato, permissões e consumidores permitirem exatamente estas regras; não migrar notas existentes por suposição.

Constraints: uma consulta pertence no máximo a uma sessão/tratamento; paciente da consulta coincide com o paciente do tratamento; profissional não repetido; duração positiva; tipo de consulta pertence à especialidade; ordem única por tratamento. Vincular consulta antiga não altera data, estado, equipa ou notas. Proteção de exclusão: não apagar sessões com consultas/comentários nem permitir apagar consultas ligadas por cascata; usar cancelamento/omissão. A autorização efetiva é sempre verificada na BD.

## Permissões

| Ação | Admin | Secretária | Médico participante | Outro médico |
|---|---|---|---|---|
| Ler tratamentos, sessões, observações e comentários | Sim | Sim | Sim | Sim |
| Escrever comentários/observações | Sim | Sim | Sim, nas suas consultas/sessões | Não |
| Editar texto próprio | Sim | Sim | Sim, enquanto participante | Não |
| Editar texto alheio | Sim | Não | Não | Não |
| Consultar revisões | Sim | Sim | Sim | Sim |

Autor original nunca muda quando um admin edita. Quem deixou de participar conserva leitura, mas perde escrita. Participação numa sessão marcada deriva da equipa atual do appointment; numa etapa por marcar deriva da equipa prevista dessa etapa. Pertencer à equipa geral do tratamento não concede escrita nas consultas de outros médicos.

Proposta operacional a validar nesta especificação: admins e secretárias criam/alteram planos e marcações; os médicos envolvidos podem encerrar/reabrir o tratamento e concluir as consultas conforme o fluxo atual, mas não ganham permissões novas de reagendamento/cancelamento. Encerramento manual requer resolver etapas pendentes: concluir, cancelar a consulta ou omitir uma etapa ainda não marcada com motivo. Nenhum encerramento dispara alterações automáticas nas consultas.

RLS e RPCs devem permitir aos médicos ler o contexto mínimo de identificação do paciente necessário para encontrar tratamentos, sem abrir acesso indiscriminado a todos os campos pessoais nem mudar a visibilidade global da agenda. O plano terá de resolver a navegação da ficha/lista para médicos que hoje só veem os seus pacientes. Não confiar apenas em esconder botões.

## Marcação e disponibilidade

Escolher equipa e duração, selecionar dia e depois horário comum disponível. Reutilizar a validação de disponibilidade existente: horários, ausências, atividade, especialidade, tipo, duração completa, conflitos e fuso Europe/Lisbon. Alterar equipa/duração limpa a seleção de horário. Sem vagas, permitir outro dia ou equipa; não oferecer horários inventados nem permitir contornar conflitos.

Marcar etapa cria appointment real com todos os campos necessários através de `save_appointment_team`, e guarda a ligação à etapa na mesma transação. Bloquear a etapa durante a operação; repetir a mesma submissão devolve a consulta já ligada, sem novo INSERT. Se o payload divergente tentar criar outra consulta para a mesma etapa, rejeitar e pedir atualização. Uma falha de vínculo reverte a criação da consulta e os eventos transacionais.

Reagendar atualiza a mesma consulta, com expectedVersion. Revalidação no servidor é obrigatória. Se outro utilizador alterar a consulta, mostrar conflito sem perder o rascunho. Para consulta cancelada/falta, manter a sessão e histórico visíveis; nova tentativa é uma nova etapa, sem apagar o registo anterior.

Marcação de várias sessões permanece no âmbito pedido: assistente sequencial com revisão final. Gravação do lote numa única transação, locks em ordem determinística e idempotência por etapa. Falha numa sessão não deixa marcações parciais; preservar escolhas no cliente e indicar a etapa em conflito. Não introduzir intervalos clínicos automáticos na primeira versão; datas e intervalos são escolhidos pela equipa. Uma confirmação por appointment é o comportamento esperado atual; mensagem única para o lote exige contrato separado com Samuel.

## Conclusão e observações

Modal distingue claramente observações médicas internas de observações para o paciente e opção de avaliação. Um novo endpoint transacional grava o registo interno e chama a função existente de estado; não mudar a assinatura usada pelo n8n. Falha em qualquer parte reverte ambas. Editar posteriormente uma observação interna não toca no appointment nem reinicia avaliação. O utilizador pode concluir sem texto interno obrigatório.

Mostrar o tratamento no histórico da consulta através da relação com a etapa; não guardar uma cópia textual de “tratamento + data”. A data é a da consulta. Consultas avulsas continuam válidas e podem ser associadas posteriormente a etapa do mesmo paciente por admin/secretária.

## Compatibilidade n8n e migração

Cumprir `docs/operations/database-n8n-compatibility.md` e atualizar `2026-10-27-treatments-n8n-impact.md` com resultados reais. Novas tabelas internas sem triggers HTTP. Schema aditivo, sem backfill e sem defaults que insiram consultas. RPCs atuais mantêm assinaturas e efeitos observáveis.

Esperado: planear/comentar/editar texto/encerrar tratamento produz zero eventos em appointments/appointment_requests; marcar/reagendar/cancelar/concluir mantém o fluxo externo normal. Uma transação com vários appointments não significa uma única mensagem. Confirmar filtros atuais, payloads e deduplicação com Samuel antes de certificar integração externa; não presumir que o relatório dos 28 testes anteriores cobre esta funcionalidade.

## Testes e aceitação

- Migração aplicada sobre schema atual e consultas antigas, sem alterações de dados existentes.
- Matriz RLS real com anon, utilizador sem role, admin, secretária, médico participante/não participante e participante removido; proibir spoofing de autor e escrita direta nas revisões.
- Comentário só aparece na sua sessão; edição mantém autor, revision e editor; escrita concorrente rejeitada por versão.
- Disponibilidade comum e conflitos; marcação simples/lote idempotente; rollback sem consultas órfãs; associação rejeita paciente diferente ou consulta já ligada.
- Consultas avulsas/equipas, conversão WhatsApp, reabertura/conclusão e correções de contacto anteriores continuam a passar.
- Observadores locais de eventos: operações internas não atualizam appointments; eventos externos nunca contêm comentários nem observações internas.
- Interface desktop/mobile conforme protótipo aprovado; permissões, estados vazios, carregamento, erros e conservação de rascunhos.
- Testes externos apenas coordenados com Samuel, dados fictícios e número autorizado. Sem testes destrutivos ou fixtures de pacientes reais.

## Sequência de implementação e entrega

1. Modelação, migrações aditivas e testes de permissões/contratos.
2. RPCs de tratamento, etapas e marcação atómica; integração com disponibilidade/equipas.
3. Observações, comentários, autoria e revisões; prova de isolamento dos webhooks.
4. Aba e detalhe de tratamentos, marcação individual/lote e integração de conclusão/histórico.
5. Regressão local, auditoria de eventos, revisão de código e documento de ação para Samuel.
6. Validação do utilizador no Workbench, coordenação externa e só depois publicação autorizada.

Rollback inicial: reverter interface/ativação da funcionalidade mantendo tabelas/dados novos, sem DROP automático. Não apagar consultas criadas durante utilização. Se for preciso corrigir migração publicada, usar nova migração. Desenvolvimento e testes no Docker isolado; nenhuma publicação de Tratamentos autorizada apenas pela aprovação visual do protótipo.

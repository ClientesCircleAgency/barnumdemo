# Barnun — decisão da clínica e alteração da automação de conclusão

Data: 03/11/2026. Destinatário: Samuel / Claude Code.

## Objetivo

Implementar no n8n a decisão confirmada pelo Tiago: enviar a mensagem habitual de conclusão a cada consulta concluída, independentemente da opção de avaliação. Notas e link Google passam a ser blocos opcionais independentes.

Este documento substitui as decisões pendentes sobre mensagens no contrato de 02/11. Não autoriza alterar a aplicação, publicar as migrações de Tratamentos ou modificar os dados de pacientes reais para testar.

## Decisões aprovadas

- N consultas marcadas correspondem a N confirmações, uma por consulta. Preservar A1.
- Manter o lembrete habitual por consulta. Preservar A2.
- Enviar sempre a mensagem base de conclusão: agradecimento e resumo habitual da consulta.
- Incluir notas destinadas ao paciente apenas quando `final_notes` tiver texto não vazio após trim.
- Incluir o link Google e o respetivo convite à avaliação apenas quando `send_review` for verdadeiro.
- Quando não houver notas nem avaliação, enviar a mensagem base completa, retirando apenas os blocos das notas e da avaliação. Não enviar títulos vazios, placeholders ou frases que convidem a avaliar sem link.
- Nunca enviar observações médicas internas ou comentários da equipa.

## Matriz obrigatória da A6

| final_notes | send_review | Mensagem |
|---|---|---|
| Preenchido | true | Base + notas + convite/link Google |
| Vazio/null/espaços | true | Base + convite/link Google |
| Preenchido | false | Base + notas, sem convite/link Google |
| Vazio/null/espaços | false | Base, sem notas nem convite/link Google |

Preservar o texto base que já existe; não é necessário inventar uma mensagem nova. Reutilizar os dados públicos que o template atual já apresenta, incluindo a equipa quando suportada. A opção de review controla exclusivamente o bloco de avaliação, nunca a seleção da consulta inteira nem as notas.

## Estado conhecido e alteração necessária

O relatório do Samuel `2026-11-03-verificacao-horario-ocupado-e-notas.md` confirmou que A6 seleciona atualmente apenas consultas com avaliação marcada. Por isso, simplesmente acrescentar `OR final_notes preenchido` ao filtro é insuficiente: continuaria a excluir o caso sem notas e sem review, que a clínica quer receber também.

Inspecionar o workflow real antes de editar. Ajustar o filtro de seleção para admitir todas as consultas elegíveis concluídas, mantendo as restantes condições operacionais existentes. Aplicar as condições de notas/review na construção do conteúdo.

Preservar o horário atual da A6 e a janela documentada de 2–3 horas após a primeira conclusão (`finalized_at`); esta decisão não pede envio imediato nem uma nova periodicidade. Não alterar `finalized_at`, `send_review` ou `final_notes` na BD para tornar uma consulta elegível. Não reprocessar o histórico nem enviar mensagens retroativas indiscriminadamente.

Rever os mecanismos existentes de prevenção de duplicações e retries. Não criar um segundo envio independente para as notas: deve existir uma mensagem lógica de conclusão por consulta. Explicitar no relatório qualquer limitação de deduplicação que continue a existir; não declarar garantia exatamente-uma-vez sem prova. Se a solução exigir novos campos/RPCs ou mudanças ao contrato da BD, devolver a proposta para coordenação em vez de os criar unilateralmente.

## Separação dos dados internos

- `final_notes`: texto explicitamente destinado ao paciente; única fonte das notas no WhatsApp.
- `notes` e `appointment_notes`: não incluir nas mensagens, conforme o contrato atual confirmado pelo Samuel.
- Futuras tabelas de Tratamentos `appointment_clinical_observations`, `treatment_session_comments` e respetivas revisões: não consultar para gerar mensagens nem copiar para payloads externos.
- O facto de um campo não aparecer na mensagem não prova que esteja ausente dos logs de execução. Preservar a separação das novas tabelas e não alargar os payloads para as incluir.

## Execução e testes pedidos ao Samuel

1. Guardar backup/export da versão atual da A6 e identificar o workflow efetivamente utilizado.
2. Implementar e testar a matriz acima em cópia isolada, seguindo o processo já usado pelo Samuel.
3. Usar exclusivamente dados fictícios identificados e o número de teste autorizado do Samuel. Não tocar nos pedidos/pacientes reais nem alterar as suas datas/estados.
4. Verificar notas null, vazias e com espaços; caracteres portugueses e quebras de linha; ausência completa do bloco de avaliação quando false.
5. Confirmar que consultas não concluídas e fora da janela continuam excluídas; inspecionar a condição de contacto válido existente.
6. Testar repetição/retry segundo os mecanismos disponíveis e verificar que a alteração não introduz duplicações ou envio retroativo.
7. Comparar A1/A2 antes/depois: sem alterações funcionais. Não criar confirmação extra na A8; a confirmação continua a vir da consulta criada/A1.
8. Após testes aprovados, aplicar a alteração da A6 seguindo o procedimento de publicação do Samuel; remover apenas fixtures/cópias criadas por estes testes e verificar as contagens de controlo.
9. Devolver um relatório Markdown com: mudança concreta, matriz observado/esperado, evidências de execuções sem credenciais/dados reais, versão publicada ou ainda em teste, limitações e rollback.

Rollback: restaurar o backup da A6, sem alterar o histórico clínico ou apagar registos de pacientes. Evitar que o rollback provoque reenvio de mensagens já entregues.

## Horário ocupado — o que já passou e o que falta

O relatório de 03/11 confirmou 4/4 casos sobre cópias temporárias dos workflows: médico principal ocupado, sobreposição parcial, médico adicional ocupado e controlo livre. Nos conflitos, o pedido ficou `suggested`, não foi criada consulta e houve aviso ao paciente e alerta à clínica, sem confirmação falsa. Os workflows reais não foram alterados nesse teste.

Tratamentos ainda não estão publicados. Após publicação coordenada, repetir com uma consulta efetivamente ligada a um tratamento:

- Médico principal/adicional ocupado: comportamento equivalente aos casos já aprovados.
- **Mesmo paciente, horário sobreposto, médicos diferentes e livres:** a nova proteção deve rejeitar com `patient_unavailable` (SQLSTATE 23514).
- Confirmar que A8 trata esta rejeição como indisponibilidade, mantém o pedido aberto, não envia sucesso e emite os avisos esperados.
- Controlo com horário livre: uma consulta criada, uma confirmação A1, equipa correta.

O teste anterior não substitui o teste do mesmo paciente com médicos diferentes: são proteções diferentes. Se a A8 depender de uma lista de textos de erro, verificar especificamente `patient_unavailable`.

Não bloquear a alteração independente da A6 à espera destas tabelas; registar a validação de Tratamentos como pendente da publicação coordenada. Não aplicar as migrações deste lado. A parte da aplicação/BD continua com Tiago/Codex.

## Resposta curta para o Samuel

Samuel, ficou decidido: uma confirmação e um lembrete por consulta. Na conclusão, enviar sempre o agradecimento e resumo habitual; acrescentar as notas quando existirem e o convite/link Google apenas quando a review estiver marcada. Sem notas e sem review, enviar a mensagem base, sem esses dois blocos. Portanto, a A6 não pode filtrar apenas por review ou por notas preenchidas. O MD detalha a alteração e os testes. Depois de publicarmos os Tratamentos, repetimos o teste do horário ocupado, incluindo o mesmo paciente com médicos diferentes. Obrigado!

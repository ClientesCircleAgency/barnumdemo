# Tratamentos — validação local de 02/11/2026

Estado: funcionalidade integrada na aplicação real do Workbench, validada localmente e pronta para revisão do utilizador. **Não publicada em produção.** As correções de produção são uma entrega separada: [estado da publicação](2026-11-02-release-status.md).

## O que está implementado

- Aba Tratamentos na ficha do paciente; diretório clínico permite aos médicos encontrar tratamentos sem obter contactos pessoais de outros pacientes.
- Criar/editar plano com objetivo, especialidade e equipa. Planear consultas/cirurgias sem data; etapas novas herdam a equipa do tratamento.
- Cada consulta à esquerda, comentários dessa consulta à direita; em telemóvel, comentários abaixo. Profissionais em lista com as cores individuais.
- Contadores de concluídas, marcadas e por marcar; omissão com motivo e encerramento/reabertura manual.
- Horários comuns à equipa, duração completa e disponibilidade do paciente. Assistente de várias etapas, revisão final e gravação atómica. Uma consulta real por etapa.
- Ligação a consulta existente, sem UPDATE técnico da consulta. Reagendamento pelo detalhe existente.
- Observações médicas internas em tabelas próprias, incluindo consultas avulsas. Conclusão integrada na sala de espera e no detalhe da consulta.
- Todos os médicos leem; participantes e secretariado escrevem. Autor só edita texto próprio quando autorizado; admin pode editar qualquer texto. Revisões preservam a autoria original.
- Conflitos de edição permitem consultar a versão atual e adotar essa versão conservando o rascunho, mediante ação explícita.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| Vitest | 81 testes, 24 ficheiros: aprovados |
| TypeScript `tsconfig.app.json` | Aprovado |
| Build Vite | Aprovado; avisos preexistentes sobre bundle grande e Browserslist |
| SQL pgTAP | 116 assertions em 8 suites: aprovadas |
| Concorrência original | Repetição da mesma etapa cria uma consulta; horários disputados aceitam uma reserva |
| Concorrência adicional | Remoção simultânea de médico bloqueia criação/edição de comentários e observações; remoção de equipa planeada bloqueia comentário |
| Colisão do paciente | Tratamento versus avulsa nos dois sentidos e reagendamento avulso: rejeitados quando coincidem com reserva de tratamento |
| Captura local de eventos | Textos internos ausentes dos payloads appointments; operações internas não atualizam appointments |
| Navegador real | Criar plano e etapas, comentário por consulta, reservar lote de três, concluir com textos separados: aprovados |
| Desktop / mobile | 1440 px / 390 px; colunas lado a lado no desktop e empilhadas no mobile, sem overflow horizontal |

Os testes SQL usam transações revertidas; scripts concorrentes criam UUIDs próprios e removem apenas esses dados. Todos verificam que o Docker local não possui triggers HTTP externos. Nenhum paciente real ou WhatsApp real foi utilizado.

Na demonstração ficou um tratamento de `Paciente Demonstração`, com uma consulta concluída, duas marcadas e uma etapa por marcar. O preenchimento e a conclusão foram feitos pela interface real, com dados fictícios. A consulta concluída tem data futura porque se trata de uma demonstração funcional, não de um registo clínico real.

## Revisão independente

Revisão de código encontrou três problemas importantes, todos corrigidos antes desta entrega:

1. Autorização clínica consultada antes de bloquear a equipa: agora bloqueia sessão/consulta e só depois verifica participação. Teste concorrente reproduziu a falha antes e passou depois.
2. Sobreposição entre marcação avulsa e tratamento: trigger partilhado serializa pelo paciente e protege reservas de tratamentos; não altera a política existente entre duas consultas avulsas.
3. Rascunho preservado sem forma de recuperar a versão: adicionadas comparação e adoção explícita da versão atual, com testes de recuperação.

Também foi acrescentada a identificação da etapa nos conflitos de marcação em lote.

## Limites e publicação

- Estes resultados não certificam entrega de WhatsApp nem execução remota de n8n. Essa parte fica com Samuel.
- Não foi executado um teste HTTP ponta a ponta do rollback da fila `pg_net`; foram verificados rollback SQL e eventos transacionais locais.
- O bundle continua grande; não foi introduzida uma reestruturação global de carregamento nesta entrega.
- Antes de publicar Tratamentos: comparar schema remoto e migrações pendentes, validar os pontos de integração no [contrato para Samuel](2026-11-02-tratamentos-contrato-para-samuel.md) e rever esta interface com o utilizador.
- Aplicar a BD aditiva antes do frontend. As três migrações iniciais têm timestamps anteriores à correção já publicada em 27/10; a futura comparação deve considerar isso (`--include-all` apenas depois de confirmar a lista exata no dry-run).
- Rollback: regressar ao frontend anterior preservando tabelas e registos clínicos. Corrigir BD com migração nova; não apagar histórico clínico.

Scripts reproduzíveis: `scripts/Test-TreatmentSql.ps1 -Pattern '*.test.sql'`, `scripts/test-treatment-booking-concurrency.mjs`, `scripts/test-treatment-write-races.mjs`. Testes frontend no Workbench excluem o arquivo temporário de release: `npm test -- --exclude '**/.superpowers/**' --maxWorkers=2 --minWorkers=1`.

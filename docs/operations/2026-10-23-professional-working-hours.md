# Horário semanal na criação manual de consultas

## Causa e alteração

O `AppointmentWizard` consultava apenas `user_profiles.time_off`. O horário semanal
guardado em `working_hours` não participava no filtro nem na validação de gravação.

O formulário passa a carregar ambos, recalcular os profissionais quando a data,
hora ou duração mudam e exigir que toda a consulta caiba num turno ativo.
Mantêm-se os filtros de especialidade, tipo de consulta, férias e folgas.
A mesma validação é aplicada antes de chamar `addAppointment`; erros de leitura
ou carregamento inicial não são tratados como disponibilidade confirmada.

Perfis antigos sem horário configurado (`null` ou lista vazia) mantêm o comportamento
anterior baseado no horário da clínica. Dias ausentes de um horário explicitamente
configurado, dias desativados e intervalos inválidos não permitem a consulta.

## Verificação

- Regressão reproduzida no formulário antes da correção: médico de segunda 16h–19h
  aparecia às 13h.
- 46 testes passaram, incluindo alterações de hora/duração no dropdown e gravação
  pelo próprio médico: 13h bloqueada, 16h permitida.
- Testes cobrem fim exato do turno, consulta além do turno, dias desativados,
  nomes de dias com acentos e perfis antigos.
- Build de produção e TypeScript passaram.

Âmbito: criação manual de consultas neste formulário. Não altera dados de médicos,
consultas existentes, reagendamentos ou regras de escrita na base de dados.

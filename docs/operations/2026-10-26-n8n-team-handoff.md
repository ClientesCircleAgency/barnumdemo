# Samuel — contrato final de consultas com equipa

## Conversão por WhatsApp

O `PATCH` em `appointment_requests`, com `status=converted` e `accepted_slot`, continua suportado. O trigger `trg_create_appointment_on_convert` chama internamente `save_appointment_team` e lê da opção aceite:

- `date`, `time`;
- `professional_id` e `additional_professional_ids`;
- `consultation_type_id`;
- `duration`, em minutos — usar esta chave exata.

Não é obrigatório mudar a Automação 8 para a RPC. O `source_request_id` é atribuído automaticamente com o **ID do pedido atualizado**; não deve ser enviado dentro de `accepted_slot`. A RPC de conversão também continua disponível. Repetir uma conversão já registada através de `source_request_id` devolve/reutiliza a consulta existente.

Exemplo de corpo do PATCH (substituir os UUID):

```json
{
  "status": "converted",
  "accepted_slot": {
    "date": "2026-11-10",
    "time": "16:00",
    "professional_id": "UUID_PRINCIPAL",
    "additional_professional_ids": ["UUID_ADICIONAL"],
    "consultation_type_id": "UUID_TIPO",
    "duration": 45
  }
}
```

## Nomes na linha da consulta

Nova coluna `appointments.professional_names`, do tipo `text[]`. No JSON do webhook será uma lista:

```json
{"professional_names": ["Dr. X", "Dra. Y", "Dra. Z"]}
```

O principal vem primeiro; os restantes seguem a ordem enviada na lista de adicionais. `save_appointment_team` preenche os nomes **na mesma inserção/atualização da consulta**, antes dos triggers HTTP receberem o evento. Não é necessário esperar por uma atualização posterior. Editar a equipa pela RPC atualiza os nomes; concluir pela função de estado conserva-os.

Para compor mensagens no n8n:

```js
const names = record.professional_names?.length
  ? record.professional_names
  : [record.professional_name].filter(Boolean);
const teamText = names.join(', ');
```

Consultas anteriores à migração mantêm `professional_names=null` até uma gravação por `save_appointment_team`. Não foi feito backfill para evitar disparar webhooks e mensagens de pacientes reais. `professional_name` continua a existir para compatibilidade. Os nomes são um snapshot da gravação, não uma lista recalculada após renomear um médico.

## Eventos e testes

- A conversão pode gerar INSERT e UPDATE da mesma consulta, pois a ligação `source_request_id` é atribuída depois da criação. No primeiro INSERT essa ligação ainda pode estar nula; os nomes da equipa já estarão completos.
- Filtrar atualizações técnicas e deduplicar mensagens por consulta/evento. Não enviar uma mensagem por participante ou por qualquer UPDATE.
- O Workbench mantém os webhooks externos desligados. Testes com fixtures são executados exclusivamente aí.
- Testes reais ponta a ponta ficam para Samuel, com dados de teste e o seu número, depois da confirmação da publicação. Não usar contactos de pacientes.

Validação local: 45 testes SQL passaram, incluindo PATCH direto, nomes visíveis desde o primeiro evento, ordem do principal, remoção de adicional e idempotência. Concorrência e Realtime também são verificados localmente.

Migração adicional: `20261026140000_appointment_team_names.sql`, depois das cinco migrações de equipa de 24 de outubro. O estado efetivo da publicação será registado no relatório de entrega; este contrato por si só não confirma que o deploy terminou.

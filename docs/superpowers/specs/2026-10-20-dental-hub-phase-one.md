# Dental Hub — primeira entrega: fundação de acesso

Estado: especificação consolidada para revisão. As decisões de produto abaixo foram acordadas em conversa; este documento delimita a primeira implementação.

## Objetivo e ambientes

Construir em paralelo uma plataforma para clínicas. A Barnun continua no seu projeto Supabase `oziejxqmghwmtjufstfp` e na publicação atual. O destino DentalHub é exclusivamente `ihkjadztuopcvvmmodpp`, cuja limpeza foi autorizada e verificada. O código novo ficará em `Projects/dental-hub`, com configuração, migrações e publicação independentes. Não copiar ficheiros de ambiente, ligação CLI, segredos nem configuração Vercel da Barnun.

Esta primeira entrega termina quando a estrutura de identidade e acesso estiver instalada no DentalHub e os testes de isolamento passarem. Ainda não é uma aplicação clínica utilizável nem migra dados reais.

## Modelo escolhido

Uma base partilhada, com separação obrigatória por organização e políticas RLS. Schema por cliente e base por cliente foram considerados no desenho anterior; ambos acrescentam provisionamento e migrações por cliente e não correspondem ao objetivo de um sistema único.

Hierarquia: Dental Hub (operador) → organização/grupo cliente → entidade jurídica → unidade.

| Entidade | Conteúdo e regras |
|---|---|
| organizations | UUID, nome, slug único, estado ativo/arquivado e datas |
| legal_entities | UUID, organization_id, nome legal, país e identificação fiscal; unicidade fiscal dentro do grupo/país |
| locations | UUID, organization_id, legal_entity_id, nome comercial, contactos, morada, timezone, estado e configuração de marca própria |
| user_profiles | user_id ligado a Auth, nome e preferências pessoais; nenhuma permissão editável neste perfil |
| organization_memberships | UUID, organization_id, user_id, role, estado ativo/revogado; uma associação por identidade/grupo |
| membership_locations | organization_id, membership_id, location_id; atribuições únicas dentro do mesmo grupo |

As referências compostas impedem associar uma unidade a uma entidade jurídica de outro grupo ou uma atribuição a uma membership de outro grupo. Identificadores de organização não são editáveis por atualizações normais. Arquivar preserva relações e impede acesso operacional; não existe eliminação clínica em cascata nesta fundação.

O operador Dental Hub não ganha acesso global através de uma role de clínica. A consola de operação e o acesso de suporte ficam para uma entrega própria; não se cria uma conta universal com acesso clínico nesta fase.

## Matriz de acesso

| Papel | Âmbito de leitura operacional | Gestão |
|---|---|---|
| Proprietário | Todas as unidades ativas do próprio grupo | Configuração, colaboradores e atribuições; titularidade apenas por operação própria |
| Administrador | Todas as unidades ativas do próprio grupo | Configuração, colaboradores não proprietários e atribuições |
| Secretariado | Unidades atribuídas e ativas | Sem gestão de permissões |
| Médico | Unidades atribuídas e ativas | Sem gestão de permissões; regras clínicas vêm na entrega clínica |

Uma pessoa pode ter memberships distintas em vários grupos. A revogação é consultada na BD em cada operação e não depende de claims antigos do JWT. Sem membership ou atribuição válida, negar acesso. Um membro vê a sua própria associação; o gestor pode listar a equipa do seu grupo. Perfis de outros utilizadores não são expostos globalmente.

Criar grupos e o primeiro proprietário será uma operação privilegiada de provisionamento nesta fase, exercitada apenas com fixtures de teste. O registo self-service e os convites serão implementados depois; não haverá policy que permita ao navegador criar a sua própria role.

Alterações de papéis e atribuições terão operações controladas e validação explícita da identidade, papel, grupo e alvo. Administradores não podem criar/promover/revogar proprietários. Impedir remoção ou revogação do último proprietário ativo. Remover um colaborador revoga a membership; não apaga a identidade global.

## Fronteira clínica e personalização

Pacientes e histórico serão partilhados dentro da mesma entidade jurídica, com autorização clínica própria. Pertencer a uma unidade não concede automaticamente acesso a todos os pacientes. Entre entidades jurídicas, bloquear partilha por defeito; o mecanismo de autorização de partilha não pertence a esta entrega.

Cada unidade pode ter nome e marca próprios. A primeira migração reserva os campos de configuração; upload, extração de cores, gradientes e editor serão uma entrega posterior. Serviços, horários e agendas serão definidos por unidade na entrega clínica. Gestão global de unidades não significa leitura irrestrita de histórico clínico.

## Segurança e validação

RLS em todas as tabelas expostas, grants mínimos e nenhum acesso anónimo aos dados organizacionais. Funções privilegiadas de autorização em schema não exposto, com search_path fixo e execução limitada. A service role nunca entra no frontend.

Testes de BD executados com os papéis anon e authenticated, identidade simulada através das claims de sessão, não apenas como postgres. Fixtures: dois grupos, duas entidades num grupo, três unidades, proprietário, administrador, secretariado, médico e uma identidade membro de ambos os grupos com papéis diferentes.

Critérios obrigatórios:

- Acesso cruzado entre grupos negado para leitura e escrita.
- Colaborador só lê unidades atribuídas; gestor lê todas as do seu grupo.
- Uma unidade nova não é atribuída automaticamente ao colaborador.
- Revogar membership ou atribuição corta novas operações mesmo com a mesma identidade autenticada.
- Anónimo, utilizador sem membership e tentativa de autopromoção não têm acesso.
- Referências cruzadas são rejeitadas também em escrita privilegiada pelas constraints.
- Administrador não altera proprietário; último proprietário não pode ser revogado.
- Testes usam rollback e não deixam contas ou empresas fictícias persistentes.
- Verificação posterior confirma migrações, RLS, grants e ausência de fixtures.

Não declarar Storage, Realtime clínico ou API de marcações validados antes de existirem. Estes testes pertencem às respetivas entregas posteriores.

## Sequência após esta fundação

1. Login, seleção de grupo/unidade, onboarding e convites, com cache por contexto.
2. Personalização e serviços por unidade.
3. Pacientes, agenda, pedidos e mensagens adaptados e testados.
4. Ensaio de migração Barnun com reconciliação, backup e restauro.
5. Integração e validação conjunta com Samuel, seguida de corte controlado.

Samuel gere as automações n8n. Nós documentamos os eventos, identificadores e autenticação necessários, sem alterar os workflows dele. Nenhum envio externo é ativado nos testes. A mudança final de domínio e dos dados depende de validação própria; não faz parte da instalação da fundação.

## Revisão da especificação

Este documento substitui o âmbito aberto da primeira entrega no rascunho de 19/10. Resolve a contradição entre testes clínicos futuros e aceitação da fundação: a primeira fase só certifica os objetos e permissões aqui descritos. O domínio exato Dental Hub só é necessário na fase de redirects/publicação. A autorização de partilha entre entidades permanece bloqueada por defeito e não impede construir a fundação.

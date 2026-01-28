# 🎯 PLANO DE AÇÃO - BARNUM SUPABASE
**Prioridade:** Alta  
**Tempo estimado:** 30-60 minutos

---

## 🔴 AÇÃO 1: LIMPAR DADOS DE OFTALMOLOGIA

### Problema
A base de dados contém dados de exemplo da especialidade "Oftalmologia", que foi removida no rebranding. Isto causa confusão e dados incorretos.

### Solução
Criar migração SQL para:
1. ❌ Remover especialidade "Oftalmologia"
2. ✅ Adicionar especialidade "Rejuvenescimento Facial"
3. ❌ Remover consultas de oftalmologia (Cataratas, Refrativa)
4. ✅ Adicionar consultas de rejuvenescimento (Botox, Filler, etc)
5. 🔄 Atualizar profissionais para as especialidades corretas

### Status
- [ ] Migração criada
- [ ] Migração testada
- [ ] Migração aplicada em produção

---

## 🟡 AÇÃO 2: ADICIONAR ÍNDICES DE PERFORMANCE

### Problema
Algumas queries podem ficar lentas quando houver muitos registos (centenas/milhares de pacientes, consultas, mensagens).

### Solução
Adicionar índices nas tabelas:
- `contact_messages` (status, created_at)
- `appointment_requests` (status, preferred_date)
- `whatsapp_workflows` (workflow_type)

### Benefício
- ⚡ Queries 50-90% mais rápidas
- 😊 Melhor experiência de utilizador
- 💰 Menor consumo de recursos Supabase

### Status
- [ ] Índices criados
- [ ] Performance testada

---

## 🟢 AÇÃO 3: CRIAR UTILIZADOR ADMIN

### Problema
Sem um utilizador com role "admin", não é possível aceder ao painel administrativo.

### Solução

**Passo 1:** Criar utilizador no Supabase
1. Ir a: https://supabase.com/dashboard/project/ihkjadztuopcvvmmodpp/auth/users
2. Clicar em "Add user" → "Create new user"
3. Preencher email e password
4. Copiar o UUID do utilizador criado

**Passo 2:** Atribuir role admin
```sql
-- No SQL Editor do Supabase
INSERT INTO public.user_roles (user_id, role) 
VALUES ('COLAR_UUID_AQUI', 'admin');
```

### Status
- [ ] Utilizador criado
- [ ] Role admin atribuída
- [ ] Login testado

---

## 📋 CHECKLIST COMPLETA

### Preparação
- [x] Auditoria Supabase completa
- [x] Documento de análise criado
- [ ] Backup da base de dados atual

### Implementação
- [ ] **AÇÃO 1:** Migração de limpeza criada e aplicada
- [ ] **AÇÃO 2:** Índices de performance adicionados
- [ ] **AÇÃO 3:** Utilizador admin criado e testado

### Verificação
- [ ] Frontend funciona corretamente
- [ ] Admin consegue fazer login
- [ ] Todas as funcionalidades testadas
- [ ] Dados de exemplo corretos

### Produção
- [ ] Migrações aplicadas em produção
- [ ] Utilizador admin criado em produção
- [ ] Testes finais em produção

---

## 🚨 AVISOS IMPORTANTES

### ⚠️ Antes de Executar
1. **FAZER BACKUP** da base de dados antes de aplicar migrações
2. Verificar se existem **consultas ou pacientes reais** antes de apagar dados
3. Testar migrações em **ambiente de desenvolvimento** primeiro

### 🔒 Segurança
- Nunca partilhar credenciais de admin
- Usar passwords fortes (min 12 caracteres)
- Ativar 2FA na conta Supabase

---

## 📞 PRÓXIMOS PASSOS

1. **Review:** Ler documento `SUPABASE_AUDIT.md` para contexto completo
2. **Decisão:** Aprovar ou ajustar o plano de ação
3. **Execução:** Criar e aplicar migrações necessárias
4. **Teste:** Verificar que tudo funciona corretamente
5. **Deploy:** Aplicar em produção

---

*Plano de ação gerado em 27/01/2026*

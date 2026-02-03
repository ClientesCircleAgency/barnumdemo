# 🚀 GUIA: COMO APLICAR O SETUP DA BASE DE DADOS

## ⚠️ IMPORTANTE
As tabelas **NÃO existem** no Supabase porque as migrações nunca foram executadas. Este guia resolve isso!

---

## 📋 PASSO A PASSO

### **PASSO 1: Abrir SQL Editor** 

1. Ir a: https://supabase.com/dashboard/project/ihkjadztuopcvvmmodpp/sql/new
2. Fazer login se necessário

---

### **PASSO 2: Copiar SQL**

1. Abrir o ficheiro: `.docs/SETUP_DATABASE.sql`
2. Selecionar **TODO** o conteúdo (Ctrl+A)
3. Copiar (Ctrl+C)

---

### **PASSO 3: Colar e Executar**

1. Colar no SQL Editor do Supabase (Ctrl+V)
2. Clicar no botão **"RUN"** (canto inferior direito)
3. Aguardar ±10-30 segundos

---

### **PASSO 4: Verificar Sucesso** ✅

Se tudo correu bem, vais ver:
- ✅ "Success. No rows returned"
- ✅ Múltiplas linhas de sucesso

**Verificar tabelas criadas:**
1. Ir a: https://supabase.com/dashboard/project/ihkjadztuopcvvmmodpp/editor
2. Ver lista de tabelas à esquerda
3. Devem aparecer **12 tabelas**:
   - `specialties`
   - `consultation_types`
   - `rooms`
   - `professionals`
   - `patients`
   - `appointments`
   - `waitlist`
   - `clinic_settings`
   - `appointment_requests`
   - `contact_messages`
   - `whatsapp_workflows`
   - `user_roles`

---

## 🎯 O QUE FOI CRIADO?

### ✅ 12 Tabelas
Todas as tabelas necessárias para o sistema funcionar

### ✅ Dados de Exemplo
- 2 Especialidades: Medicina Dentária + Rejuvenescimento Facial
- 12 Tipos de consulta (6 dentária + 6 estética)
- 4 Salas/Gabinetes
- 5 Profissionais
- Configurações de horário de trabalho

### ✅ Segurança (RLS)
Todas as tabelas protegidas - apenas admins têm acesso

### ✅ Índices de Performance
Queries otimizadas desde o início

---

## 🔴 E SE DER ERRO?

### Erro: "relation already exists"
**Causa:** Algumas tabelas já existem  
**Solução:** 
1. Eliminar todas as tabelas manualmente
2. Executar o script novamente

### Erro: "permission denied"
**Causa:** Não tens permissões de admin no Supabase  
**Solução:** Verificar se estás logado com a conta certa

### Erro: "syntax error"
**Causa:** SQL não foi copiado corretamente  
**Solução:** 
1. Apagar tudo do SQL Editor
2. Copiar novamente o ficheiro completo
3. Colar e executar

---

## ✅ PRÓXIMO PASSO: CRIAR UTILIZADOR ADMIN

Depois de criar as tabelas, precisas de criar um utilizador admin para aceder ao painel:

### **MÉTODO 1: Via Dashboard** (Recomendado)

1. Ir a: https://supabase.com/dashboard/project/ihkjadztuopcvvmmodpp/auth/users
2. Clicar em **"Add user"** → **"Create new user"**
3. Preencher:
   - **Email:** (teu email)
   - **Password:** (password forte - min 12 caracteres)
   - **Auto Confirm User:** ✅ Marcar
4. Clicar **"Create user"**
5. **COPIAR o UUID do utilizador** (vai parecer com: `550e8400-e29b-41d4-a716-446655440000`)

### **MÉTODO 2: Atribuir Role Admin**

1. Ir novamente ao SQL Editor: https://supabase.com/dashboard/project/ihkjadztuopcvvmmodpp/sql/new
2. Executar este SQL (substituir `SEU_UUID` pelo UUID copiado):

```sql
INSERT INTO public.user_roles (user_id, role) 
VALUES ('SEU_UUID_AQUI', 'admin');
```

**Exemplo:**
```sql
INSERT INTO public.user_roles (user_id, role) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'admin');
```

3. Clicar **"RUN"**

---

## 🧪 TESTAR ACESSO ADMIN

1. Ir ao website: http://localhost:8080/admin
2. Fazer login com:
   - Email: (o que criaste)
   - Password: (o que criaste)
3. Deves conseguir entrar no painel administrativo ✅

---

## 📊 VERIFICAÇÃO FINAL

### Checklist de Sucesso:
- [ ] SQL executado sem erros
- [ ] 12 tabelas criadas e visíveis no dashboard
- [ ] Utilizador criado com sucesso
- [ ] Role admin atribuída
- [ ] Login no painel admin funciona
- [ ] Dashboard mostra dados de exemplo

---

## 🆘 PRECISAS DE AJUDA?

Se encontrares problemas:
1. Tira screenshot do erro
2. Verifica qual passo falhou
3. Tenta executar o SQL em partes menores

---

## ✨ TUDO PRONTO!

Depois destes passos, a tua base de dados está **100% configurada** e pronta para usar!

**Próximas tarefas:**
- [ ] Testar todas as funcionalidades do admin
- [ ] Adicionar pacientes de teste
- [ ] Marcar consultas de teste
- [ ] Configurar horários de trabalho personalizados

---

*Guia criado em 27/01/2026*

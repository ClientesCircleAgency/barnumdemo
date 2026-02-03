# 📚 Documentação do Projeto Barnum

Esta pasta contém toda a documentação técnica e planos de ação para o projeto Barnum.

---

## 📁 Ficheiros Disponíveis

### 📖 GLOSSARY.md
**Glossário de termos técnicos**

Explicação simples de:
- 🗄️ Termos de base de dados (tabelas, migrações, índices)
- 🔒 Segurança (RLS, policies, auth)
- 📊 Performance (queries, triggers)
- 🎯 Termos específicos do projeto

**Quando ler:** Sempre que encontrares um termo que não conheces.

---

### 🔴 SETUP_DATABASE.sql
**Script SQL completo para criar base de dados**

Ficheiro SQL pronto a executar que cria:
- 📋 Todas as 12 tabelas
- 🔐 Sistema de segurança (RLS)
- 📊 Índices de performance
- 🎯 Dados de exemplo (sem Oftalmologia!)

**Quando usar:** Quando as tabelas não existem no Supabase.

---

### 📘 GUIA_SETUP_DATABASE.md
**Guia passo-a-passo para aplicar o setup**

Instruções detalhadas para:
1. Executar o SQL no Supabase Dashboard
2. Verificar se tudo correu bem
3. Criar utilizador admin
4. Testar acesso ao painel

**Quando usar:** Na primeira configuração do projeto ou quando precisas reinstalar a base de dados.

---

### 🔍 SUPABASE_AUDIT.md
**Auditoria completa do Supabase**

Análise detalhada de:
- ✅ Todas as 12 tabelas da base de dados
- 🔐 Configuração de segurança (RLS)
- ❌ Problemas identificados (Oftalmologia)
- 📊 Índices e performance
- 🔄 Triggers e automatizações
- 📋 Comparação Frontend vs Backend

**Quando ler:** Quando precisares de entender a estrutura completa da base de dados.

---

### 🎯 ACTION_PLAN.md
**Plano de ação prioritizado**

Tarefas a executar:
- 🔴 **AÇÃO 1:** Limpar dados de Oftalmologia
- 🟡 **AÇÃO 2:** Adicionar índices de performance
- 🟢 **AÇÃO 3:** Criar utilizador admin

**Quando usar:** Para acompanhar o progresso das tarefas necessárias.

---

## 🚀 Começar Rapidamente

### 🔴 SE AS TABELAS NÃO EXISTEM NO SUPABASE:
1. **URGENTE:** Ler `GUIA_SETUP_DATABASE.md` (5 min)
2. **EXECUTAR:** SQL do ficheiro `SETUP_DATABASE.sql` no Supabase
3. **CRIAR:** Utilizador admin seguindo o guia

### ✅ SE AS TABELAS JÁ EXISTEM:
1. **Ler primeiro:** `SUPABASE_AUDIT.md` (10 min)
2. **Depois:** `ACTION_PLAN.md` (5 min)
3. **Executar:** Seguir checklist do plano de ação

---

## 📞 Links Úteis

- **Supabase Dashboard:** https://supabase.com/dashboard/project/ihkjadztuopcvvmmodpp
- **Documentação Supabase:** https://supabase.com/docs
- **GitHub Repo:** https://github.com/ClientesCircleAgency/barnumdemo

---

## 📝 Nota

Estes documentos são actualizados sempre que há mudanças significativas na base de dados ou arquitetura do projeto.

*Última actualização: 27/01/2026*

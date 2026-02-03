# 📖 GLOSSÁRIO DE TERMOS TÉCNICOS

Guia rápido dos termos mais usados na documentação do projeto Barnum.

---

## 🗄️ BASE DE DADOS

### **Supabase**
Plataforma de backend (servidor) que fornece base de dados PostgreSQL, autenticação, storage e APIs. É o "cérebro" do sistema que guarda todos os dados.

### **PostgreSQL**
Sistema de base de dados relacional (SQL). Imagina como um Excel gigante, mas muito mais poderoso e rápido.

### **Tabela**
Como uma folha de Excel. Cada tabela guarda um tipo específico de informação (pacientes, consultas, mensagens, etc).

### **Migração**
Ficheiro SQL que cria ou altera a estrutura da base de dados. Como uma "receita" de mudanças que pode ser aplicada várias vezes.

### **Seed Data**
Dados de exemplo inseridos automaticamente quando a base de dados é criada. Útil para testar e desenvolver.

---

## 🔒 SEGURANÇA

### **RLS (Row Level Security)**
Sistema de segurança que controla quem pode ver ou editar cada linha de dados. Por exemplo: um utilizador normal só vê os seus próprios dados, um admin vê tudo.

### **Policy (Política)**
Regra de segurança que define quem pode fazer o quê. Exemplo: "Apenas admins podem criar pacientes".

### **Auth (Autenticação)**
Sistema de login (email + password). Verifica se o utilizador é quem diz ser.

### **Role (Função)**
Tipo de utilizador: `admin` (administrador) ou `user` (utilizador normal). Define permissões.

---

## 📊 PERFORMANCE

### **Índice (Index)**
Estrutura que acelera pesquisas na base de dados. Como o índice de um livro - em vez de ler tudo, vais direto à página certa.

**Exemplo:**
- ❌ **Sem índice:** Para encontrar paciente com NIF "123456789", o sistema vê TODOS os pacientes um por um (lento se tiveres 10.000 pacientes)
- ✅ **Com índice:** Sistema vai direto ao paciente certo (instantâneo)

### **Query**
Pedido à base de dados. Exemplo: "Dá-me todas as consultas de hoje do Dr. João".

### **Trigger**
Função automática que executa quando algo acontece. Exemplo: quando atualizas um paciente, o trigger atualiza automaticamente o campo `updated_at`.

---

## 🔧 DESENVOLVIMENTO

### **Frontend**
Parte visual do website que o utilizador vê (React, TypeScript, TailwindCSS).

### **Backend**
Parte invisível que processa dados e lógica de negócio (Supabase, PostgreSQL).

### **API**
Ponte que liga o frontend ao backend. Quando clicas "Marcar Consulta", o frontend usa a API para enviar os dados ao Supabase.

### **TypeScript**
Linguagem de programação (JavaScript melhorado) usada no projeto. Previne erros e facilita desenvolvimento.

### **React**
Biblioteca JavaScript para criar interfaces de utilizador. Permite criar componentes reutilizáveis.

---

## 📋 TIPOS DE DADOS

### **UUID (Universally Unique Identifier)**
Código único de 36 caracteres para identificar registos. Exemplo: `550e8400-e29b-41d4-a716-446655440000`

### **ENUM (Enumeração)**
Lista fixa de valores possíveis. Exemplo: status da consulta só pode ser `scheduled`, `confirmed`, `cancelled`, etc.

### **JSONB**
Formato para guardar dados em estrutura flexível (como um objeto JavaScript). Usado nas configurações da clínica.

### **Foreign Key (Chave Estrangeira)**
Link entre tabelas. Exemplo: cada consulta tem uma `patient_id` que aponta para a tabela `patients`.

---

## 🎯 TERMOS DO PROJETO

### **Specialty (Especialidade)**
Área médica: "Medicina Dentária" ou "Rejuvenescimento Facial".

### **Consultation Type (Tipo de Consulta)**
Serviço específico: "Ortodontia", "Botox", "Implantologia", etc.

### **Professional (Profissional)**
Médico ou técnico que realiza consultas.

### **Patient (Paciente)**
Pessoa que marca consultas. Identificada por NIF único.

### **Appointment (Consulta/Marcação)**
Marcação de uma consulta para data/hora específica.

### **Waitlist (Lista de Espera)**
Pacientes à espera de vaga quando não há horários disponíveis.

### **Appointment Request (Pedido de Marcação)**
Formulário submetido pelo website público. Precisa ser aprovado pelo admin antes de se tornar consulta.

---

## 🔄 ESTADOS E STATUS

### **Appointment Status**
- `scheduled` - Marcada (confirmar ainda)
- `confirmed` - Confirmada (paciente confirmou)
- `pre_confirmed` - Pré-confirmada (via WhatsApp)
- `waiting` - Em sala de espera (check-in feito)
- `in_progress` - Consulta a decorrer
- `completed` - Consulta terminada
- `cancelled` - Cancelada
- `no_show` - Paciente não compareceu

### **Request Status**
- `pending` - À espera de aprovação
- `approved` - Aprovado (convertido em consulta)
- `rejected` - Rejeitado
- `converted` - Já convertido em consulta

### **Message Status**
- `new` - Nova (não lida)
- `read` - Lida
- `archived` - Arquivada

---

## 📱 INTEGRAÇÕES

### **WhatsApp Workflows**
Sistema automático de envio de mensagens WhatsApp para:
- Confirmar consultas 24h antes
- Lembrar de deixar review
- Sugerir horários alternativos

### **Google Reviews**
Testemunhos/avaliações dos pacientes no Google. Aparecem automaticamente no website.

---

## 💡 DICAS DE LEITURA

### Quando vires este emoji...
- 🔴 = Crítico/Urgente
- 🟡 = Importante/Recomendado
- 🟢 = Opcional/Melhorias futuras
- ✅ = Concluído/OK
- ❌ = Problema/Erro
- ⚠️ = Atenção/Cuidado

---

## 🤔 AINDA COM DÚVIDAS?

Se encontrares um termo que não está aqui, procura em:
- [Documentação Supabase](https://supabase.com/docs)
- [Glossário PostgreSQL](https://www.postgresql.org/docs/current/glossary.html)

Ou adiciona o termo a este ficheiro para referência futura!

---

*Glossário atualizado em 27/01/2026*

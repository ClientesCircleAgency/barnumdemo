# MediFranco - Plano do Projeto

## Visão Geral
Website institucional moderno e mobile-first para a clínica MediFranco, especializada em medicina dentária e oftalmologia, com sistema de marcações online e área administrativa.

## Objetivos Principais
1. Apresentar a clínica e os seus serviços de forma profissional e atrativa
2. Permitir marcações de consultas online
3. Facilitar o contacto com potenciais pacientes
4. Fornecer área administrativa para gestão de marcações e mensagens
5. Mostrar testemunhos de clientes satisfeitos

## Funcionalidades Obrigatórias

### Landing Page
- [x] Hero Section com logotipo centrado e frase impactante
- [x] Secção "Sobre Nós" com cards da equipa médica
- [x] Secção de Serviços detalhados (Dentária + Oftalmologia)
- [x] Formulário de marcação de consultas
- [x] Slider de testemunhos automático
- [x] Mapa Google Maps com localização
- [x] Formulário de contacto
- [x] Rodapé com informações

### Área de Admin
- [x] Login com credenciais fixas
- [x] Dashboard com calendário de marcações
- [x] Lista de mensagens de contacto
- [x] Gestão de testemunhos (CRUD)

## Tecnologias Usadas
- **Frontend**: React + TypeScript + Vite
- **Styling**: TailwindCSS + shadcn/ui
- **Animações**: CSS animations + Intersection Observer
- **Carousel**: Embla Carousel
- **Forms**: React Hook Form + Zod
- **Storage**: localStorage (preparado para migração Supabase)
- **Maps**: Google Maps Embed

## Fluxo de Utilizador

### Visitante
1. Entra no site → vê Hero com logotipo
2. Scroll suave pelas secções
3. Pode marcar consulta via formulário
4. Pode enviar mensagem de contacto
5. Vê testemunhos de outros clientes
6. Encontra localização no mapa

### Administrador
1. Acede a /admin
2. Faz login com credenciais
3. Vê calendário de marcações
4. Gere mensagens de contacto
5. Adiciona/edita/remove testemunhos

## Fora de Escopo
- Login/registo de pacientes
- Sistema de pagamentos online
- Blog ou artigos
- Área de cliente personalizada
- Notificações por email/SMS
- Integração com agenda médica externa
- Modo escuro

# MediFranco - Knowledge Base

## Objetivos
- Website institucional profissional para clínica médica
- Foco em conversão (marcações e contactos)
- Design moderno, limpo e confiável
- Mobile-first com excelente UX

## Tech Stack
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- shadcn/ui (componentes base)
- Embla Carousel (slider testemunhos)
- React Hook Form + Zod (formulários)
- localStorage (persistência de dados)

## Regras Visuais

### Cores
- **Primário (Turquesa)**: HSL(172, 50%, 45%) - #3BB3A7
- **Secundário**: Tons de cinza
- **Background**: Branco (#FFFFFF)
- **Texto**: Cinza escuro
- **Accents**: Turquesa claro para hovers

### Tipografia
- Sans-serif moderna (Inter/System fonts)
- Títulos: Bold, tamanhos responsivos
- Corpo: Regular, boa legibilidade

### Layout
- Mobile-first
- Breakpoints: sm(640px), md(768px), lg(1024px), xl(1280px)
- Container max-width: 1280px
- Espaçamento consistente (4, 8, 16, 24, 32, 48, 64px)

### Componentes
- Botões com hover effects suaves
- Cards com sombras subtis e border-radius
- Inputs limpos com focus states
- Modais centrados com overlay

### Animações
- Reveal on scroll (fade-in + slide-up)
- Hover effects em botões e cards
- Transições suaves (300ms ease)
- Slider automático de testemunhos

### Proibições
- ❌ Modo escuro
- ❌ Cores diretas (usar sempre tokens)
- ❌ Animações pesadas ou distrativas
- ❌ Layout cluttered
- ❌ Imagens sem alt text

## Estrutura de Dados

### Appointment (Marcação)
```typescript
{
  id: string;
  name: string;
  email: string;
  phone: string;
  serviceType: 'dentaria' | 'oftalmologia';
  service: string;
  preferredDate: string;
  preferredTime: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}
```

### ContactMessage (Mensagem)
```typescript
{
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  createdAt: string;
}
```

### Testimonial (Testemunho)
```typescript
{
  id: string;
  clientName: string;
  content: string;
  rating: number; // 1-5
  isActive: boolean;
  createdAt: string;
}
```

## Informações da Clínica
- **Nome**: MediFranco
- **Morada**: Av. Francisco Sá Carneiro 43, Rio de Mouro, Portugal
- **Telefone**: (a definir)
- **Email**: (a definir)
- **Horário**: Segunda a Sexta: 9h-19h, Sábado: 9h-13h

## Admin Credentials
- **Email**: admin@example.com
- **Password**: qwertyuiop

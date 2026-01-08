import { TeamMember } from '@/types';

export const teamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Dra. Maria Santos',
    role: 'Diretora Clínica',
    specialty: 'Medicina Dentária',
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop&crop=face',
    shortBio: 'Liderança clínica com foco na excelência e atendimento humanizado.',
    bio: 'A Dra. Maria Santos lidera a nossa clínica com mais de 15 anos de experiência. Especializada em reabilitação oral complexa, o seu foco é garantir que cada paciente recebe um tratamento personalizado e de alta qualidade.',
  },
  {
    id: '2',
    name: 'Dra. Sofia Martins',
    role: 'Medicina Estética',
    specialty: 'Rejuvenescimento Facial',
    image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop&crop=face', // Reusing a female doctor image or swap with another
    shortBio: 'Especialista em harmonização facial e tratamentos minimamente invasivos.',
    bio: 'A Dra. Sofia Martins é apaixonada pela arte de realçar a beleza natural. Com vasta formação em medicina estética avançada, dedica-se a tratamentos de rejuvenescimento e harmonização facial, sempre com resultados naturais e elegantes.',
  },
  {
    id: '3',
    name: 'Dra. Ana Costa',
    role: 'Ortodontista',
    specialty: 'Medicina Dentária',
    image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop&crop=face',
    shortBio: 'Transformando sorrisos através da ortodontia moderna e invisível.',
    bio: 'A Dra. Ana Costa dedica-se exclusivamente à ortodontia. Certificada nas mais recentes técnicas de alinhadores invisíveis, ela combina estética e função para criar sorrisos harmoniosos para crianças e adultos.',
  },
];

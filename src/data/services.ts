import { Service } from '@/types';

// Dental service images
import ortodontiaImg from '@/assets/services/ortodontia.png';
import implantologiaImg from '@/assets/services/implantologia.png';
import branqueamentoImg from '@/assets/services/branqueamento.png';
import protesesImg from '@/assets/services/proteses.png';
import endodontiaImg from '@/assets/services/endodontia.png';
import cirurgiaOralImg from '@/assets/services/cirurgia-oral.png';

// Facial Rejuvenation service images
import botoxImg from '@/assets/services/botox-premium.png';
import fillerImg from '@/assets/services/filler-premium.png';
import peelingImg from '@/assets/services/peeling-premium.png';
import mesoterapiaImg from '@/assets/services/mesoterapia-premium.png';
import harmonizacaoImg from '@/assets/services/harmonizacao-premium.png';
import bioestimuladoresImg from '@/assets/services/bioestimuladores-premium.png';

export const dentalServices: Service[] = [
  {
    id: 'ortodontia',
    name: 'Ortodontia',
    description: 'Correção de má oclusão e alinhamento dentário com aparelhos fixos, removíveis e alinhadores invisíveis.',
    icon: 'Smile',
    category: 'dentaria',
    image: ortodontiaImg,
  },
  {
    id: 'implantologia',
    name: 'Implantologia',
    description: 'Substituição de dentes perdidos por implantes de titânio, devolvendo função e estética natural.',
    icon: 'CircleDot',
    category: 'dentaria',
    image: implantologiaImg,
  },
  {
    id: 'branqueamento',
    name: 'Branqueamento',
    description: 'Técnicas avançadas para clarear os dentes de forma segura e eficaz, com resultados duradouros.',
    icon: 'Sparkles',
    category: 'dentaria',
    image: branqueamentoImg,
  },
  {
    id: 'proteses',
    name: 'Próteses Dentárias',
    description: 'Soluções removíveis ou fixas para substituir dentes em falta e recuperar a função mastigatória.',
    icon: 'LayoutGrid',
    category: 'dentaria',
    image: protesesImg,
  },
  {
    id: 'endodontia',
    name: 'Endodontia',
    description: 'Tratamento de canais radiculares para salvar dentes danificados por cáries profundas ou traumas.',
    icon: 'Target',
    category: 'dentaria',
    image: endodontiaImg,
  },
  {
    id: 'cirurgia-oral',
    name: 'Cirurgia Oral',
    description: 'Extração de sisos, cirurgias pré-protéticas e tratamento de patologias da cavidade oral.',
    icon: 'Scissors',
    category: 'dentaria',
    image: cirurgiaOralImg,
  },
];

export const facialRejuvenationServices: Service[] = [
  {
    id: 'toxina-botulinica',
    name: 'Toxina Botulínica (Botox)',
    description: 'Prevenção e tratamento de rugas de expressão, proporcionando um aspeto mais jovem e relaxado.',
    icon: 'Sparkles',
    category: 'rejuvenescimento',
    image: botoxImg,
  },
  {
    id: 'acido-hialuronico',
    name: 'Preenchimento com Ácido Hialurónico',
    description: 'Restruturação de volumes faciais, preenchimento de rugas e hidratação profunda da pele.',
    icon: 'Droplets',
    category: 'rejuvenescimento',
    image: fillerImg,
  },
  {
    id: 'peeling',
    name: 'Peeling Químico',
    description: 'Renovação celular para tratar manchas, acne e melhorar a textura e luminosidade da pele.',
    icon: 'Eraser',
    category: 'rejuvenescimento',
    image: peelingImg,
  },
  {
    id: 'mesoterapia',
    name: 'Mesoterapia Facial',
    description: 'Cocktail de vitaminas e nutrientes para revitalizar a pele e melhorar a sua firmeza.',
    icon: 'Syringe',
    category: 'rejuvenescimento',
    image: mesoterapiaImg,
  },
  {
    id: 'bioestimuladores',
    name: 'Bioestimuladores de Colagénio',
    description: 'Estímulo da produção natural de colagénio para combater a flacidez e melhorar a qualidade da pele.',
    icon: 'Layers',
    category: 'rejuvenescimento',
    image: bioestimuladoresImg,
  },
  {
    id: 'harmonizacao',
    name: 'Harmonização Facial',
    description: 'Conjunto de procedimentos para equilibrar as proporções faciais e realçar a beleza natural.',
    icon: 'Frame',
    category: 'rejuvenescimento',
    image: harmonizacaoImg,
  },
];

export const allServices = [...dentalServices, ...facialRejuvenationServices];

export interface Appointment {
  id: string;
  name: string;
  email: string;
  phone: string;
  nif: string;
  serviceType: 'dentaria' | 'oftalmologia';
  preferredDate: string;
  preferredTime: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  createdAt: string;
}

export interface Testimonial {
  id: string;
  clientName: string;
  content: string;
  rating: number;
  isActive: boolean;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  specialty: string;
  image: string;
  shortBio: string;
  bio: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'dentaria' | 'rejuvenescimento';
  image?: string;
}

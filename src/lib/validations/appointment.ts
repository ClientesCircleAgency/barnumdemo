import { z } from 'zod';

export const appointmentFormSchema = z.object({
  consultationTypeId: z
    .string()
    .uuid({ message: 'Tipo de consulta invalido' })
    .min(1, { message: 'Tipo de consulta e obrigatorio' }),
  professionalId: z
    .string()
    .uuid({ message: 'Profissional invalido' })
    .min(1, { message: 'Profissional e obrigatorio' }),
  specialtyId: z
    .string()
    .uuid({ message: 'Especialidade invalida' })
    .optional()
    .or(z.literal('')),
  date: z
    .date({ required_error: 'Data e obrigatoria' }),
  time: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Hora invalida' }),
  duration: z
    .number()
    .int({ message: 'Duracao deve ser um numero inteiro de minutos' })
    .min(5, { message: 'Duracao minima e 5 minutos' })
    .max(1440, { message: 'Duracao maxima e 1440 minutos' }),
  notes: z
    .string()
    .max(1000, { message: 'Observacoes devem ter no maximo 1000 caracteres' })
    .optional()
    .or(z.literal('')),
  sendConfirmation: z.boolean().default(true),
});

export type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

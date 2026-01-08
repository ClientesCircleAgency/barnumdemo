import { z } from 'zod';

export const appointmentFormSchema = z.object({
  consultationTypeId: z
    .string()
    .uuid({ message: 'Tipo de consulta inválido' })
    .min(1, { message: 'Tipo de consulta é obrigatório' }),
  professionalId: z
    .string()
    .uuid({ message: 'Profissional inválido' })
    .min(1, { message: 'Profissional é obrigatório' }),
  specialtyId: z
    .string()
    .uuid({ message: 'Especialidade inválida' })
    .optional()
    .or(z.literal('')),
  date: z
    .date({ required_error: 'Data é obrigatória' }),
  time: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Hora inválida' }),
  duration: z
    .number()
    .min(15, { message: 'Duração mínima é 15 minutos' })
    .max(240, { message: 'Duração máxima é 240 minutos' }),
  notes: z
    .string()
    .max(1000, { message: 'Observações devem ter no máximo 1000 caracteres' })
    .optional()
    .or(z.literal('')),
  roomId: z
    .string()
    .uuid({ message: 'Sala inválida' })
    .optional()
    .or(z.literal('')),
  sendConfirmation: z.boolean().default(true),
});

export type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

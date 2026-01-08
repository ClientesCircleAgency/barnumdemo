import { z } from 'zod';

// Portuguese NIF validation with checksum
const validatePortugueseNIF = (nif: string): boolean => {
  if (!/^\d{9}$/.test(nif)) return false;
  
  const checkDigit = parseInt(nif[8]);
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i]) * (9 - i);
  }
  const remainder = sum % 11;
  const expectedCheck = remainder < 2 ? 0 : 11 - remainder;
  
  return checkDigit === expectedCheck;
};

// Portuguese phone number regex (9 digits starting with 9, 2, or 3)
const phoneRegex = /^[923]\d{8}$/;

export const patientFormSchema = z.object({
  nif: z
    .string()
    .length(9, { message: 'NIF deve ter 9 dígitos' })
    .regex(/^\d{9}$/, { message: 'NIF deve conter apenas números' })
    .refine(validatePortugueseNIF, { message: 'NIF inválido' }),
  name: z
    .string()
    .trim()
    .min(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
    .max(100, { message: 'Nome deve ter no máximo 100 caracteres' }),
  phone: z
    .string()
    .regex(phoneRegex, { message: 'Telefone inválido (9 dígitos, começando por 9, 2 ou 3)' }),
  email: z
    .string()
    .trim()
    .email({ message: 'Email inválido' })
    .max(255, { message: 'Email deve ter no máximo 255 caracteres' })
    .optional()
    .or(z.literal('')),
  birthDate: z
    .string()
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, { message: 'Observações devem ter no máximo 1000 caracteres' })
    .optional()
    .or(z.literal('')),
});

export type PatientFormData = z.infer<typeof patientFormSchema>;

// Schema for inline patient creation (without NIF since it's already validated)
export const inlinePatientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
    .max(100, { message: 'Nome deve ter no máximo 100 caracteres' }),
  phone: z
    .string()
    .regex(phoneRegex, { message: 'Telefone inválido (9 dígitos, começando por 9, 2 ou 3)' }),
  email: z
    .string()
    .trim()
    .email({ message: 'Email inválido' })
    .max(255, { message: 'Email deve ter no máximo 255 caracteres' })
    .optional()
    .or(z.literal('')),
  birthDate: z
    .string()
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, { message: 'Observações devem ter no máximo 1000 caracteres' })
    .optional()
    .or(z.literal('')),
});

export type InlinePatientFormData = z.infer<typeof inlinePatientFormSchema>;

import { z } from 'zod';
import { PHONE_COUNTRIES } from '@/lib/phone';

// Portuguese NIF validation with checksum.
const validatePortugueseNIF = (nif: string): boolean => {
  if (!/^\d{9}$/.test(nif)) return false;

  const checkDigit = parseInt(nif[8], 10);
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i], 10) * (9 - i);
  }
  const remainder = sum % 11;
  const expectedCheck = remainder < 2 ? 0 : 11 - remainder;

  return checkDigit === expectedCheck;
};

const phoneCountrySchema = z.enum(['PT', 'BR']);

const validatePhoneForCountry = (
  data: { countryCode: z.infer<typeof phoneCountrySchema>; phone: string },
  ctx: z.RefinementCtx
) => {
  const digits = data.phone.replace(/\D/g, '');
  const config = PHONE_COUNTRIES[data.countryCode];

  if (!config.regex.test(digits)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: config.invalidMessage,
      path: ['phone'],
    });
  }
};

export const patientFormSchema = z.object({
  nif: z
    .string()
    .length(9, { message: 'NIF deve ter 9 digitos' })
    .regex(/^\d{9}$/, { message: 'NIF deve conter apenas numeros' })
    .refine(validatePortugueseNIF, { message: 'NIF invalido' }),
  name: z
    .string()
    .trim()
    .min(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
    .max(100, { message: 'Nome deve ter no maximo 100 caracteres' }),
  countryCode: phoneCountrySchema,
  phone: z
    .string()
    .min(1, { message: 'Telefone obrigatorio' })
    .max(20, { message: 'Telefone invalido' }),
  email: z
    .string()
    .trim()
    .email({ message: 'Email invalido' })
    .max(255, { message: 'Email deve ter no maximo 255 caracteres' })
    .optional()
    .or(z.literal('')),
  birthDate: z
    .string()
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, { message: 'Observacoes devem ter no maximo 1000 caracteres' })
    .optional()
    .or(z.literal('')),
}).superRefine(validatePhoneForCountry);

export type PatientFormData = z.infer<typeof patientFormSchema>;

// Schema for inline patient creation (without NIF since it's already validated).
export const inlinePatientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
    .max(100, { message: 'Nome deve ter no maximo 100 caracteres' }),
  countryCode: phoneCountrySchema,
  phone: z
    .string()
    .min(1, { message: 'Telefone obrigatorio' })
    .max(20, { message: 'Telefone invalido' }),
  email: z
    .string()
    .trim()
    .email({ message: 'Email invalido' })
    .max(255, { message: 'Email deve ter no maximo 255 caracteres' })
    .optional()
    .or(z.literal('')),
  birthDate: z
    .string()
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, { message: 'Observacoes devem ter no maximo 1000 caracteres' })
    .optional()
    .or(z.literal('')),
}).superRefine(validatePhoneForCountry);

export type InlinePatientFormData = z.infer<typeof inlinePatientFormSchema>;

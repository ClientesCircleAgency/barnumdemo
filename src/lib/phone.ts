export const PHONE_COUNTRIES = {
  PT: {
    code: '+351',
    flag: '🇵🇹',
    label: 'Portugal',
    maxLength: 9,
    placeholder: '912 345 678',
    regex: /^[923]\d{8}$/,
    invalidMessage: 'Número PT inválido (9 dígitos, começa por 9, 2 ou 3)',
  },
  BR: {
    code: '+55',
    flag: '🇧🇷',
    label: 'Brasil',
    maxLength: 11,
    placeholder: '119 1234 5678',
    regex: /^\d{10,11}$/,
    invalidMessage: 'Número BR inválido (10-11 dígitos: DDD + número)',
  },
} as const;

export type PhoneCountry = keyof typeof PHONE_COUNTRIES;

export function normalizePhone(phone: string, country: PhoneCountry = 'PT'): string {
  const digits = phone.replace(/\D/g, '');

  if (!digits) {
    return phone.trim();
  }

  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }

  if (digits.startsWith('351') && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }

  if (country === 'PT' && digits.startsWith('00351') && digits.length === 14) {
    return `+351${digits.slice(5)}`;
  }

  if (country === 'PT') {
    return `+351${digits}`;
  }

  return `+55${digits}`;
}

export function normalizePortuguesePhone(phone: string): string {
  return normalizePhone(phone, 'PT');
}

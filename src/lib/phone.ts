export function normalizePortuguesePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (!digits) {
    return phone.trim();
  }

  if (digits.startsWith('00351') && digits.length === 14) {
    return `+351${digits.slice(5)}`;
  }

  if (digits.startsWith('351') && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.length === 9) {
    return `+351${digits}`;
  }

  return `+351${digits}`;
}

// Only expose known messages and safe error codes, never backend details/patient data.
export function appointmentErrorMessage(error: unknown): string {
  const value = error as { code?: string; message?: string } | null;
  const code = value?.code;
  const message = value?.message ?? '';
  if (code === '40001' || message.startsWith('A consulta foi alterada.'))
    return 'A consulta foi alterada entretanto. Atualize a página e tente novamente. [40001]';
  if (code === '42501')
    return 'A sessão atual não tem permissão para esta alteração. Contacte o administrador. [42501]';
  if (code === 'PGRST301' || code === 'PGRST303')
    return 'A sessão expirou. Entre novamente na sua conta.';
  if (message === 'invalid_transition')
    return 'Este movimento não é permitido no estado atual da consulta. Atualize a página.';
  if (code === 'PGRST116')
    return 'Não foi possível aceder à consulta. Atualize a página e confirme a sua sessão. [PGRST116]';
  if (/failed to fetch|networkerror|load failed/i.test(message))
    return 'Não foi possível ligar ao servidor. Verifique a ligação e tente novamente.';
  const reference = code && /^[A-Z0-9]{5,12}$/.test(code) ? code : 'SEM-CODIGO';
  return `Não foi possível atualizar a consulta. Comunique este código ao administrador: ${reference}.`;
}

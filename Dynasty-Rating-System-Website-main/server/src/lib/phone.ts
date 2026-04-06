const MAX_PHONE_DIGITS = 15;

export function normalizePhone(raw?: string | null) {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return undefined;
  const limited = digits.slice(0, MAX_PHONE_DIGITS);

  return hasLeadingPlus ? `+${limited}` : limited;
}

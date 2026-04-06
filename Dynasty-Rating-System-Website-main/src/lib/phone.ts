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

export function sanitizePhoneInput(value: string) {
  if (!value) return '';
  const stripped = value.replace(/[^\d+()\-\s]/g, '');
  const hasLeadingPlus = stripped.startsWith('+');
  const withoutPlus = stripped.replace(/\+/g, '');
  return hasLeadingPlus ? `+${withoutPlus}` : withoutPlus;
}

export function phoneDigits(value?: string | null) {
  const normalized = normalizePhone(value);
  return normalized ? normalized.replace(/\D/g, '') : '';
}

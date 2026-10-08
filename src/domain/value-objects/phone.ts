export function normalizePhone(raw: unknown): string {
  if (typeof raw !== 'string' || raw.includes('{{')) return '';
  let value = raw.trim().replace(/[\s()-]/g, '');
  if (/^0\d{9}$/.test(value)) value = '+593' + value.slice(1);
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : '';
}

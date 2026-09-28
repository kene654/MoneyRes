export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function parseRupees(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/₹/g, '').trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function paiseToInput(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}

export function formatINR(paise: number, digits: 0 | 2 = 0): string {
  const sign = paise < 0 ? '-' : '';
  const rupees = Math.abs(paise) / 100;
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rupees);
  return sign + formatted;
}

export function formatRate(rate: number): string {
  const rounded = Math.round(rate * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded}%`;
}

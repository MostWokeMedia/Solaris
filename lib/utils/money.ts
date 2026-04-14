export function formatMoney(n: number): string {
  if (n === 0) return '\u2014';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (n < 0 ? '-$' : '$') + formatted;
}

export function formatMoneyShort(n: number): string {
  if (n === 0) return '\u2014';
  if (Math.abs(n) >= 1000) {
    return (n < 0 ? '-$' : '$') + (Math.abs(n) / 1000).toFixed(1) + 'k';
  }
  return formatMoney(n);
}

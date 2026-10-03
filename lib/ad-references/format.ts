export function timecode(seconds: number): string {
  const tenths = Math.round(seconds * 10);
  const minutes = Math.floor(tenths / 600);
  const remainder = (tenths % 600) / 10;
  const whole = Math.floor(remainder).toString().padStart(2, '0');
  return `${minutes}:${whole}${tenths % 10 ? `.${tenths % 10}` : ''}`;
}

export function observedDate(date: string): string {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

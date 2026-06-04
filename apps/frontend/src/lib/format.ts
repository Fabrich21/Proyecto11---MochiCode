export function formatNumberES(value?: number) {
  if (value === undefined || value === null) return '';
  return value.toLocaleString('es-ES');
}

export function formatDate(value?: string | Date | null) {
  if (!value) return 'No registrado';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('es-ES', { hour12: false });
}

export function timeAgoFrom(value?: string | Date) {
  if (!value) return '';
  const now = Date.now();
  const then = typeof value === 'string' ? new Date(value).getTime() : (value as Date).getTime();
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

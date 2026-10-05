export type Severity = 'high' | 'medium' | 'low';
export const severity = (confidence: number): Severity =>
  confidence >= 0.75 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
export const severityColors = { high: '#9c2c2c', medium: '#8f6512', low: '#1f5d4c' };
export function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}
export function ago(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Unknown';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  return minutes < 60
    ? `${minutes} min ago`
    : minutes < 2880
      ? `${Math.round(minutes / 60)} h ago`
      : `${Math.round(minutes / 1440)} d ago`;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

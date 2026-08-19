export function formatBytes(value: unknown): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const formatted = value / 1024 ** exp;
  return `${formatted.toFixed(exp === 0 ? 0 : 2)} ${units[exp]}`;
}

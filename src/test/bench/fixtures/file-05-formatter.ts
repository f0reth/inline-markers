// NOTE: all formatters return strings; consumers handle localisation themselves
export interface FormatOptions {
  locale?: string;
  timezone?: string;
}

export function formatDate(ts: number, opts: FormatOptions = {}): string {
  return new Date(ts).toLocaleDateString(opts.locale ?? "en-US", {
    timeZone: opts.timezone,
  });
}

export function formatTime(ts: number, opts: FormatOptions = {}): string {
  return new Date(ts).toLocaleTimeString(opts.locale ?? "en-US", {
    timeZone: opts.timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(ts: number, opts: FormatOptions = {}): string {
  return `${formatDate(ts, opts)} ${formatTime(ts, opts)}`;
}

// TODO: handle currencies that don't use decimal points
export function formatCurrency(amount: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function truncate(text: string, maxLength: number, ellipsis = "..."): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// NOTE: does not escape HTML entities — use escapeHtml before calling if needed
export function highlight(text: string, query: string): string {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), (m) => `<mark>${m}</mark>`);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// TODO: support named placeholders like {name}
export function template(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export function padStart(value: string | number, length: number, char = " "): string {
  return String(value).padStart(length, char);
}

export function padEnd(value: string | number, length: number, char = " "): string {
  return String(value).padEnd(length, char);
}

export function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

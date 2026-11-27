// Small helpers the list screens share: money, Lagos time and CSV downloads. They run in the browser.

export const naira = (value: number | null): string =>
  value == null ? "—" : `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Always Lagos time, so the server and the browser print the same text.
export function formatDateTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value)).replace(" at ", ", ");
}

// A cell that starts with = + - or @ would run as a formula in Excel, so it gets a leading apostrophe.
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${/^[=+\-@\t\r]/.test(text) ? "'" : ""}${text.replaceAll('"', '""')}"`;
}

export function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const today = () => new Date().toISOString().slice(0, 10);

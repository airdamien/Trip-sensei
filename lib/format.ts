export function eachDate(startLocal: string, endLocal: string): string[] {
  const start = startLocal.slice(0, 10);
  const end = endLocal.slice(0, 10);
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end && dates.length < 21) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates.length ? dates : [start];
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function utcDow(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function clockMinutes(local: string): number {
  const time = local.split("T")[1] || "09:00";
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToLabel(mins: number): string {
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

export function formatDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

export function formatRange(startLocal: string, endLocal: string): string {
  const a = formatDay(startLocal.slice(0, 10));
  const b = formatDay(endLocal.slice(0, 10));
  return `${a} – ${b}`;
}

const HOLIDAYS: Record<string, string> = {
  "2026-11-03": "Culture Day, a national holiday. Museums and trains will be busy.",
  "2026-11-23": "Labor Thanksgiving Day.",
};

export function holidayNote(ymd: string): string | null {
  if (HOLIDAYS[ymd]) return HOLIDAYS[ymd];
  const day = utcDow(ymd);
  if (day === 0 || day === 6) {
    return "Weekend trains fill up. Leave earlier than you would on a weekday.";
  }
  return null;
}

export function isBusyDate(ymd: string): boolean {
  return holidayNote(ymd) !== null;
}

const YEN_PER_USD = 150;

export function yen(amount: number | null): string {
  if (amount === null) return "Fare on the day";
  if (amount === 0) return "Free";
  const dollars = amount / YEN_PER_USD;
  const usd = dollars >= 20 ? `$${Math.round(dollars).toLocaleString("en-US")}` : `$${dollars.toFixed(2)}`;
  return `${usd} · ¥${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatCode(code: string): string {
  if (code.length !== 6) return code || "Local";
  return `${code.slice(0, 3)}·${code.slice(3)}`;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function tokyoDate(ymd: string, minutes: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  return new Date(Date.UTC(y, m - 1, d, h - 9, min, 0));
}

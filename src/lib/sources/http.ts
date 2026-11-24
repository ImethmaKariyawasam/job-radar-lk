// Honest identification: we never pretend to be a browser.
const UA = "JobRadarLK/0.2 (+https://github.com/ImethmaKariyawasam/job-radar-lk)";

export async function http(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "application/json, text/html;q=0.9", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}`);
  return res;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await http(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

export async function getJson<T>(url: string): Promise<T> {
  return (await http(url)).json() as Promise<T>;
}

/** "Posted 5 Days Ago" / "Posted Today" / "Posted 30+ Days Ago" -> ISO date */
export function relativeToIso(text: string | undefined, now = new Date()): string | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  const d = new Date(now);
  if (t.includes("today")) return d.toISOString();
  if (t.includes("yesterday")) {
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }
  const m = t.match(/(\d+)\+?\s*day/);
  if (m) {
    d.setDate(d.getDate() - Number(m[1]));
    return d.toISOString();
  }
  return undefined;
}

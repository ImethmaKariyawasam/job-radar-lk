import { lookupCompany } from "../companies";
import type { Job } from "../types";
import { http } from "./http";
import { decodeHtml } from "./pages";

/**
 * John Keells Group careers (SAP SuccessFactors). The public search page is an HTML table,
 * 10 jobs per page. The group has many non-IT companies (supermarkets, hotels…), so we keep
 * only rows whose company column matches a company in our registry (John Keells IT, Octave…).
 * robots.txt allows /search/ (it only disallows apply/talent-community paths).
 */
const BASE = "https://careers.keells.com";

export async function fetchKeells(): Promise<Job[]> {
  const jobs: Job[] = [];
  let total = Infinity;
  for (let start = 0; start < total && start < 200; start += 10) {
    const html = await (
      await http(`${BASE}/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=${start}`)
    ).text();
    if (start === 0) {
      const m = html.match(/Results\s*<b>[^<]*<\/b>\s*of\s*<b>(\d+)<\/b>/);
      total = m ? Number(m[1]) : 10;
    }
    const rows = [...html.matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/g)];
    if (rows.length === 0) break;

    for (const [, row] of rows) {
      const link = row.match(/<a[^>]+href="([^"]+)"[^>]*class="jobTitle-link"[^>]*>([^<]+)<\/a>/) ??
        row.match(/<a[^>]+class="jobTitle-link"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
      const dept = decodeHtml(row.match(/class="jobDepartment">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const company = lookupCompany(dept);
      if (!link || !company) continue;

      const location = decodeHtml(row.match(/class="colLocation[^"]*"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? "");
      const date = decodeHtml(row.match(/class="jobDate">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const posted = new Date(`${date} UTC`);
      jobs.push({
        id: `jk:${link[1]}`,
        title: decodeHtml(link[2]),
        company: company.name,
        tier: company.tier,
        location: location.replace(/, LK$/, ", Sri Lanka"),
        postedAt: isNaN(posted.getTime()) ? undefined : posted.toISOString(),
        url: BASE + link[1],
        source: "John Keells careers",
      });
    }
  }
  return jobs;
}

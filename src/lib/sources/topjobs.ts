import { lookupCompany } from "../companies";
import type { Job } from "../types";
import { http } from "./http";

/**
 * topjobs.lk — Sri Lanka's biggest job board. The "IT - Software/DB/QA/Web/Graphics/GIS"
 * category page (FA=SDQ) is server-rendered HTML listing every open IT vacancy.
 * We fetch that ONE page per cache window (see aggregate.ts), not per search.
 */
const CATEGORY_URL = "https://www.topjobs.lk/applicant/vacancybyfunctionalarea.jsp?FA=SDQ";

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const toIso = (s: string) => {
  const d = new Date(`${s.trim()} UTC`); // "Thu Nov 26 2026" (UTC so the calendar day never shifts)
  return isNaN(d.getTime()) ? undefined : d.toISOString();
};

export async function fetchTopjobs(): Promise<Job[]> {
  const res = await http(CATEGORY_URL, {}, 25000);
  // Page is ISO-8859-1; decode explicitly so names like "360°" survive
  const html = new TextDecoder("latin1").decode(await res.arrayBuffer());

  const jobs: Job[] = [];
  const rowRe = /<tr id="tr\d+" onclick="createAlert\('(\d+)','([^']*)','([^']*)','([^']*)'[^"]*">([\s\S]*?)<\/tr>/g;
  for (const m of html.matchAll(rowRe)) {
    const [, rid, ac, jc, ec, body] = m;
    const title = body.match(/<h2>\s*<span>([\s\S]*?)<\/span>\s*<\/h2>/)?.[1];
    const employer = body.match(/<h1>([\s\S]*?)<\/h1>/)?.[1];
    if (!title || !employer) continue;

    // td cells (comments stripped): [#, ref, title/employer, desc, opening, closing, location]
    const cells = [...body.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
      decode(c[1]),
    );
    const company = decode(employer);
    const known = lookupCompany(company);

    jobs.push({
      id: `tj:${jc}`,
      title: decode(title).replace(/\s*\(\d+\)\s*$/, ""), // drop "(1)" vacancy-count suffix
      company: known?.name ?? company,
      tier: known?.tier ?? 4,
      location: cells[6] ?? "",
      postedAt: cells[4] ? toIso(cells[4]) : undefined,
      closesAt: cells[5] ? toIso(cells[5]) : undefined,
      url: `https://www.topjobs.lk/employer/JobAdvertismentServlet?rid=${rid}&ac=${ac}&jc=${jc}&ec=${ec}&pg=applicant/vacancybyfunctionalarea.jsp`,
      source: "topjobs.lk",
    });
  }
  if (jobs.length === 0) throw new Error("topjobs.lk page layout changed — parsed 0 jobs");
  return jobs;
}

import { lookupCompany } from "../companies";
import type { Job } from "../types";
import { http } from "./http";
import { decodeHtml } from "./pages";

/**
 * itpro.lk — Sri Lankan IT-only job board. Public HTML, robots.txt allows /jobs/.
 * 50 jobs per page, newest first. We read pages until postings are older than MAX_AGE_DAYS,
 * pausing between pages so we never hit the site in a burst.
 */
const MAX_AGE_DAYS = 30;
const MAX_PAGES = 8;
const PAUSE_MS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchItpro(): Promise<Job[]> {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const jobs: Job[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await sleep(PAUSE_MS);
    const html = await (await http(`https://itpro.lk/jobs/?p=${page}`)).text();
    const cards = [...html.matchAll(/<article class="job-card" id="(\d+)">([\s\S]*?)<\/article>/g)];
    if (cards.length === 0) {
      if (page === 1) throw new Error("itpro.lk page layout changed — parsed 0 jobs");
      break;
    }

    let fresh = 0;
    let repeated = 0;
    for (const [, id, body] of cards) {
      // Past the last page the site starts over at page 1 — stop when we see repeats
      if (seen.has(id)) {
        repeated++;
        continue;
      }
      seen.add(id);
      const url = body.match(/<a href="(https:\/\/itpro\.lk\/job\/[^"]+)"/)?.[1];
      const title = body.match(/class="jc-title">([\s\S]*?)<\/h[23]>/)?.[1]; // h2 on /jobs/, h3 on homepage
      const employer = decodeHtml(body.match(/class="jc-company">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const location = decodeHtml(body.match(/<span class="la">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const posted = body.match(/datetime="([^"]+)"/)?.[1];
      if (!url || !title) continue;

      const postedMs = posted ? Date.parse(posted) : NaN;
      if (!isNaN(postedMs) && postedMs < cutoff) continue;
      fresh++;

      const known = lookupCompany(employer);
      jobs.push({
        id: `it:${id}`,
        title: decodeHtml(title),
        company: known?.name ?? employer,
        tier: known?.tier ?? 4,
        location,
        postedAt: isNaN(postedMs) ? undefined : new Date(postedMs).toISOString(),
        url,
        source: "itpro.lk",
      });
    }
    if (page === 1 && jobs.length === 0) throw new Error("itpro.lk job cards changed — read 0 jobs from page 1");
    if (fresh === 0 || repeated === cards.length) break; // everything left is old or repeated
  }
  return jobs;
}

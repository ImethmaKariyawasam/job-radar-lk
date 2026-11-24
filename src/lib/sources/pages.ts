import type { Company, Feed } from "../companies";
import type { Job } from "../types";
import { http } from "./http";

/**
 * Readers for company careers pages whose public HTML already contains the job list.
 * Each one reads ONE page per cache window, the same page any visitor sees.
 * If a company redesigns its page, its reader throws and the UI shows it as a failed source.
 */

export const decodeHtml = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

type Parsed = { title: string; url: string; location: string; closesAt?: string };

/** "30th September 2027" -> ISO date */
const parseLongDate = (s: string) => {
  const d = new Date(`${s.replace(/(\d+)(st|nd|rd|th)/, "$1")} UTC`);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
};

const PAGES: Record<Extract<Feed, { kind: "page" }>["parser"], { url: string; parse: (html: string) => Parsed[] }> = {
  // 99x embeds its positions as JSON objects: {"href":"…","title":"…","intro":"…","location":{"value":"sri-lanka",…}}
  "99x": {
    url: "https://99x.io/careers/open-positions?location=sri-lanka",
    parse: (html) =>
      [
        ...html.matchAll(
          /\{"href":"(https:\/\/99x\.io\/careers\/open-positions\/[^"]+)","title":"((?:[^"\\]|\\.)+)","intro":"(?:[^"\\]|\\.)*","location":\{"value":"([^"]+)","label":"([^"]+)"\}/g,
        ),
      ]
        .filter((m) => m[3] === "sri-lanka")
        .map((m) => ({ url: m[1], title: JSON.parse(`"${m[2]}"`), location: m[4] })),
  },

  // Gapstars: <a href="/careers/slug" class="…resultItem"> … location span … <span class="…resultTitle">Title</span>
  gapstars: {
    url: "https://www.gapstars.net/careers",
    parse: (html) =>
      [...html.matchAll(/<a href="(\/careers\/[a-z0-9-]+)" class="[^"]*resultItem[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => {
        const body = m[2];
        const title = body.match(/class="[^"]*resultTitle[^"]*">([\s\S]*?)<\/span>/)?.[1] ?? "";
        const location = body.match(/resultLocation[\s\S]*?<span>([^<]+)<\/span>/)?.[1] ?? "";
        return { url: `https://www.gapstars.net${m[1]}`, title: decodeHtml(title), location: decodeHtml(location) };
      }),
  },

  // Octave (John Keells): <div class="desig">Title</div><div class="close">Closing Date: <span>…</span></div> … <a href="…/job-invite/N/">
  octave: {
    url: "https://www.octave.lk/our-careers/",
    parse: (html) =>
      [
        ...html.matchAll(
          /class="desig">([\s\S]*?)<\/div>\s*<div class="close">[^<]*<span>([^<]*)<\/span>[\s\S]*?href="(https:\/\/careers\.keells\.com\/job-invite\/\d+\/?)"/g,
        ),
      ].map((m) => ({ title: decodeHtml(m[1]), closesAt: parseLongDate(m[2]), url: m[3], location: "Colombo, Sri Lanka" })),
  },

  // PickMe: <div class="job-summery"><span>Dept</span><h4>Title</h4><strong>Location</strong></div> … <a href="…/vacancy/slug/">
  pickme: {
    url: "https://pickme.lk/careers/",
    parse: (html) =>
      [
        ...html.matchAll(
          /class="job-summery">[\s\S]*?<h4>([\s\S]*?)<\/h4>\s*<strong>([\s\S]*?)<\/strong>[\s\S]*?href="(https:\/\/pickme\.lk\/vacancy\/[^"]+)"/g,
        ),
      ].map((m) => ({ title: decodeHtml(m[1]), location: decodeHtml(m[2]), url: m[3] })),
  },
};

export async function fetchCareersPage(company: Company, feed: Extract<Feed, { kind: "page" }>): Promise<Job[]> {
  const page = PAGES[feed.parser];
  const html = await (await http(page.url)).text();
  const parsed = page.parse(html).filter((p) => p.title);

  // A page with zero parsed jobs but no "no openings" wording most likely means the layout changed.
  if (parsed.length === 0 && !/no (open|current) (positions|vacancies|openings)/i.test(html)) {
    throw new Error(`${company.name} careers page layout changed — parsed 0 jobs`);
  }

  const seen = new Set<string>();
  return parsed
    .filter((p) => !seen.has(p.url) && seen.add(p.url))
    .map((p) => ({
      id: `pg:${p.url}`,
      title: p.title,
      company: company.name,
      tier: company.tier,
      location: p.location,
      closesAt: p.closesAt,
      url: p.url,
      source: "Careers page" as const,
    }));
}

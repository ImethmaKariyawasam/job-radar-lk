import type { Job } from "../types";
import { getJson } from "./http";

/**
 * Free remote-job feeds, filtered to jobs a candidate in Sri Lanka can apply for.
 *
 * Their terms, which we follow:
 *  - Remotive: credit Remotive, link to the Remotive job URL, fetch at most ~4 times a day.
 *  - Jobicy:   credit Jobicy, Apply must go to the original job URL from the feed.
 *  - Himalayas: no restrictions stated; we use its search with country=Sri Lanka.
 * All remote jobs are shown in their own "Remote (worldwide)" section with the source named.
 */

/** Location text that means a Sri Lanka–based candidate is eligible */
const OPEN_TO_LK = /worldwide|anywhere|global|asia|apac|south asia|sri lanka|gmt\s*\+\s*5|utc\s*\+\s*5|emea.*asia/i;

const remoteJob = (j: Omit<Job, "tier" | "remote">): Job => ({ ...j, tier: 4, remote: true });

interface RemotiveResponse {
  jobs: {
    id: number;
    url: string;
    title: string;
    company_name: string;
    publication_date?: string;
    candidate_required_location?: string;
  }[];
}

export async function fetchRemotive(): Promise<Job[]> {
  const d = await getJson<RemotiveResponse>("https://remotive.com/api/remote-jobs?category=software-dev");
  return d.jobs
    .filter((j) => OPEN_TO_LK.test(j.candidate_required_location ?? ""))
    .map((j) =>
      remoteJob({
        id: `rm:${j.id}`,
        title: j.title,
        company: j.company_name,
        location: `Remote · ${j.candidate_required_location}`,
        postedAt: j.publication_date ? new Date(`${j.publication_date}Z`).toISOString() : undefined,
        url: j.url,
        source: "Remotive",
      }),
    );
}

interface JobicyResponse {
  jobs: { id: number; url: string; jobTitle: string; companyName: string; jobGeo?: string; pubDate?: string }[];
}

export async function fetchJobicy(): Promise<Job[]> {
  const d = await getJson<JobicyResponse>("https://jobicy.com/api/v2/remote-jobs?count=100&geo=anywhere");
  return d.jobs
    .filter((j) => OPEN_TO_LK.test(j.jobGeo ?? ""))
    .map((j) =>
      remoteJob({
        id: `jb:${j.id}`,
        title: decodeEntities(j.jobTitle),
        company: decodeEntities(j.companyName),
        location: `Remote · ${j.jobGeo}`,
        postedAt: j.pubDate,
        url: j.url,
        source: "Jobicy",
      }),
    );
}

interface HimalayasResponse {
  jobs: {
    guid: string;
    title: string;
    companyName: string;
    applicationLink: string;
    pubDate?: string | number;
    locationRestrictions?: string[];
  }[];
}

/** Himalayas is searched per query (it has 100k+ jobs, far too many to download). */
export async function searchHimalayas(phrase: string): Promise<Job[]> {
  const params = new URLSearchParams({ q: phrase, country: "Sri Lanka" });
  const d = await getJson<HimalayasResponse>(`https://himalayas.app/jobs/api/search?${params}`);
  return d.jobs.map((j) =>
    remoteJob({
      id: `hm:${j.guid}`,
      title: j.title,
      company: j.companyName,
      location: j.locationRestrictions?.length ? "Remote · selected countries incl. Sri Lanka" : "Remote · Worldwide",
      postedAt: j.pubDate ? new Date(Number(j.pubDate) * 1000).toISOString() : undefined,
      url: j.applicationLink,
      source: "Himalayas",
    }),
  );
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&#0?39;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/&#8211;/g, "–");

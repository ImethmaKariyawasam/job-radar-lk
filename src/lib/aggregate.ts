import { COMPANIES } from "./companies";
import { buildMatcher, tokenize } from "./roles";
import { fetchFeed } from "./sources/ats";
import { fetchKeells } from "./sources/keells";
import { fetchTopjobs } from "./sources/topjobs";
import type { Job, SearchResponse, SourceResult } from "./types";

// Each site is read at most once per 30 minutes, however many people search.
const TTL_MS = 30 * 60 * 1000;

interface Snapshot {
  jobs: Job[];
  sources: SourceResult[];
  fetchedAt: number;
}

// Module-level cache: one upstream fetch per TTL window, shared by all searches.
let snapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

async function timed(source: string, fn: () => Promise<Job[]>): Promise<{ jobs: Job[]; result: SourceResult }> {
  const start = Date.now();
  try {
    const jobs = await fn();
    return { jobs, result: { source, ok: true, count: jobs.length, ms: Date.now() - start } };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { jobs: [], result: { source, ok: false, count: 0, error, ms: Date.now() - start } };
  }
}

async function fetchAll(): Promise<Snapshot> {
  const tasks = [
    ...COMPANIES.filter((c) => c.feed).map((c) => timed(`${c.name} (${c.feed!.kind})`, () => fetchFeed(c))),
    timed("John Keells group (IT companies)", fetchKeells),
    timed("topjobs.lk (IT category)", fetchTopjobs),
  ];
  const results = await Promise.all(tasks);
  return {
    jobs: dedupe(results.flatMap((r) => r.jobs)),
    sources: results.map((r) => r.result),
    fetchedAt: Date.now(),
  };
}

/** Same company + same normalized title = same vacancy (e.g. posted on both its ATS and topjobs). Prefer the ATS copy. */
function dedupe(jobs: Job[]): Job[] {
  const seen = new Map<string, Job>();
  for (const j of jobs) {
    const key = `${j.company.toLowerCase()}|${tokenize(j.title).sort().join(" ")}`;
    const prev = seen.get(key);
    if (!prev || (prev.source === "topjobs.lk" && j.source !== "topjobs.lk")) seen.set(key, j);
  }
  return [...seen.values()];
}

async function getSnapshot(force = false): Promise<Snapshot> {
  if (!force && snapshot && Date.now() - snapshot.fetchedAt < TTL_MS) return snapshot;
  inflight ??= fetchAll().finally(() => (inflight = null));
  snapshot = await inflight;
  return snapshot;
}

export async function searchJobs(query: string, opts: { refresh?: boolean; maxTier?: number } = {}): Promise<SearchResponse> {
  const snap = await getSnapshot(opts.refresh);
  const matches = buildMatcher(query);
  const time = (j: Job) => (j.postedAt ? Date.parse(j.postedAt) : 0);

  const jobs = snap.jobs
    .filter((j) => matches(j.title))
    .filter((j) => !opts.maxTier || j.tier <= opts.maxTier)
    // best companies first, then newest first
    .sort((a, b) => a.tier - b.tier || time(b) - time(a) || a.company.localeCompare(b.company));

  // Companies whose source we read successfully (even if they have 0 openings right now)
  const readCompanies = new Set([
    ...snap.jobs.map((j) => j.company),
    ...COMPANIES.filter((c) => c.feed && snap.sources.find((s) => s.source.startsWith(c.name))?.ok).map((c) => c.name),
  ]);
  const q = query.trim() || "software engineer";
  const linkOnly = COMPANIES.filter((c) => c.tier <= 2 && !readCompanies.has(c.name))
    .filter((c) => !opts.maxTier || c.tier <= opts.maxTier)
    .map((c) => ({
      name: c.name,
      tier: c.tier,
      note: c.note,
      careersUrl:
        c.careersUrl ?? `https://www.google.com/search?q=${encodeURIComponent(`${c.name} Sri Lanka careers`)}`,
      linkedinUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
        `${q} ${c.name}`,
      )}&location=Sri%20Lanka`,
    }));

  return {
    query,
    total: jobs.length,
    jobs,
    sources: snap.sources,
    fetchedAt: new Date(snap.fetchedAt).toISOString(),
    linkOnly,
  };
}

import { COMPANIES } from "./companies";
import { buildMatcher, searchPhrase, tokenize } from "./roles";
import { fetchFeed } from "./sources/ats";
import { fetchItpro } from "./sources/itpro";
import { fetchKeells } from "./sources/keells";
import { fetchJobicy, fetchRemotive, searchHimalayas } from "./sources/remote";
import { fetchTopjobs } from "./sources/topjobs";
import type { Job, SearchResponse, SourceResult } from "./types";

// Each site is read at most once per 30 minutes, however many people search.
const TTL_MS = 30 * 60 * 1000;
// Remote-job feeds change slowly and Remotive asks for max ~4 calls a day.
const REMOTE_TTL_MS = 6 * 60 * 60 * 1000;

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
    timed("itpro.lk", fetchItpro),
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

let remoteSnapshot: Snapshot | null = null;
let remoteInflight: Promise<Snapshot> | null = null;

async function getRemoteSnapshot(): Promise<Snapshot> {
  if (remoteSnapshot && Date.now() - remoteSnapshot.fetchedAt < REMOTE_TTL_MS) return remoteSnapshot;
  remoteInflight ??= Promise.all([timed("Remotive (remote)", fetchRemotive), timed("Jobicy (remote)", fetchJobicy)])
    .then((r) => ({ jobs: r.flatMap((x) => x.jobs), sources: r.map((x) => x.result), fetchedAt: Date.now() }))
    .finally(() => (remoteInflight = null));
  remoteSnapshot = await remoteInflight;
  return remoteSnapshot;
}

// Himalayas is searched per phrase; each phrase is cached for REMOTE_TTL_MS.
const himalayasCache = new Map<string, { at: number; jobs: Job[]; result: SourceResult }>();

async function getHimalayas(query: string): Promise<{ jobs: Job[]; result: SourceResult } | null> {
  const phrase = searchPhrase(query);
  if (!phrase) return null; // no blanket download of 100k+ jobs
  const hit = himalayasCache.get(phrase);
  if (hit && Date.now() - hit.at < REMOTE_TTL_MS) return hit;
  const r = await timed("Himalayas (remote, per search)", () => searchHimalayas(phrase));
  if (himalayasCache.size > 200) himalayasCache.clear();
  if (r.result.ok) himalayasCache.set(phrase, { at: Date.now(), ...r });
  return r;
}

export async function searchJobs(
  query: string,
  opts: { refresh?: boolean; maxTier?: number; remote?: boolean } = {},
): Promise<SearchResponse> {
  const includeRemote = opts.remote ?? true;
  const [snap, remote, himalayas] = await Promise.all([
    getSnapshot(opts.refresh),
    includeRemote ? getRemoteSnapshot() : null,
    includeRemote ? getHimalayas(query) : null,
  ]);
  const matches = buildMatcher(query);
  const time = (j: Job) => (j.postedAt ? Date.parse(j.postedAt) : 0);

  const allJobs = dedupe([...snap.jobs, ...(remote?.jobs ?? []), ...(himalayas?.jobs ?? [])]);
  const jobs = allJobs
    .filter((j) => matches(j.title))
    .filter((j) => j.remote || !opts.maxTier || j.tier <= opts.maxTier)
    // local jobs first (best companies first), remote last; newest first within each group
    .sort(
      (a, b) =>
        Number(!!a.remote) - Number(!!b.remote) ||
        a.tier - b.tier ||
        time(b) - time(a) ||
        a.company.localeCompare(b.company),
    );

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
    sources: [...snap.sources, ...(remote?.sources ?? []), ...(himalayas ? [himalayas.result] : [])],
    fetchedAt: new Date(snap.fetchedAt).toISOString(),
    linkOnly,
  };
}

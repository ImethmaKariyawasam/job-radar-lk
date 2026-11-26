"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { statusStore, type Status } from "@/lib/statusStore";
import type { Job, SearchResponse, Tier } from "@/lib/types";

const QUICK_ROLES = ["SSE", "SE", "ASE", "ATL", "Tech Lead", "QA", "DevOps", "Data", "AI", "Intern"];

const TIER_LABEL: Record<Tier, string> = {
  1: "Top companies",
  2: "Strong tech companies",
  3: "Known IT companies",
  4: "Other companies",
};

// Orange / black / white palette
const TIER_BADGE: Record<Tier, string> = {
  1: "bg-orange-600 text-white",
  2: "bg-black text-white",
  3: "border border-black text-black",
  4: "bg-zinc-100 text-zinc-600",
};

function relDays(iso?: string) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function fmtDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;
}

export default function JobSearch({
  initialQuery,
  initialData,
}: {
  initialQuery: string;
  initialData: SearchResponse;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<SearchResponse | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxTier, setMaxTier] = useState<number>(4);
  const [hideApplied, setHideApplied] = useState(false);
  const status = useSyncExternalStore(statusStore.subscribe, statusStore.getSnapshot, statusStore.getServerSnapshot);

  const search = useCallback(async (q: string, refresh = false) => {
    setLoading(true);
    setError(null);
    const url = new URL(window.location.href);
    url.searchParams.set("q", q);
    window.history.replaceState(null, "", url);
    try {
      const res = await fetch(`/api/jobs?q=${encodeURIComponent(q)}${refresh ? "&refresh=1" : ""}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  const visible = useMemo(
    () =>
      (data?.jobs ?? []).filter((j) => j.tier <= maxTier && !(hideApplied && status[j.id] === "applied")),
    [data, maxTier, hideApplied, status],
  );

  const groups = useMemo(() => {
    const g = new Map<Tier, Job[]>();
    for (const j of visible) g.set(j.tier, [...(g.get(j.tier) ?? []), j]);
    return [...g.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  const appliedCount = Object.values(status).filter((s) => s === "applied").length;
  const companyCount = new Set(visible.map((j) => j.company)).size;
  const failed = data?.sources.filter((s) => !s.ok) ?? [];

  return (
    <div className="flex min-h-full flex-col bg-white text-black">
      {/* Header: black band with search */}
      <header className="bg-black text-white">
        <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-10 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-orange-600 text-lg font-bold">J</span>
            <span className="text-2xl font-semibold tracking-tight">
              Job Radar <span className="text-orange-500">LK</span>
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-zinc-300">
            Find IT jobs in Sri Lanka in one search and apply quickly. Live vacancies from top tech companies, best
            first.
          </p>

          <form
            className="mt-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Role — e.g. SSE, Software Engineer, DevOps"
              className="min-w-0 flex-1 rounded-lg border-2 border-transparent bg-white px-4 py-3 text-base text-black outline-none placeholder:text-zinc-400 focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_ROLES.map((r) => {
              const active = query.toLowerCase() === r.toLowerCase();
              return (
                <button
                  key={r}
                  onClick={() => {
                    setQuery(r);
                    search(r);
                  }}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    active
                      ? "border-orange-600 bg-orange-600 text-white"
                      : "border-zinc-700 text-zinc-200 hover:border-orange-500 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 sm:px-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-zinc-200 py-4 text-sm">
          <span className="font-semibold">
            {data ? (
              <>
                <span className="text-orange-600">{visible.length}</span> vacanc{visible.length === 1 ? "y" : "ies"}
                <span className="font-normal text-zinc-500"> at {companyCount} companies</span>
              </>
            ) : (
              "—"
            )}
          </span>
          <label className="flex items-center gap-2">
            Companies
            <select
              value={maxTier}
              onChange={(e) => setMaxTier(Number(e.target.value))}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 focus:border-orange-500 focus:outline-none"
            >
              <option value={4}>All</option>
              <option value={3}>Known IT &amp; above</option>
              <option value={2}>Strong &amp; top</option>
              <option value={1}>Top only</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideApplied}
              onChange={(e) => setHideApplied(e.target.checked)}
              className="accent-orange-600"
            />
            Hide applied ({appliedCount})
          </label>
          <button
            onClick={() => search(query, true)}
            disabled={loading}
            className="ml-auto font-medium text-orange-600 underline-offset-4 hover:underline"
          >
            Refresh live data
          </button>
        </div>

        {error && <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}

        {data && visible.length === 0 && !loading && (
          <p className="mt-10 text-zinc-500">
            No open vacancies match <b className="text-black">{data.query}</b> right now. Try a broader role, or check
            the companies below directly.
          </p>
        )}

        {/* Results */}
        <div className={loading ? "opacity-50 transition-opacity" : ""}>
          {groups.map(([tier, jobs]) => (
            <section key={tier} className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 border-l-4 border-orange-600 pl-3 text-sm font-bold uppercase tracking-wide">
                {TIER_LABEL[tier]} <span className="font-normal normal-case text-zinc-500">· {jobs.length}</span>
              </h2>
              <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200">
                {jobs.map((j) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    status={status[j.id]}
                    onOpen={() => !status[j.id] && statusStore.set(j.id, "opened")}
                    onToggleApplied={() => statusStore.set(j.id, status[j.id] === "applied" ? null : "applied")}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Companies without a live list */}
        {data && data.linkOnly.length > 0 && (
          <section className="mt-12 rounded-xl bg-zinc-50 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide">No live list yet — check these directly</h2>
            <p className="mb-4 mt-1 text-sm text-zinc-600">
              These companies&apos; vacancies are <b>not</b> in the list above. Most of them post only on LinkedIn or
              aren&apos;t listing openings right now. One click opens their careers page or a ready-made LinkedIn search.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.linkOnly.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${TIER_BADGE[c.tier]}`}>
                      T{c.tier}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.name}</span>
                      {c.note && <span className="block truncate text-xs text-zinc-500">{c.note}</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-3">
                    <a href={c.careersUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange-600">
                      Careers ↗
                    </a>
                    <a
                      href={c.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-600 hover:underline"
                    >
                      LinkedIn ↗
                    </a>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Sources */}
      {data && (
        <footer className="bg-black text-xs text-zinc-400">
          <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
            <p>
              Live data read {new Date(data.fetchedAt).toLocaleTimeString()} (each site at most once every 30 min)
              from:{" "}
              {data.sources.map((s, i) => (
                <span key={s.source}>
                  {i > 0 && " · "}
                  <span className={s.ok ? "text-zinc-300" : "text-orange-500"} title={s.error}>
                    {s.source} {s.ok ? `(${s.count})` : "(failed)"}
                  </span>
                </span>
              ))}
            </p>
            {failed.length > 0 && (
              <p className="mt-1 text-orange-500">Some sources failed; hover a source for details.</p>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

function JobRow({
  job,
  status,
  onOpen,
  onToggleApplied,
}: {
  job: Job;
  status?: Status;
  onOpen: () => void;
  onToggleApplied: () => void;
}) {
  const posted = relDays(job.postedAt);
  const closes = fmtDate(job.closesAt);
  return (
    <li
      className={`flex flex-col gap-3 bg-white px-4 py-3 transition hover:bg-orange-50/60 sm:flex-row sm:items-center ${
        status === "applied" ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${TIER_BADGE[job.tier]}`}>T{job.tier}</span>
          <span className="truncate font-semibold">{job.title}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-zinc-500">
          <span className="font-medium text-black">{job.company}</span>
          {job.location && <span>{job.location}</span>}
          {posted && <span>Posted {posted}</span>}
          {closes && <span>Closes {closes}</span>}
          <span className="text-zinc-400">via {job.source}</span>
          {status === "opened" && <span className="font-medium text-orange-600">Visited</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onToggleApplied}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            status === "applied"
              ? "border-black bg-black text-white"
              : "border-zinc-300 text-black hover:border-black"
          }`}
        >
          {status === "applied" ? "✓ Applied" : "Mark applied"}
        </button>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
          className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-500"
        >
          Apply ↗
        </a>
      </div>
    </li>
  );
}

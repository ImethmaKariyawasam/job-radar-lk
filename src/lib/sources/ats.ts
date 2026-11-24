import type { Company, Feed } from "../companies";
import type { Job } from "../types";
import { getJson, postJson, relativeToIso } from "./http";
import { fetchCareersPage } from "./pages";

type WorkdayFeed = Extract<Feed, { kind: "workday" }>;

interface WorkdayPage {
  total: number;
  jobPostings: { title: string; externalPath: string; locationsText?: string; postedOn?: string }[];
}

/** Workday "CXS" API used by every myworkdayjobs.com career site. Max 20 per page. */
export async function fetchWorkday(company: Company, feed: WorkdayFeed): Promise<Job[]> {
  const url = `${feed.host}/wday/cxs/${feed.tenant}/${feed.site}/jobs`;
  const jobs: Job[] = [];
  let total = Infinity;
  for (let offset = 0; offset < total && offset < 400; offset += 20) {
    const page = await postJson<WorkdayPage>(url, {
      appliedFacets: feed.appliedFacets ?? {},
      limit: 20,
      offset,
      searchText: "",
    });
    // Workday only reports `total` reliably on the first page
    if (offset === 0) total = page.total;
    if (!page.jobPostings?.length) break;
    for (const p of page.jobPostings) {
      jobs.push({
        id: `wd:${feed.tenant}:${p.externalPath}`,
        title: p.title,
        company: company.name,
        tier: company.tier,
        location: p.locationsText ?? "Sri Lanka",
        postedAt: relativeToIso(p.postedOn),
        url: feed.jobUrlBase + p.externalPath,
        source: "Workday",
      });
    }
  }
  return jobs;
}

interface SRPage {
  totalFound: number;
  content: {
    id: string;
    name: string;
    releasedDate?: string;
    location?: { fullLocation?: string; city?: string; remote?: boolean };
  }[];
}

export async function fetchSmartRecruiters(
  company: Company,
  feed: Extract<Feed, { kind: "smartrecruiters" }>,
): Promise<Job[]> {
  const jobs: Job[] = [];
  let total = Infinity;
  for (let offset = 0; offset < total && offset < 500; offset += 100) {
    const params = new URLSearchParams({ limit: "100", offset: String(offset) });
    if (feed.country) params.set("country", feed.country);
    const page = await getJson<SRPage>(
      `https://api.smartrecruiters.com/v1/companies/${feed.slug}/postings?${params}`,
    );
    total = page.totalFound;
    for (const p of page.content) {
      jobs.push({
        id: `sr:${feed.slug}:${p.id}`,
        title: p.name,
        company: company.name,
        tier: company.tier,
        location: p.location?.fullLocation ?? p.location?.city ?? "",
        postedAt: p.releasedDate,
        url: `https://jobs.smartrecruiters.com/${feed.slug}/${p.id}`,
        source: "SmartRecruiters",
      });
    }
    if (page.content.length === 0) break;
  }
  return jobs;
}

interface WorkablePage {
  results: {
    shortcode: string;
    title: string;
    published?: string;
    remote?: boolean;
    location?: { city?: string; country?: string };
  }[];
  nextPage?: string;
}

export async function fetchWorkable(company: Company, feed: Extract<Feed, { kind: "workable" }>): Promise<Job[]> {
  const jobs: Job[] = [];
  let token: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page = await postJson<WorkablePage>(`https://apply.workable.com/api/v3/accounts/${feed.slug}/jobs`, {
      query: "",
      location: [],
      department: [],
      worktype: [],
      remote: [],
      ...(token ? { token } : {}),
    });
    for (const p of page.results) {
      jobs.push({
        id: `wk:${feed.slug}:${p.shortcode}`,
        title: p.title,
        company: company.name,
        tier: company.tier,
        location: [p.location?.city, p.location?.country].filter(Boolean).join(", ") || (p.remote ? "Remote" : ""),
        postedAt: p.published,
        url: `https://apply.workable.com/${feed.slug}/j/${p.shortcode}/`,
        source: "Workable",
      });
    }
    token = page.nextPage;
    if (!token) break;
  }
  return jobs;
}

interface ManatalPage {
  next: string | null;
  results: {
    id: number;
    hash: string;
    position_name: string;
    location_display?: string;
    country?: string;
    is_remote?: boolean;
  }[];
}

export async function fetchManatal(company: Company, feed: Extract<Feed, { kind: "manatal" }>): Promise<Job[]> {
  const jobs: Job[] = [];
  let url: string | null = `https://api.manatal.com/open/v3/career-page/${feed.slug}/jobs/?page_size=100`;
  for (let i = 0; url && i < 10; i++) {
    const page: ManatalPage = await getJson<ManatalPage>(url);
    for (const p of page.results) {
      if (feed.country && p.country && p.country !== feed.country && !p.is_remote) continue;
      jobs.push({
        id: `mn:${feed.slug}:${p.id}`,
        title: p.position_name.replace(/\s+/g, " ").trim(),
        company: company.name,
        tier: company.tier,
        location: p.location_display || (p.is_remote ? "Remote" : ""),
        url: `https://www.careers-page.com/${feed.slug}/job/${p.hash}`,
        source: "Manatal",
      });
    }
    url = page.next;
  }
  return jobs;
}

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  country?: string;
  workplaceType?: string;
  categories?: { location?: string; allLocations?: string[] };
}

export async function fetchLever(company: Company, feed: Extract<Feed, { kind: "lever" }>): Promise<Job[]> {
  const postings = await getJson<LeverPosting[]>(`https://api.lever.co/v0/postings/${feed.slug}?mode=json`);
  return postings
    .filter((p) => !feed.country || p.country === feed.country)
    .map((p) => ({
      id: `lv:${feed.slug}:${p.id}`,
      title: p.text,
      company: company.name,
      tier: company.tier,
      location: p.categories?.location ?? "",
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
      url: p.hostedUrl,
      source: "Lever" as const,
    }));
}

const ROOSTER_QUERY = `query Jobs($companyId: ID!, $page: Int, $limit: Int, $filters: JobFilters) {
  fetchAllJobsPublicFiltered(companyId: $companyId, page: $page, limit: $limit, filters: $filters) {
    jobs { id title location }
    pagination { totalPages }
  }
}`;

interface RoosterResponse {
  errors?: { message: string }[];
  data?: {
    fetchAllJobsPublicFiltered: {
      jobs: { id: number | string; title: string; location?: string }[];
      pagination: { totalPages: number };
    };
  };
}

/** rooster.jobs public job-board API — the same call their careers-page widget makes. */
export async function fetchRooster(company: Company, feed: Extract<Feed, { kind: "rooster" }>): Promise<Job[]> {
  const jobs: Job[] = [];
  let pages = 1;
  for (let page = 1; page <= pages && page <= 10; page++) {
    const res = await postJson<RoosterResponse>("https://api.rooster.jobs/integration/graphql", {
      query: ROOSTER_QUERY,
      variables: {
        companyId: feed.companyId,
        page,
        limit: 50,
        filters: feed.subsidiary ? { subsidiary: feed.subsidiary } : {},
      },
    });
    if (res.errors?.length) throw new Error(`rooster: ${res.errors[0].message}`);
    const r = res.data!.fetchAllJobsPublicFiltered;
    pages = r.pagination.totalPages;
    for (const j of r.jobs) {
      jobs.push({
        id: `rs:${j.id}`,
        title: j.title.trim(),
        company: company.name,
        tier: company.tier,
        location: j.location ?? "",
        url: `https://www.rooster.jobs/jobs/${j.id}`,
        source: "Rooster",
      });
    }
  }
  return jobs;
}

export function fetchFeed(company: Company): Promise<Job[]> {
  const feed = company.feed!;
  switch (feed.kind) {
    case "workday":
      return fetchWorkday(company, feed);
    case "smartrecruiters":
      return fetchSmartRecruiters(company, feed);
    case "workable":
      return fetchWorkable(company, feed);
    case "manatal":
      return fetchManatal(company, feed);
    case "lever":
      return fetchLever(company, feed);
    case "rooster":
      return fetchRooster(company, feed);
    case "page":
      return fetchCareersPage(company, feed);
  }
}

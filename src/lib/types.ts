export type Tier = 1 | 2 | 3 | 4;

export interface Job {
  id: string;
  title: string;
  company: string;
  tier: Tier;
  location: string;
  /** ISO date string, when known */
  postedAt?: string;
  /** ISO date string, when known (topjobs gives closing dates) */
  closesAt?: string;
  /** Where the user goes to read and apply */
  url: string;
  source: SourceName;
  /** Remote job open to Sri Lanka–based candidates (shown in its own section) */
  remote?: boolean;
}

export type SourceName =
  | "Workday"
  | "SmartRecruiters"
  | "Workable"
  | "Manatal"
  | "Lever"
  | "Rooster"
  | "Careers page"
  | "John Keells careers"
  | "topjobs.lk"
  | "itpro.lk"
  | "Remotive"
  | "Jobicy"
  | "Himalayas";

export interface SourceResult {
  source: string;
  ok: boolean;
  count: number;
  error?: string;
  ms: number;
}

export interface SearchResponse {
  query: string;
  total: number;
  jobs: Job[];
  sources: SourceResult[];
  fetchedAt: string;
  /** Top companies we cannot fetch live; shown as "check directly" cards */
  linkOnly: { name: string; tier: Tier; note?: string; careersUrl: string; linkedinUrl: string }[];
}

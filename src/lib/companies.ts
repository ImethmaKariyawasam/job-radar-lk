import type { Tier } from "./types";

/**
 * Company registry.
 *
 * tier 1 = top product / engineering companies
 * tier 2 = strong, well-known tech companies
 * tier 3 = known IT companies
 * tier 4 = everyone else (default for unknown topjobs.lk employers)
 *
 * `aliases` are matched (case-insensitive, substring) against employer names
 * coming from topjobs.lk so their jobs get the right tier.
 *
 * `feed` = how we fetch this company's jobs live. Companies without a feed are
 * shown as "check directly" cards with a careers link + LinkedIn search.
 * Tiers are a personal ranking — edit them freely.
 */

export type Feed =
  | {
      kind: "workday";
      /** e.g. https://lseg.wd3.myworkdayjobs.com */
      host: string;
      tenant: string;
      site: string;
      /** Prefix that the job's externalPath is appended to, to build the apply URL */
      jobUrlBase: string;
      appliedFacets?: Record<string, string[]>;
    }
  | { kind: "smartrecruiters"; slug: string; country?: string }
  | { kind: "workable"; slug: string }
  | { kind: "manatal"; slug: string; country?: string }
  | { kind: "lever"; slug: string; country?: string }
  /** rooster.jobs public job-board API (same one their careers widget calls) */
  | { kind: "rooster"; companyId: string; subsidiary?: number }
  /** A company careers page whose HTML already contains the job list */
  | { kind: "page"; parser: "99x" | "gapstars" | "pickme" | "octave" };

export interface Company {
  name: string;
  tier: Tier;
  aliases?: string[];
  careersUrl?: string;
  feed?: Feed;
  /** Why we can't show a live list (shown in the "check directly" box) */
  note?: string;
}

export const COMPANIES: Company[] = [
  // ---------------- Tier 1 ----------------
  {
    name: "WSO2", note: "Site blocks automated readers",
    tier: 1,
    aliases: ["wso2"],
    careersUrl: "https://wso2.com/careers/",
  },
  {
    name: "Sysco LABS",
    tier: 1,
    aliases: ["sysco labs", "sysco"],
    careersUrl: "https://syscolabs.lk/careers",
    feed: {
      kind: "workday",
      host: "https://wd5.myworkdaysite.com",
      tenant: "sysco",
      site: "syscocareers",
      jobUrlBase: "https://wd5.myworkdaysite.com/recruiting/sysco/syscocareers",
      appliedFacets: { locations: ["b014cc62fe6601b8d666502cd5287f36"] }, // Sysco LABS - Sri Lanka
    },
  },
  {
    name: "LSEG (MillenniumIT)",
    tier: 1,
    aliases: ["lseg", "millenniumit", "london stock exchange"],
    careersUrl: "https://www.lseg.com/en/careers",
    feed: {
      kind: "workday",
      host: "https://lseg.wd3.myworkdayjobs.com",
      tenant: "lseg",
      site: "Careers",
      jobUrlBase: "https://lseg.wd3.myworkdayjobs.com/en-US/Careers",
      appliedFacets: { locationCountry: ["db69e062446c11de98360015c5e6daf6"] }, // Sri Lanka
    },
  },
  {
    name: "IFS",
    tier: 1,
    aliases: ["ifs r&d", "ifs sri lanka", "industrial and financial systems"],
    careersUrl: "https://www.ifs.com/careers",
    feed: { kind: "smartrecruiters", slug: "IFS1", country: "lk" },
  },
  {
    name: "99x",
    tier: 1,
    aliases: ["99x"],
    careersUrl: "https://99x.io/careers/open-positions?location=sri-lanka",
    feed: { kind: "page", parser: "99x" },
  },
  { name: "CodeGen", note: "No openings listed on site", tier: 1, aliases: ["codegen"], careersUrl: "https://codegen.co.uk/en/company/careers" },
  {
    name: "Calcey",
    tier: 1,
    aliases: ["calcey"],
    careersUrl: "https://calcey.com/careers/",
    feed: { kind: "rooster", companyId: "3", subsidiary: 132 }, // Calcey is a Surge Global group company
  },
  { name: "Pearson Lanka", note: "Global portal, no Sri Lanka filter", tier: 1, aliases: ["pearson"], careersUrl: "https://pearson.jobs/" },

  // ---------------- Tier 2 ----------------
  {
    name: "Creately",
    tier: 2,
    aliases: ["creately", "cinergix"],
    careersUrl: "https://www.careers-page.com/creately",
    feed: { kind: "manatal", slug: "creately" },
  },
  { name: "Virtusa", note: "Site blocks automated readers", tier: 2, aliases: ["virtusa"], careersUrl: "https://www.virtusa.com/careers" },
  { name: "Zone24x7", note: "Site shows 0 openings now", tier: 2, aliases: ["zone24x7", "zone 24x7"], careersUrl: "https://zone24x7.com/careers/" },
  {
    name: "Rootcode",
    tier: 2,
    aliases: ["rootcode"],
    careersUrl: "https://rootcode.ai/careers",
    feed: { kind: "manatal", slug: "rootcode", country: "Sri Lanka" }, // same data rootcode.ai/careers shows
  },
  { name: "Fortude", note: "Careers site not responding", tier: 2, aliases: ["fortude"], careersUrl: "https://careers.fortude.co/" },
  {
    name: "Surge Global",
    tier: 2,
    aliases: ["surge global"],
    careersUrl: "https://www.rooster.jobs/surge",
    feed: { kind: "rooster", companyId: "3" },
  },
  {
    name: "Axiata Digital Labs",
    tier: 2,
    aliases: ["axiata digital", "adl"],
    careersUrl: "https://www.axiatadigitallabs.com/adl-careers/",
    feed: { kind: "manatal", slug: "axonect", country: "Sri Lanka" },
  },
  { name: "John Keells IT", tier: 2, aliases: ["john keells it", "jkit", "john keells information technology"], careersUrl: "https://careers.keells.com/JohnKeellsIT/" },
  {
    name: "Octave (John Keells)",
    tier: 2,
    aliases: ["octave"],
    careersUrl: "https://www.octave.lk/our-careers/",
    feed: { kind: "page", parser: "octave" },
  },
  { name: "DirectFN", tier: 2, aliases: ["directfn"] },
  { name: "Mitra Innovation", note: "Posts on LinkedIn only", tier: 2, aliases: ["mitra innovation", "mitrai"], careersUrl: "https://mitrai.com/careers" },
  {
    name: "Gapstars",
    tier: 2,
    aliases: ["gapstars"],
    careersUrl: "https://www.gapstars.net/careers",
    feed: { kind: "page", parser: "gapstars" },
  },
  { name: "hSenid", note: "Posts on LinkedIn only", tier: 2, aliases: ["hsenid"], careersUrl: "https://hsenid.com/careers" },
  { name: "Yaala Labs", note: "Posts on LinkedIn only", tier: 2, aliases: ["yaala"], careersUrl: "https://yaalalabs.com/careers" },
  {
    name: "Vetstoria (PetDesk)",
    tier: 2,
    aliases: ["vetstoria", "petdesk"],
    careersUrl: "https://petdesk.com/careers",
    feed: { kind: "lever", slug: "petdesk", country: "LK" },
  },
  { name: "Cambio Software Engineering", note: "No openings listed on site", tier: 2, aliases: ["cambio"] },
  { name: "VitalHub", tier: 2, aliases: ["vitalhub"] },
  { name: "Arimac", note: "No openings listed on site", tier: 2, aliases: ["arimac"], careersUrl: "https://arimac.digital/careers/" },
  {
    name: "PickMe",
    tier: 2,
    aliases: ["pickme", "digital mobility solutions"],
    careersUrl: "https://pickme.lk/careers/",
    feed: { kind: "page", parser: "pickme" },
  },
  { name: "Dialog Axiata", note: "No openings listed on site", tier: 2, aliases: ["dialog axiata"] },

  // ---------------- Tier 3 ----------------
  {
    name: "Inivos",
    tier: 3,
    aliases: ["inivos"],
    careersUrl: "https://apply.workable.com/inivos/",
    feed: { kind: "workable", slug: "inivos" },
  },
  { name: "Eyepax", tier: 3, aliases: ["eyepax"], careersUrl: "https://eyepax.com/job-openings/" },
  { name: "Acentura", tier: 3, aliases: ["acentura"] },
  { name: "eBEYONDS", tier: 3, aliases: ["ebeyonds"] },
  { name: "Epic Lanka", tier: 3, aliases: ["epic lanka"] },
  { name: "BOC IT Solutions", tier: 3, aliases: ["boc it solutions"] },
  { name: "Blue Lotus 360", tier: 3, aliases: ["blue lotus"] },
  { name: "CMS (Pvt) Ltd", tier: 3, aliases: ["cms (pvt)"] },
  { name: "Metropolitan Technologies", tier: 3, aliases: ["metropolitan technologies"] },
  { name: "Bistec Global", tier: 3, aliases: ["bistec"], careersUrl: "https://bistecglobal.com/careers/" },
  { name: "Tiqri", tier: 3, aliases: ["tiqri"], careersUrl: "https://tiqri.com/careers" },
  { name: "Orel IT", tier: 3, aliases: ["orel it", "orelit"], careersUrl: "https://orelit.com/careers" },
  { name: "Deloitte", tier: 3, aliases: ["deloitte"] },
  { name: "Ernst & Young", tier: 3, aliases: ["ernst & young", "ey gds"] },
];

const normalized = COMPANIES.flatMap((c) =>
  [c.name, ...(c.aliases ?? [])].map((a) => ({ alias: a.toLowerCase(), company: c })),
).sort((a, b) => b.alias.length - a.alias.length); // longest alias wins

/** Find a registry company for an employer name (e.g. from topjobs.lk). */
export function lookupCompany(employer: string): Company | undefined {
  const e = employer.toLowerCase();
  return normalized.find(({ alias }) =>
    alias.length <= 4
      ? new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(e)
      : e.includes(alias),
  )?.company;
}

/**
 * Role matching.
 *
 * A query like "SSE" is expanded into several token sets. A job title matches
 * if ALL tokens of ANY set appear in the title (order doesn't matter), so
 * "Senior Engineer, Software" and "Software Engineer / Senior Software Engineer"
 * both match "SSE".
 */

const TOKEN_SYNONYMS: Record<string, string> = {
  sr: "senior",
  snr: "senior",
  jr: "junior",
  jnr: "junior",
  assoc: "associate",
  eng: "engineer",
  engr: "engineer",
  dev: "developer",
  mgr: "manager",
  fullstack: "fullstack",
  "full-stack": "fullstack",
  frontend: "frontend",
  "front-end": "frontend",
  backend: "backend",
  "back-end": "backend",
  technical: "tech",
  qa: "qa",
};

/** Abbreviation -> list of phrases that count as that role. */
export const ROLE_ALIASES: Record<string, string[]> = {
  sse: [
    "senior software engineer",
    "senior software developer",
    "senior fullstack engineer",
    "senior fullstack developer",
    "senior backend engineer",
    "senior frontend engineer",
    ...["java", ".net", "c++", "c#", "python", "go", "golang", "node", "react", "angular", "javascript", "typescript", "php", "mobile", "ios", "android", "flutter", "web"].flatMap(
      (lang) => [`senior ${lang} engineer`, `senior ${lang} developer`],
    ),
    "sse",
  ],
  se: ["software engineer", "software developer", "fullstack engineer", "fullstack developer"],
  ase: ["associate software engineer", "junior software engineer", "trainee software engineer", "ase"],
  atl: ["associate tech lead", "atl"],
  tl: ["tech lead", "team lead engineering", "tl"],
  "tech lead": ["tech lead"],
  qa: ["qa engineer", "quality engineer", "quality assurance", "test engineer", "sqa", "qa"],
  sqa: ["qa engineer", "quality engineer", "quality assurance", "sqa"],
  qae: ["qa automation", "automation engineer", "quality engineer"],
  devops: ["devops", "site reliability", "platform engineer", "cloud engineer", "sre"],
  sre: ["site reliability", "sre"],
  ba: ["business analyst", "business systems analyst", "ba"],
  pm: ["project manager", "product manager", "pm"],
  intern: ["intern", "internship", "trainee"],
  ml: ["machine learning", "ml engineer", "ai engineer", "data scientist"],
  ai: ["ai engineer", "machine learning", "ml engineer", "llm", "ai"],
  data: ["data engineer", "data scientist", "data analyst", "analytics engineer"],
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\bfull[\s-]?stack\b/g, "fullstack")
    .replace(/\bfront[\s-]?end\b/g, "frontend")
    .replace(/\bback[\s-]?end\b/g, "backend")
    .replace(/[^a-z0-9.+#]+/g, " ")
    .split(" ")
    .map((t) => t.replace(/^\.+|\.+$/g, "")) // "sr." -> "sr", keep ".net"
    .map((t) => (t === "net" ? ".net" : t))
    .filter(Boolean)
    .map((t) => TOKEN_SYNONYMS[t] ?? t);
}

/**
 * Words that rule a title OUT of a level. Searching "SE" should not list Senior/Lead roles,
 * and "SSE" should not list Lead/Principal/Manager roles.
 */
const LEVEL_EXCLUDES: Record<string, string[]> = {
  se: ["senior", "lead", "principal", "associate", "junior", "intern", "internship", "trainee", "manager", "architect", "head", "director", "staff"],
  sse: ["lead", "principal", "manager", "architect", "head", "director", "staff", "intern"],
  ase: ["senior", "lead", "principal", "manager", "architect", "intern", "internship"],
  atl: ["senior"],
  intern: ["senior", "lead", "manager"],
};

/** Full phrases people type that mean the same as an abbreviation. */
const PHRASE_TO_ALIAS: Record<string, string> = {
  "software engineer": "se",
  "software developer": "se",
  "senior software engineer": "sse",
  "senior software developer": "sse",
  "associate software engineer": "ase",
  "associate tech lead": "atl",
  "associate technical lead": "atl",
};

/**
 * Build a title matcher. Empty query => match everything.
 * Combined titles like "Software Engineer / Senior Software Engineer" are checked part by part,
 * so that job shows up for both SE and SSE.
 */
export function buildMatcher(query: string): (title: string) => boolean {
  const raw = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!raw) return () => true;

  const q = PHRASE_TO_ALIAS[raw] ?? raw;
  const phrases = ROLE_ALIASES[q] ?? [q];
  const sets = phrases.map((p) => tokenize(p)).filter((s) => s.length > 0);
  const excludes = LEVEL_EXCLUDES[q];

  const partMatches = (text: string) => {
    const tokens = new Set(tokenize(text));
    if (excludes?.some((x) => tokens.has(x))) return false;
    return sets.some((set) => set.every((t) => tokens.has(t)));
  };

  return (title: string) => {
    if (!excludes) return partMatches(title);
    // "Technical Lead/ Senior Software Engineer - C++" -> ["Technical Lead", " Senior Software Engineer - C++"]
    return title.split(/[\/|]/).some(partMatches);
  };
}

/** Plain phrase to send to search-based sources (e.g. "SSE" -> "senior software engineer"). */
export function searchPhrase(query: string): string {
  const raw = query.trim().toLowerCase().replace(/\s+/g, " ");
  const q = PHRASE_TO_ALIAS[raw] ?? raw;
  return ROLE_ALIASES[q]?.[0] ?? raw;
}

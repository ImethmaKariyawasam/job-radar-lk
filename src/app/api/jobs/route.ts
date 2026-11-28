import { searchJobs } from "@/lib/aggregate";

// GET /api/jobs?q=SSE&maxTier=2&remote=0&refresh=1
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").slice(0, 100);
  const maxTier = Number(searchParams.get("maxTier")) || undefined;
  const refresh = searchParams.get("refresh") === "1";
  const remote = searchParams.get("remote") !== "0";

  const data = await searchJobs(q, { refresh, maxTier, remote });
  return Response.json(data);
}

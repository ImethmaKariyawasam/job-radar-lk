import { Suspense } from "react";
import { connection } from "next/server";
import { searchJobs } from "@/lib/aggregate";
import JobSearch from "./JobSearch";

// The page shell is static; live results are fetched per request inside Suspense.
export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <Suspense
      fallback={
        <div className="bg-black px-4 py-10 text-white sm:px-6">
          <div className="mx-auto max-w-5xl">
            <span className="text-2xl font-semibold tracking-tight">
              Job Radar <span className="text-orange-500">LK</span>
            </span>
            <p className="mt-6 text-zinc-300">Fetching live vacancies from all sources…</p>
          </div>
        </div>
      }
    >
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await connection(); // live job data: always render at request time, never prerender
  const { q } = await searchParams;
  const initialQuery = ((Array.isArray(q) ? q[0] : q) ?? "SSE").slice(0, 100);
  const initialData = await searchJobs(initialQuery);
  return <JobSearch initialQuery={initialQuery} initialData={initialData} />;
}

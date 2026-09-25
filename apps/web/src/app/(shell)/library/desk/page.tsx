import Link from "next/link";
import { Badge } from "@matos/ui";
import { getSessionFlags } from "@/lib/owner";
import { deskOwner, listFiledDeskJobs } from "@/lib/desk";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await getSessionFlags();
  const jobs = await listFiledDeskJobs(deskOwner(flags.email));
  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">
          Library · Desk
        </h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Filed Desk jobs (finished Echo). Separate from the encoding guide.
        </p>
      </div>
      <div className="grid gap-3 p-[22px] sm:grid-cols-2">
        {jobs.length === 0 ? (
          <p className="text-sm text-matos-muted">
            No filed jobs yet. Complete Scout → Echo and approve Echo to file.
          </p>
        ) : (
          jobs.map((job) => (
            <Link
              key={job.id}
              href={`/desk/${job.id}`}
              className="rounded-xl border border-matos-border bg-matos-panel p-4 transition-colors hover:border-matos-citron"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  {job.title}
                </h2>
                <Badge tone="citron">filed</Badge>
              </div>
              <p className="mt-2 text-xs text-matos-muted">{job.topic}</p>
              <p className="mt-2 text-[11px] text-matos-muted2">
                {job.channels.join(" · ")}
                {job.filedAt
                  ? ` · ${new Date(job.filedAt).toLocaleDateString()}`
                  : ""}
              </p>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}

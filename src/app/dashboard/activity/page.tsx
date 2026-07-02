import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActivityFeed } from "@/components/agents/activity-feed";
import { CrtFrame } from "@/components/ui/pixel-loader";
import { ArrowLeft, Activity } from "lucide-react";

export default async function GlobalActivityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const events = await db.activityEvent.findMany({
    where: { business: { userId: session.id } },
    include: {
      business: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const metrics = await db.activityEvent.groupBy({
    by: ["level"],
    where: { business: { userId: session.id } },
    _count: true,
  });

  const eventCount = events.length;
  const errorCount = metrics.find((m) => m.level === "error")?._count ?? 0;
  const warnCount = metrics.find((m) => m.level === "warn")?._count ?? 0;

  return (
    <div className="p-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="mt-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Activity className="h-6 w-6 text-[var(--accent-primary)]" />
          Activity
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Real-time event stream across all your businesses
        </p>
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <CrtFrame className="p-4 text-center">
          <p className="font-mono text-2xl font-bold text-[var(--accent-primary)]">{eventCount}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-[var(--text-muted)]">Total events</p>
        </CrtFrame>
        <CrtFrame className="p-4 text-center">
          <p className="font-mono text-2xl font-bold text-[var(--warning)]">{warnCount}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-[var(--text-muted)]">Warnings</p>
        </CrtFrame>
        <CrtFrame className="p-4 text-center">
          <p className="font-mono text-2xl font-bold text-[var(--error)]">{errorCount}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-[var(--text-muted)]">Errors</p>
        </CrtFrame>
      </div>

      <div className="mt-8">
        <ActivityFeed
          events={events.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            agent: e.agent,
            level: e.level,
            message: e.message,
            createdAt: e.createdAt.toISOString(),
            businessName: e.business?.name ?? undefined,
          }))}
          showBusiness
        />
      </div>
    </div>
  );
}

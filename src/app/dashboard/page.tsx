import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import { Plus, ExternalLink } from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const businesses = await db.business.findMany({
    where: { userId: session.id },
    include: {
      site: { select: { status: true } },
      _count: { select: { inventory: true } },
      agentRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, currentStep: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const apiKeys = await db.apiKey.count({
    where: { userId: session.id, isValid: true },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="mt-1 text-[var(--text-secondary)]">
            Welcome back{session.name ? `, ${session.name}` : ""}
          </p>
        </div>
        <Link href="/onboarding">
          <Button>
            <Plus className="h-4 w-4" />
            New business
          </Button>
        </Link>
      </div>

      {apiKeys === 0 && (
        <div className="mt-6 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/5 p-4">
          <p className="text-sm">
            <strong className="text-[var(--warning)]">Demo mode active.</strong>{" "}
            Connect an OpenAI or Anthropic API key for full LLM-powered agents.{" "}
            <Link href="/dashboard/settings/keys" className="text-[var(--accent-primary)] underline">
              Add keys →
            </Link>
          </p>
        </div>
      )}

      {businesses.length === 0 ? (
        <Card className="mt-8 text-center py-16">
          <p className="text-[var(--text-secondary)]">No businesses yet</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Connect your store or SaaS details to let agents weave your web presence.
          </p>
          <Link href="/onboarding" className="mt-6 inline-block">
            <Button>Weave your first business</Button>
          </Link>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => {
            const lastRun = b.agentRuns[0];
            const statusColors: Record<string, string> = {
              live: "text-[var(--success)]",
              review: "text-[var(--warning)]",
              draft: "text-[var(--text-muted)]",
              failed: "text-[var(--error)]",
            };
            return (
              <Link key={b.id} href={`/dashboard/${b.id}`}>
                <Card className="h-full transition hover:border-[var(--accent-primary)]/30">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle>{b.name}</CardTitle>
                      <span
                        className={`text-xs font-medium uppercase ${statusColors[b.status] ?? ""}`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] capitalize">
                      {b.type.replace(/-/g, " ")}
                    </p>
                  </CardHeader>
                  <div className="text-sm text-[var(--text-secondary)]">
                    <p>{b._count.inventory} inventory items</p>
                    {lastRun && (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Last run {formatRelativeTime(lastRun.createdAt)} — {lastRun.status}
                      </p>
                    )}
                  </div>
                  <p className="mt-4 flex items-center gap-1 text-xs text-[var(--accent-primary)]">
                    View details <ExternalLink className="h-3 w-3" />
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

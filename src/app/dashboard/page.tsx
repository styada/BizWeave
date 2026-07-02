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
          <h1 className="text-2xl font-semibold text-text-primary">Overview</h1>
          <p className="mt-1 text-text-secondary">
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
        <div className="mt-6 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm text-text-secondary">
            <strong className="text-warning">Demo mode active.</strong>{" "}
            Connect an OpenAI or Anthropic API key for full LLM-powered agents.{" "}
            <Link href="/dashboard/settings/keys" className="text-accent-primary underline hover:text-accent-glow">
              Add keys →
            </Link>
          </p>
        </div>
      )}

      {businesses.length === 0 ? (
        <Card className="mt-8 border-dashed py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-primary/10">
              <Plus className="h-8 w-8 text-accent-primary" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">No businesses yet</h3>
            <p className="mt-2 max-w-md text-sm text-text-secondary">
              Connect your store or SaaS details to let agents weave your web presence.
            </p>
            <Link href="/onboarding" className="mt-6 inline-block">
              <Button size="lg">Weave your first business</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => {
            const lastRun = b.agentRuns[0];
            const statusColors: Record<string, string> = {
              live: "bg-success/10 text-success border-success/20",
              review: "bg-warning/10 text-warning border-warning/20",
              draft: "bg-text-muted/10 text-text-muted border-text-muted/20",
              failed: "bg-error/10 text-error border-error/20",
            };
            return (
              <Link key={b.id} href={`/dashboard/${b.id}`}>
                <Card className="group h-full transition-all duration-200 hover:border-accent-primary/40 hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="line-clamp-1 text-base">{b.name}</CardTitle>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusColors[b.status] ?? ""}`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <p className="text-sm capitalize text-text-secondary">
                      {b.type.replace(/-/g, " ")}
                    </p>
                  </CardHeader>
                  <div className="px-6 pb-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Inventory</span>
                        <span className="font-medium text-text-primary">{b._count.inventory} items</span>
                      </div>
                      {lastRun && (
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">Last run</span>
                          <span className="text-xs text-text-secondary">
                            {formatRelativeTime(lastRun.createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-white/10 px-6 py-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-accent-primary transition-colors group-hover:text-accent-glow">
                      View details <ExternalLink className="h-3.5 w-3.5" />
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

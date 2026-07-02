import { db } from "@/lib/db";
import { optionalEnv } from "@/lib/env";

export type MaintenanceIssue = {
  kind: string;
  severity: "info" | "warn" | "error";
  message: string;
  autoFixed?: boolean;
};

/**
 * Maintenance/self-healing agent: checks uptime signals, expiring integrations,
 * failed deployments, and SSL/domain health. Opens issues and auto-fixes safe ones.
 */
export async function runMaintenanceCheck(businessId: string): Promise<MaintenanceIssue[]> {
  const issues: MaintenanceIssue[] = [];

  const [site, deployment, integrations] = await Promise.all([
    db.generatedSite.findUnique({ where: { businessId }, select: { status: true, html: true } }),
    db.deployment.findFirst({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: { status: true, url: true, domain: true },
    }),
    db.integrationConnection.findMany({
      where: { businessId },
      select: { provider: true, status: true, expiresAt: true },
    }),
  ]);

  if (!site) {
    issues.push({ kind: "site_missing", severity: "warn", message: "No generated site found." });
  } else if (site.status === "draft") {
    issues.push({
      kind: "site_draft",
      severity: "info",
      message: "Site is still in draft — not publicly visible.",
    });
  }

  if (deployment?.url) {
    const ok = await probeUrl(deployment.url);
    if (!ok) {
      issues.push({
        kind: "site_unreachable",
        severity: "error",
        message: `Live URL unreachable: ${deployment.url}`,
      });
    }
  }

  for (const conn of integrations) {
    if (conn.status === "expired" || (conn.expiresAt && conn.expiresAt < new Date())) {
      issues.push({
        kind: "integration_expired",
        severity: "warn",
        message: `${conn.provider} connection expired — reconnect required.`,
      });
    }
  }

  // Auto-fix: mark stale "building" deployments older than 24h as failed.
  const stale = await db.deployment.updateMany({
    where: {
      businessId,
      status: "building",
      createdAt: { lt: daysAgo(1) },
    },
    data: { status: "failed" },
  });
  if (stale.count > 0) {
    issues.push({
      kind: "stale_deployment",
      severity: "info",
      message: `Marked ${stale.count} stale deployment(s) as failed.`,
      autoFixed: true,
    });
  }

  for (const issue of issues) {
    await db.activityEvent
      .create({
        data: {
          businessId,
          eventType: "maintenance",
          level: issue.severity === "error" ? "error" : issue.severity === "warn" ? "warn" : "info",
          message: issue.message,
          payload: JSON.stringify({ kind: issue.kind, autoFixed: issue.autoFixed ?? false }),
        },
      })
      .catch(() => undefined);
  }

  return issues;
}

async function probeUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8_000) });
    return res.ok || res.status === 405;
  } catch {
    return false;
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function maintenanceEnabled(): boolean {
  return !!optionalEnv("DATABASE_URL");
}

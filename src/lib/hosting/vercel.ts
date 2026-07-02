import { optionalEnv, hasVercelToken } from "@/lib/env";

/** Attach a custom domain to the Vercel project and return verification info. */
export async function attachVercelDomain(domain: string): Promise<{
  ok: boolean;
  verified?: boolean;
  verification?: { type: string; domain: string; value: string }[];
  error?: string;
}> {
  const token = optionalEnv("VERCEL_TOKEN");
  const projectId = optionalEnv("VERCEL_PROJECT_ID");
  const teamId = optionalEnv("VERCEL_TEAM_ID");
  if (!token || !projectId) {
    return {
      ok: true,
      verified: false,
      verification: [{ type: "CNAME", domain, value: "cname.vercel-dns.com" }],
    };
  }
  try {
    const url = new URL(`https://api.vercel.com/v10/projects/${projectId}/domains`);
    if (teamId) url.searchParams.set("teamId", teamId);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: domain }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as {
      verified?: boolean;
      verification?: { type: string; domain: string; value: string }[];
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: data.error?.message ?? `Vercel ${res.status}` };
    return { ok: true, verified: data.verified, verification: data.verification };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Verify a previously-added custom domain. */
export async function verifyVercelDomain(domain: string): Promise<{ ok: boolean; verified: boolean }> {
  const token = optionalEnv("VERCEL_TOKEN");
  const projectId = optionalEnv("VERCEL_PROJECT_ID");
  const teamId = optionalEnv("VERCEL_TEAM_ID");
  if (!token || !projectId) return { ok: true, verified: false };
  try {
    const url = new URL(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}/verify`
    );
    if (teamId) url.searchParams.set("teamId", teamId);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as { verified?: boolean };
    return { ok: res.ok, verified: !!data.verified };
  } catch {
    return { ok: false, verified: false };
  }
}

export function vercelConfigured(): boolean {
  return hasVercelToken() && !!optionalEnv("VERCEL_PROJECT_ID");
}

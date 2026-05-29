import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-[var(--text-secondary)]">Manage your account and integrations</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Email</dt>
              <dd>{session.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Name</dt>
              <dd>{session.name ?? "—"}</dd>
            </div>
          </dl>
        </CardHeader>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>LLM API Keys (BYOK)</CardTitle>
          <p className="text-sm text-[var(--text-secondary)]">
            Connect OpenAI or Anthropic keys. Encrypted at rest with AES-256-GCM.
          </p>
          <Link
            href="/dashboard/settings/keys"
            className="mt-4 inline-block text-sm text-[var(--accent-primary)] hover:underline"
          >
            Manage API keys →
          </Link>
        </CardHeader>
      </Card>
    </div>
  );
}

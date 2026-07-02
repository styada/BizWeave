export const metadata = { title: "Terms of Service — Bizweave" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>By using Bizweave, you authorize our AI operator to act on your behalf within the approval and spend limits you configure.</p>
      <p>You retain ownership of your business data. Bizweave provides the service &quot;as is&quot; with limitations of liability as described in our master agreement.</p>
      <p>Autonomous actions that spend money, send communications, or publish content require your explicit approval unless you disable approval gates for specific action types.</p>
    </LegalShell>
  );
}

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#f4f4f8]">
      <article className="prose prose-invert mx-auto max-w-2xl px-6 py-16">
        <h1>{title}</h1>
        {children}
        <p className="text-sm text-[#9a9ab0]">Last updated: {new Date().toISOString().slice(0, 10)}</p>
      </article>
    </main>
  );
}

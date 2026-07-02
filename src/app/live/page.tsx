import { getLiveFeed } from "@/lib/live/feed";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const events = await getLiveFeed(40);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#f4f4f8]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-bold tracking-tight">Bizweave Live</h1>
        <p className="mt-2 text-[#9a9ab0]">
          Real-time agent activity across local businesses — while they sleep.
        </p>
        <ul className="mt-10 space-y-3">
          {events.length === 0 ? (
            <li className="text-[#9a9ab0]">No public activity yet. Check back soon.</li>
          ) : (
            events.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-white/10 bg-[#14141c] px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[#9a9ab0]">
                  <span>{e.businessName}</span>
                  <time dateTime={e.occurredAt}>
                    {new Date(e.occurredAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1">{e.message}</p>
              </li>
            ))
          )}
        </ul>
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { SitePreview } from "@/components/site/site-preview";
import { ArrowLeft } from "lucide-react";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const business = await db.business.findFirst({
    where: { id, userId: session.id },
    include: { site: true },
  });

  if (!business?.site) notFound();

  return (
    <div className="p-8">
      <Link
        href={`/dashboard/${id}`}
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {business.name}
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Site preview — {business.name}</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Status: {business.site.status}
      </p>
      <div className="mt-8">
        <SitePreview html={business.site.html} css={business.site.css} />
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type PendingApproval = {
  id: string;
  actionType: string;
  riskLevel: string;
  createdAt: string;
};

export function PendingApprovals({
  businessId,
  actions,
}: {
  businessId: string;
  actions: PendingApproval[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const decide = (actionId: string, decision: "approve" | "reject") => {
    startTransition(async () => {
      setMessage("");
      const res = await fetch(`/api/businesses/${businessId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, decision }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessage(data.error ?? "Failed to submit decision");
        return;
      }
      setMessage(
        decision === "approve"
          ? "Action approved. Publishing resumed."
          : "Action rejected. Business set to review."
      );
      router.refresh();
    });
  };

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4">
      <p className="text-sm font-semibold text-amber-300">Manual approvals required</p>
      {actions.map((action) => (
        <div
          key={action.id}
          className="rounded-xl border border-white/10 bg-black/20 p-3"
        >
          <p className="text-sm font-medium">{action.actionType.replace(/_/g, " ")}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Risk: {action.riskLevel} · Requested {new Date(action.createdAt).toLocaleString()}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => decide(action.id, "approve")}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => decide(action.id, "reject")}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
      {message && <p className="text-xs text-[var(--text-secondary)]">{message}</p>}
    </div>
  );
}

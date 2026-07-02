"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export function RunAgentsButton({
  businessId,
  disabled,
}: {
  businessId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/businesses/${businessId}/run`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to run agents");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <div>
      <Button onClick={run} loading={loading} disabled={disabled}>
        <Play className="h-4 w-4" />
        {loading ? "Running agents…" : "Run agents"}
      </Button>
      {error && <p className="mt-2 text-xs text-[var(--error)]">{error}</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type ScheduledTask = {
  id: string;
  agent: string;
  cadence: string;
  enabled: boolean;
  nextRunAt: string | null;
};

export function ScheduleControls({
  businessId,
  tasks,
}: {
  businessId: string;
  tasks: ScheduledTask[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const updateTask = (taskId: string, enabled: boolean) => {
    startTransition(async () => {
      setMessage("");
      const res = await fetch(`/api/businesses/${businessId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, enabled }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessage(data.error ?? "Failed to update schedule");
        return;
      }

      setMessage("Schedule updated");
      router.refresh();
    });
  };

  const tickNow = () => {
    startTransition(async () => {
      setMessage("");
      const res = await fetch(`/api/businesses/${businessId}/schedule/tick`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessage(data.error ?? "Failed to run scheduler tick");
        return;
      }

      setMessage("Scheduler tick completed");
      router.refresh();
    });
  };

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Automation schedule</p>
        <Button size="sm" variant="secondary" disabled={isPending} onClick={tickNow}>
          Run scheduler now
        </Button>
      </div>

      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
        >
          <div>
            <p className="text-sm font-medium">{task.agent}</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {task.cadence.replace(/_/g, " ")}
              {task.nextRunAt ? ` · Next: ${new Date(task.nextRunAt).toLocaleString()}` : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant={task.enabled ? "secondary" : "primary"}
            disabled={isPending}
            onClick={() => updateTask(task.id, !task.enabled)}
          >
            {task.enabled ? "Disable" : "Enable"}
          </Button>
        </div>
      ))}

      {message && <p className="text-xs text-[var(--text-secondary)]">{message}</p>}
    </div>
  );
}

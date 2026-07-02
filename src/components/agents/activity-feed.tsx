"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { CrtFrame, PixelLoadingDots, PixelSpinner } from "@/components/ui/pixel-loader";
import {
  Activity,
  Bot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  Mail,
  X,
  DollarSign,
  Search,
  MessageCircle,
} from "lucide-react";

type ActivityEvent = {
  id: string;
  eventType: string;
  agent: string | null;
  level: string;
  message: string;
  createdAt: string;
  businessName?: string;
};

const AGENT_COLORS: Record<string, string> = {
  intake: "from-amber-400/20 to-amber-600/10 border-amber-500/30",
  planner: "from-blue-400/20 to-blue-600/10 border-blue-500/30",
  builder: "from-emerald-400/20 to-emerald-600/10 border-emerald-500/30",
  marketing: "from-purple-400/20 to-purple-600/10 border-purple-500/30",
  support: "from-cyan-400/20 to-cyan-600/10 border-cyan-500/30",
  safeguard: "from-indigo-400/20 to-indigo-600/10 border-indigo-500/30",
  outreach: "from-rose-400/20 to-rose-600/10 border-rose-500/30",
  ads: "from-orange-400/20 to-orange-600/10 border-orange-500/30",
  finance: "from-green-400/20 to-green-600/10 border-green-500/30",
  "competitor-research": "from-violet-400/20 to-violet-600/10 border-violet-500/30",
  orchestrator: "from-yellow-400/20 to-yellow-600/10 border-yellow-500/30",
};

const EVENT_ICONS: Record<string, typeof Zap> = {
  "step.completed": CheckCircle2,
  "step.failed": XCircle,
  "step.started": Bot,
  "run.completed": CheckCircle2,
  "run.failed": XCircle,
  "run.started": Zap,
  "execution.completed": CheckCircle2,
  "execution.failed": XCircle,
  "execution.queued": Clock,
  "execution.dead_letter": AlertTriangle,
  "approval.required": AlertTriangle,
};

function getEventIcon(eventType: string) {
  const Icon = EVENT_ICONS[eventType];
  if (Icon) return Icon;
  if (eventType.includes("twitter") || eventType.includes("social")) return X;
  if (eventType.includes("mail") || eventType.includes("email")) return Mail;
  if (eventType.includes("finance") || eventType.includes("revenue")) return DollarSign;
  if (eventType.includes("research") || eventType.includes("competitor")) return Search;
  if (eventType.includes("support") || eventType.includes("message")) return MessageCircle;
  return Activity;
}

function getLevelColor(level: string): string {
  switch (level) {
    case "error": return "text-error";
    case "warn": return "text-warning";
    default: return "text-accent-secondary";
  }
}

function EventCard({ event, showBusiness }: { event: ActivityEvent; showBusiness?: boolean }) {
  const Icon = getEventIcon(event.eventType);
  const levelColor = getLevelColor(event.level);
  const agentColor = event.agent ? AGENT_COLORS[event.agent] : "border-white/10";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-gradient-to-r p-4 transition-all duration-200 hover:shadow-md",
        agentColor,
        event.level === "error" && "border-error/30 bg-error/5",
        event.level === "warn" && "border-warning/30 bg-warning/5"
      )}
    >
      {/* Pixel scanline overlay on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 pixel-scanline" />

      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/30", levelColor)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {event.agent && (
              <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                {event.agent}
              </span>
            )}
            {showBusiness && event.businessName && (
              <span className="font-mono text-[10px] text-text-muted">
                {event.businessName}
              </span>
            )}
            <span className={cn("ml-auto font-mono text-[10px]", levelColor)}>
              {event.eventType}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-primary">{event.message}</p>
          <p className="mt-0.5 font-mono text-[10px] text-text-muted">
            {formatRelativeTime(event.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed({
  events: initialEvents,
  businessId,
  showBusiness,
  emptyText = "No activity yet",
  className,
}: {
  events: ActivityEvent[];
  businessId?: string;
  showBusiness?: boolean;
  emptyText?: string;
  className?: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const poll = async () => {
      try {
        const params = businessId ? `?businessId=${businessId}` : "";
        const res = await fetch(`/api/activity${params}`);
        if (!res.ok) return;
        const data = (await res.json()) as { events: ActivityEvent[] };
        setEvents(data.events);
      } catch {
        // silent
      }
    };
    intervalRef.current = setInterval(poll, 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, businessId]);

  // Sync if initial changes
  useEffect(() => { setEvents(initialEvents); }, [initialEvents]);

  if (events.length === 0) {
    return (
      <CrtFrame className={cn("flex flex-col items-center justify-center py-12", className)}>
        <Activity className="mb-3 h-8 w-8 text-text-muted" />
        <p className="text-sm text-text-muted">{emptyText}</p>
      </CrtFrame>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Auto-refresh toggle */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={cn(
            "font-mono text-[10px] uppercase tracking-wider transition-colors",
            autoRefresh ? "text-accent-secondary" : "text-text-muted hover:text-text-secondary"
          )}
        >
          {autoRefresh ? "● live" : "○ paused"}
        </button>
      </div>

      <div ref={scrollRef} className="space-y-2">
        {events.map((event, i) => (
          <div
            key={event.id}
            className="animate-in"
            style={{ animation: `fadeIn 0.3s ease-out ${i * 30}ms both` }}
          >
            <EventCard event={event} showBusiness={showBusiness} />
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/** Skeleton loading state for the activity feed */
export function ActivityFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-white/10 bg-bg-elevated p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-16 rounded bg-bg-muted" />
                <div className="h-4 w-24 rounded bg-bg-muted" />
              </div>
              <div className="h-4 w-3/4 rounded bg-bg-muted" />
              <div className="h-3 w-12 rounded bg-bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

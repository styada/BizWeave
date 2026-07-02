"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ChatMessage = { role: string; content: string; taskId?: string | null };

export function OperatorChat({ businessId }: { businessId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/businesses/${businessId}/chat`)
      .then((r) => r.json())
      .then((d) => {
        if (d.conversation) {
          setConversationId(d.conversation.id);
          setMessages(d.conversation.messages ?? []);
        }
      })
      .catch(() => undefined);
  }, [businessId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, conversationId }),
      });
      const data = await res.json();
      if (res.ok) {
        setConversationId(data.conversationId);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.reply, taskId: data.taskId },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.error ?? "Something went wrong." },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Network error — try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-bg-surface">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">Ask your operator</h3>
        <p className="text-xs text-text-muted">
          Try: “build my website”, “run an ad for the weekend”, “set up a receptionist”.
        </p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-text-muted">
            Your AI operator is ready. What should it work on?
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-accent-primary/15 text-text-primary"
                : "bg-bg-muted text-text-secondary"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.taskId && (
              <span className="mt-1 block text-[10px] uppercase tracking-wide text-accent-primary">
                task dispatched
              </span>
            )}
          </div>
        ))}
        {busy && <p className="text-xs text-text-muted">Operator is working…</p>}
      </div>
      <div className="flex gap-2 border-t border-white/10 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Message your operator…"
          className="flex-1 rounded-xl border border-white/10 bg-bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
        />
        <Button onClick={send} disabled={busy}>
          Send
        </Button>
      </div>
    </div>
  );
}

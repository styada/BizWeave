"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";

type KeyRecord = {
  provider: string;
  keyHint: string;
  isValid: boolean;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadKeys() {
    const res = await fetch("/api/keys");
    const data = await res.json();
    if (res.ok) setKeys(data.keys);
  }

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/keys");
      const data = await res.json();

      if (res.ok) {
        setKeys(data.keys);
      }
    })();
  }, []);

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Failed to save");
      return;
    }
    setMessage(data.isValid ? "Key saved and verified ✓" : "Key saved but verification failed");
    setApiKey("");
    loadKeys();
  }

  async function removeKey(p: string) {
    await fetch(`/api/keys?provider=${p}`, { method: "DELETE" });
    loadKeys();
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Settings
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">API Keys (BYOK)</h1>
      <p className="mt-1 text-[var(--text-secondary)]">
        Your keys never leave encrypted storage. Used only for your agent runs.
      </p>

      <div className="mt-8 space-y-3">
        {keys.map((k) => (
          <Card key={k.provider} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium capitalize">{k.provider}</p>
              <p className="font-mono text-xs text-[var(--text-muted)]">{k.keyHint}</p>
            </div>
            <div className="flex items-center gap-3">
              {k.isValid ? (
                <Check className="h-5 w-5 text-[var(--success)]" />
              ) : (
                <X className="h-5 w-5 text-[var(--error)]" />
              )}
              <Button variant="ghost" size="sm" onClick={() => removeKey(k.provider)}>
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Add API key</CardTitle>
        </CardHeader>
        <form onSubmit={saveKey} className="space-y-4">
          <div>
            <Label>Provider</Label>
            <div className="mt-2 flex gap-2">
              {(["openai", "anthropic"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={`rounded-lg border px-4 py-2 text-sm capitalize ${
                    provider === p
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                      : "border-white/10"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="apiKey">API key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
              className="mt-1.5 font-mono"
              required
            />
          </div>
          {message && (
            <p className="text-sm text-[var(--accent-secondary)]">{message}</p>
          )}
          <Button type="submit" loading={loading}>
            Save & test connection
          </Button>
        </form>
      </Card>
    </div>
  );
}

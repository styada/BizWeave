"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Check, X, ExternalLink } from "lucide-react";

type KeyRecord = {
  provider: string;
  keyHint: string;
  isValid: boolean;
  model: string | null;
  baseUrl: string | null;
};

type ProviderDef = {
  id: string;
  label: string;
  blurb: string;
  kind: "openai" | "anthropic";
  models: string[];
  defaultModel: string;
  docs: string;
  customBaseUrl?: boolean;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [providers, setProviders] = useState<ProviderDef[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadKeys() {
    const res = await fetch("/api/keys");
    const data = await res.json();
    if (res.ok) setKeys(data.keys);
  }

  useEffect(() => {
    void (async () => {
      // Fetch the provider registry once on mount.
      const r = await fetch("/api/keys/providers");
      const d = await r.json();
      if (r.ok && Array.isArray(d.providers)) {
        setProviders(d.providers);
        // Default to OpenAI if present, else first in the list.
        const first = d.providers.find((p: ProviderDef) => p.id === "openai") ?? d.providers[0];
        if (first) {
          setProvider(first.id);
          setModel(first.defaultModel);
        }
      }
      // And the saved keys.
      const kr = await fetch("/api/keys");
      const kd = await kr.json();
      if (kr.ok) setKeys(kd.keys);
    })();
  }, []);

  // When the user switches providers, update model + baseUrl defaults.
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === provider),
    [providers, provider]
  );

  function pickProvider(p: ProviderDef) {
    setProvider(p.id);
    setModel(p.defaultModel);
    setBaseUrl("");
  }

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const body: Record<string, string> = { provider, apiKey };
    if (model) body.model = model;
    if (baseUrl) body.baseUrl = baseUrl;

    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  function modelLabel(k: KeyRecord): string {
    if (k.model) return k.model;
    const def = providers.find((p) => p.id === k.provider);
    return def?.defaultModel ?? "default model";
  }

  return (
    <div className="p-8 max-w-3xl">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Settings
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">LLM API Keys (BYOK)</h1>
      <p className="mt-1 text-[var(--text-secondary)]">
        Your keys never leave encrypted storage. Used only for your agent runs.
      </p>

      {/* Saved keys */}
      <div className="mt-8 space-y-3">
        {keys.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No keys yet. Add one below.
          </p>
        ) : null}
        {keys.map((k) => {
          const def = providers.find((p) => p.id === k.provider);
          return (
            <Card key={k.provider} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{def?.label ?? k.provider}</p>
                <p className="font-mono text-xs text-[var(--text-muted)]">
                  {k.keyHint} · {modelLabel(k)}
                  {k.baseUrl ? ` · ${k.baseUrl}` : ""}
                </p>
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
          );
        })}
      </div>

      {/* Add a key */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Add API key</CardTitle>
        </CardHeader>
        <form onSubmit={saveKey} className="space-y-5">
          <div>
            <Label>Provider</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickProvider(p)}
                  className={`rounded-lg border p-3 text-left transition ${
                    provider === p.id
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <p className="font-medium">{p.label}</p>
                  <p className="text-xs text-[var(--text-muted)]">{p.blurb}</p>
                </button>
              ))}
            </div>
          </div>

          {selectedProvider ? (
            <>
              <div>
                <Label htmlFor="apiKey">API key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={selectedProvider.id === "openai" ? "sk-..." : selectedProvider.id === "anthropic" ? "sk-ant-..." : "paste your key…"}
                  className="mt-1.5 font-mono"
                  required
                />
                <a
                  href={selectedProvider.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  Get a key
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div>
                <Label htmlFor="model">Model</Label>
                <div className="mt-1.5 flex gap-2">
                  <select
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="flex h-10 flex-1 rounded-md border border-white/10 bg-[var(--bg-elev)] px-3 text-sm"
                  >
                    {selectedProvider.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="or type a custom model"
                    className="flex-1 font-mono"
                  />
                </div>
              </div>

              {selectedProvider.customBaseUrl ? (
                <div>
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://your-endpoint/v1/chat/completions"
                    className="mt-1.5 font-mono"
                    required
                  />
                </div>
              ) : null}
            </>
          ) : null}

          {message ? (
            <p className="text-sm text-[var(--accent-secondary)]">{message}</p>
          ) : null}
          <Button type="submit" loading={loading}>
            Save & test connection
          </Button>
        </form>
      </Card>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

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
  /** Curated list — used as a fallback when live fetch fails. */
  models: string[];
  defaultModel: string;
  docs: string;
  customBaseUrl?: boolean;
};

type ListedModel = {
  id: string;
  ownedBy?: string;
  kind?: string;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [providers, setProviders] = useState<ProviderDef[]>([]);

  const [provider, setProvider] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");

  // Live-fetched models for the form. Empty array means "fetch failed or
  // hasn't happened yet" — the UI falls back to the curated list.
  const [liveModels, setLiveModels] = useState<ListedModel[]>([]);
  const [liveModelsStatus, setLiveModelsStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [liveModelsMessage, setLiveModelsMessage] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");

  // Refs for debounced fetching.
  const fetchSeq = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- Loaders -----
  async function loadKeys() {
    const res = await fetch("/api/keys");
    const data = await res.json();
    if (res.ok) setKeys(data.keys);
  }

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/keys/providers");
      const d = await r.json();
      if (r.ok && Array.isArray(d.providers)) {
        setProviders(d.providers);
        const first =
          d.providers.find((p: ProviderDef) => p.id === "openai") ??
          d.providers[0];
        if (first) {
          setProvider(first.id);
          setModel(first.defaultModel);
        }
      }
      const kr = await fetch("/api/keys");
      const kd = await kr.json();
      if (kr.ok) setKeys(kd.keys);
    })();
  }, []);

  const selectedProvider = providers.find((p) => p.id === provider);

  // ----- Model fetching -----
  /**
   * Hit the provider's /v1/models endpoint. Returns just the ids.
   * Falls back gracefully — never throws.
   */
  const fetchLiveModels = useCallback(
    async (prov: string, key: string, url?: string) => {
      if (!prov || !key) {
        setLiveModels([]);
        setLiveModelsStatus("idle");
        setLiveModelsMessage("");
        return;
      }
      const seq = ++fetchSeq.current;
      setLiveModelsStatus("loading");
      setLiveModelsMessage("Fetching live model list…");
      try {
        const params = new URLSearchParams({ provider: prov, apiKey: key });
        if (url) params.set("baseUrl", url);
        const res = await fetch(`/api/keys/models?${params.toString()}`);
        if (seq !== fetchSeq.current) return; // a newer fetch started
        if (!res.ok) {
          setLiveModels([]);
          setLiveModelsStatus("error");
          setLiveModelsMessage("Couldn't fetch models — using curated list.");
          return;
        }
        const data = (await res.json()) as { models: ListedModel[] };
        if (seq !== fetchSeq.current) return;
        if (!data.models || data.models.length === 0) {
          setLiveModels([]);
          setLiveModelsStatus("error");
          setLiveModelsMessage("No models returned — using curated list.");
          return;
        }
        setLiveModels(data.models);
        setLiveModelsStatus("ok");
        setLiveModelsMessage(`${data.models.length} models available`);
      } catch {
        if (seq !== fetchSeq.current) return;
        setLiveModels([]);
        setLiveModelsStatus("error");
        setLiveModelsMessage("Network error — using curated list.");
      }
    },
    []
  );

  // Auto-fetch when provider, key, or baseUrl change. Debounced 600ms.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!provider || !apiKey) {
      setLiveModels([]);
      setLiveModelsStatus("idle");
      setLiveModelsMessage("");
      return;
    }
    debounceRef.current = setTimeout(() => {
      void fetchLiveModels(provider, apiKey, baseUrl || undefined);
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [provider, apiKey, baseUrl, fetchLiveModels]);

  // ----- Provider selection -----
  function pickProvider(p: ProviderDef) {
    setProvider(p.id);
    setModel(p.defaultModel);
    setBaseUrl("");
  }

  // ----- Save / delete -----
  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const body: Record<string, string> = { provider, apiKey };
    if (model) body.model = model;
    if (baseUrl) body.baseUrl = baseUrl;

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setMessageTone(data.isValid ? "ok" : "error");
      if (data.isValid) {
        setMessage("Key saved and verified ✓");
      } else if (data.verifyError) {
        setMessage(`Saved, but key didn't verify: ${data.verifyError}`);
      } else {
        setMessage("Saved, but key didn't verify. Check it and try again.");
      }
      setApiKey("");
      void loadKeys();
    } catch (err) {
      setLoading(false);
      setMessageTone("error");
      setMessage(
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error"
      );
    }
  }

  async function removeKey(p: string) {
    await fetch(`/api/keys?provider=${p}`, { method: "DELETE" });
    void loadKeys();
  }

  // ----- Display helpers -----
  /** Build the model dropdown options: live list, then curated as a fallback. */
  const modelOptions: string[] = liveModels.length
    ? liveModels.map((m) => m.id)
    : (selectedProvider?.models ?? []);

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
          <p className="text-sm text-[var(--text-muted)]">No keys yet. Add one below.</p>
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
                  placeholder={
                    selectedProvider.id === "openai"
                      ? "sk-..."
                      : selectedProvider.id === "anthropic"
                      ? "sk-ant-..."
                      : "paste your key…"
                  }
                  className="mt-1.5 font-mono"
                  required
                />
                {selectedProvider.docs ? (
                  <a
                    href={selectedProvider.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  >
                    Get a key
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="model">Model</Label>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    {liveModelsStatus === "loading" ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Fetching…</span>
                      </>
                    ) : liveModelsStatus === "ok" ? (
                      <span className="text-[var(--success)]">
                        ✓ {liveModelsMessage}
                      </span>
                    ) : liveModelsStatus === "error" ? (
                      <span>{liveModelsMessage}</span>
                    ) : null}
                    {apiKey ? (
                      <button
                        type="button"
                        onClick={() =>
                          void fetchLiveModels(
                            provider,
                            apiKey,
                            baseUrl || undefined
                          )
                        }
                        className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 hover:border-white/20"
                        aria-label="Refresh model list"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Refresh
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="relative mt-1.5">
                  <select
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full appearance-none rounded-md border border-white/10 bg-[var(--bg-elev)] px-3 py-2 pr-9 text-sm"
                  >
                    {!model ? (
                      <option value="">— select a model —</option>
                    ) : null}
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    {model && !modelOptions.includes(model) ? (
                      <option value={model}>{model} (custom)</option>
                    ) : null}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                </div>
                <Input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="or type a custom model id"
                  className="mt-2 font-mono"
                />
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
            <p
              className={
                messageTone === "ok"
                  ? "text-sm text-[var(--success)]"
                  : "text-sm text-[var(--error)]"
              }
            >
              {message}
            </p>
          ) : null}
          <Button type="submit" loading={loading}>
            Save & test connection
          </Button>
        </form>
      </Card>
    </div>
  );
}

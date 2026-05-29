"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PageLoader } from "@/components/loading/page-loader";
import Link from "next/link";

const BUSINESS_TYPES = [
  { value: "retail-liquor", label: "Liquor & spirits retail" },
  { value: "retail-general", label: "General retail" },
  { value: "restaurant", label: "Restaurant / food service" },
  { value: "saas", label: "SaaS / digital product" },
  { value: "services", label: "Professional services" },
  { value: "other", label: "Other" },
];

const STEPS = ["Business", "Details", "Inventory", "Launch"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    type: "retail-liquor",
    tagline: "",
    description: "",
    location: "",
    phone: "",
    email: "",
    inventoryCsv: "",
  });

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function parseInventory(csv: string) {
    const lines = csv.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return [];

    const hasHeader = lines[0].toLowerCase().includes("name");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      return {
        name: parts[0] ?? "Item",
        category: parts[1],
        price: parts[2] ? parseFloat(parts[2]) : undefined,
        sku: parts[3],
        quantity: parts[4] ? parseInt(parts[4], 10) : undefined,
      };
    });
  }

  async function createBusiness() {
    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        tagline: form.tagline || undefined,
        description: form.description || undefined,
        location: form.location || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to create business");
    return data.business.id as string;
  }

  async function saveInventory(id: string) {
    const items = parseInventory(form.inventoryCsv);
    if (items.length === 0) return;
    const res = await fetch(`/api/businesses/${id}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to save inventory");
    }
  }

  async function runAgents(id: string) {
    const res = await fetch(`/api/businesses/${id}/run`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Agent pipeline failed");
  }

  async function handleNext() {
    setError("");
    if (step === 0 && !form.name.trim()) {
      setError("Business name is required");
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      return;
    }

    if (step === 2) {
      setLoading(true);
      try {
        let id = businessId;
        if (!id) {
          id = await createBusiness();
          setBusinessId(id);
        }
        await saveInventory(id);
        setStep(3);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
      return;
    }
  }

  async function handleLaunch() {
    setError("");
    setLoading(true);
    try {
      let id = businessId;
      if (!id) {
        id = await createBusiness();
        setBusinessId(id);
      }
      await saveInventory(id);
      await runAgents(id);
      router.push(`/dashboard/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (loading && step >= 2) {
    return <PageLoader message="Agents are weaving your business…" />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          ← Dashboard
        </Link>
        <h1 className="mt-6 font-serif text-3xl">Weave a new business</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Tell us about your existing business. Agents handle the rest.
        </p>

        <div className="mt-8 flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition ${
                i <= step ? "bg-[var(--accent-primary)]" : "bg-[var(--bg-muted)]"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>

        <Card className="mt-8">
          {error && (
            <p className="mb-4 rounded-lg bg-[var(--error)]/10 px-4 py-2 text-sm text-[var(--error)]">
              {error}
            </p>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Business name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Sunset Spirits"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Business type</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {BUSINESS_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => update("type", t.value)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                        form.type === t.value
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="location">Location / address</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="123 Main St, Austin, TX"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="description">About your business</Label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  rows={4}
                  className="mt-1.5 w-full rounded-[10px] border border-white/10 bg-[var(--bg-surface)] px-4 py-3 text-sm"
                  placeholder="Family-owned liquor store since 1987…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="inventory">Inventory (CSV)</Label>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Format: name, category, price, sku, quantity — one item per line. Optional
                  header row.
                </p>
                <textarea
                  id="inventory"
                  value={form.inventoryCsv}
                  onChange={(e) => update("inventoryCsv", e.target.value)}
                  rows={10}
                  className="mt-2 w-full rounded-[10px] border border-white/10 bg-[var(--bg-surface)] px-4 py-3 font-mono text-xs"
                  placeholder={`name,category,price
Tito's Vodka 1L,Spirits,24.99
Local IPA 6-pack,Beer,12.99`}
                />
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Skip if not applicable (SaaS businesses can leave empty).
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center py-4">
              <p className="text-[var(--text-secondary)]">
                Ready to launch <strong>{form.name}</strong>? Six AI agents will:
              </p>
              <ul className="mx-auto max-w-sm text-left text-sm text-[var(--text-muted)] space-y-2">
                <li>✓ Analyze your business (Intake)</li>
                <li>✓ Plan site & GTM (Planner)</li>
                <li>✓ Build your website (Builder)</li>
                <li>✓ Create marketing (Marketing)</li>
                <li>✓ Set up support templates (Support)</li>
                <li>✓ Safeguard review before publish</li>
              </ul>
              <p className="text-xs text-[var(--text-muted)] pt-4">
                <Link href="/dashboard/settings/keys" className="text-[var(--accent-primary)] underline">
                  Add API keys
                </Link>{" "}
                for full LLM power, or run in demo mode with smart templates.
              </p>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0 || loading}
            >
              Back
            </Button>
            {step < 3 ? (
              <Button onClick={handleNext} disabled={loading}>
                Continue
              </Button>
            ) : (
              <Button onClick={handleLaunch} loading={loading}>
                Launch agents
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

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
  { value: "retail-liquor", label: "Liquor & spirits" },
  { value: "retail-general", label: "General retail" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe / coffee" },
  { value: "salon-barber", label: "Salon / barber" },
  { value: "gym-fitness", label: "Gym / fitness" },
  { value: "trades", label: "Trades (plumb/HVAC/etc.)" },
  { value: "clinic-health", label: "Clinic / health" },
  { value: "auto-shop", label: "Auto shop" },
  { value: "services", label: "Professional services" },
  { value: "other", label: "Other" },
];

const STEPS = ["Contact & location", "Profile", "Systems", "Goals & guardrails", "Launch"];

type Form = {
  name: string;
  type: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  tagline: string;
  description: string;
  serviceArea: string;
  categories: string;
  posSystem: string;
  orderMgmtSystem: string;
  websiteUrl: string;
  googleBusinessProfileId: string;
  goals: string;
  monthlyBudgetCapUsd: string;
  requireApprovalForSends: boolean;
  requireApprovalForSpend: boolean;
  authorizeOperator: boolean;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<Form>({
    name: "",
    type: "retail-liquor",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "US",
    tagline: "",
    description: "",
    serviceArea: "",
    categories: "",
    posSystem: "",
    orderMgmtSystem: "",
    websiteUrl: "",
    googleBusinessProfileId: "",
    goals: "",
    monthlyBudgetCapUsd: "",
    requireApprovalForSends: true,
    requireApprovalForSpend: true,
    authorizeOperator: false,
  });

  function update<K extends keyof Form>(field: K, value: Form[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function launch() {
    setError("");
    if (!form.authorizeOperator) {
      setError("Please authorize the AI operator and accept the terms to continue.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        authorizeOperator: form.authorizeOperator as true,
        categories: form.categories
          ? form.categories.split(",").map((c) => c.trim()).filter(Boolean)
          : undefined,
        monthlyBudgetCapUsd: form.monthlyBudgetCapUsd
          ? Number(form.monthlyBudgetCapUsd)
          : undefined,
      };
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create business");
      const id = data.business.id as string;
      // Kick the pipeline; don't block the redirect on completion.
      fetch(`/api/businesses/${id}/run?processNow=false`, { method: "POST" }).catch(
        () => undefined
      );
      router.push(`/dashboard/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  function handleNext() {
    setError("");
    if (step === 0 && !form.name.trim()) {
      setError("Business name is required");
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  if (loading) {
    return <PageLoader message="Setting up your AI operator…" />;
  }

  return (
    <div className="min-h-screen bg-bg-base px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-text-muted">
          ← Dashboard
        </Link>
        <h1 className="mt-6 font-serif text-3xl text-text-primary">Add your business</h1>
        <p className="mt-2 text-text-secondary">
          Tell your AI operator about your business. It runs everything else.
        </p>

        <div className="mt-8 flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition ${
                i <= step ? "bg-accent-primary" : "bg-bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>

        <Card className="mt-8">
          {error && (
            <p className="mb-4 rounded-lg bg-error/10 px-4 py-2 text-sm text-error">{error}</p>
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
                          ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                          : "border-white/10 text-text-secondary hover:border-white/20"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label htmlFor="addr1">Street address</Label>
                <Input id="addr1" value={form.addressLine1} onChange={(e) => update("addressLine1", e.target.value)} placeholder="123 Main St" className="mt-1.5" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="region">State / region</Label>
                  <Input id="region" value={form.region} onChange={(e) => update("region", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="postal">Postal code</Label>
                  <Input id="postal" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} className="mt-1.5" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="tagline">Tagline (optional)</Label>
                <Input id="tagline" value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="Your neighborhood bottle shop since 1987" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="description">About your business</Label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  rows={5}
                  className="mt-1.5 w-full rounded-xl border border-bg-muted bg-bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/40"
                  placeholder="What you sell, who you serve, what makes you different…"
                />
              </div>
              <div>
                <Label htmlFor="categories">Categories (comma-separated)</Label>
                <Input id="categories" value={form.categories} onChange={(e) => update("categories", e.target.value)} placeholder="wine, craft beer, spirits" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="serviceArea">Service area (optional)</Label>
                <Input id="serviceArea" value={form.serviceArea} onChange={(e) => update("serviceArea", e.target.value)} placeholder="5-mile radius / Downtown Austin" className="mt-1.5" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-text-muted">
                Tell us what you already use — the operator connects to these later.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pos">POS system</Label>
                  <Input id="pos" value={form.posSystem} onChange={(e) => update("posSystem", e.target.value)} placeholder="Square / Clover / Toast" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="oms">Order management</Label>
                  <Input id="oms" value={form.orderMgmtSystem} onChange={(e) => update("orderMgmtSystem", e.target.value)} placeholder="Shopify / none" className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label htmlFor="website">Existing website / domain</Label>
                <Input id="website" value={form.websiteUrl} onChange={(e) => update("websiteUrl", e.target.value)} placeholder="https://mybusiness.com" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="gbp">Google Business Profile (name or ID)</Label>
                <Input id="gbp" value={form.googleBusinessProfileId} onChange={(e) => update("googleBusinessProfileId", e.target.value)} className="mt-1.5" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="goals">What do you want the operator to focus on?</Label>
                <textarea
                  id="goals"
                  value={form.goals}
                  onChange={(e) => update("goals", e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-bg-muted bg-bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/40"
                  placeholder="More foot traffic, online orders, fill slow weekday nights…"
                />
              </div>
              <div>
                <Label htmlFor="budget">Monthly budget cap (USD)</Label>
                <Input id="budget" type="number" value={form.monthlyBudgetCapUsd} onChange={(e) => update("monthlyBudgetCapUsd", e.target.value)} placeholder="500" className="mt-1.5" />
                <p className="mt-1 text-xs text-text-muted">Hard ceiling on spend the operator can incur on your behalf.</p>
              </div>
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input type="checkbox" checked={form.requireApprovalForSends} onChange={(e) => update("requireApprovalForSends", e.target.checked)} />
                Require my approval before sending emails/SMS/social posts
              </label>
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input type="checkbox" checked={form.requireApprovalForSpend} onChange={(e) => update("requireApprovalForSpend", e.target.checked)} />
                Require my approval before spending money (ads/purchases)
              </label>
              <label className="flex items-start gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.authorizeOperator}
                  onChange={(e) => update("authorizeOperator", e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I authorize Bizweave&apos;s AI operator to act on my behalf within the limits above. I agree to the{" "}
                  <Link href="/legal/terms" className="text-accent-primary underline" target="_blank">Terms</Link> and{" "}
                  <Link href="/legal/privacy" className="text-accent-primary underline" target="_blank">Privacy Policy</Link>.
                </span>
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 py-4 text-center">
              <p className="text-text-secondary">
                Ready to launch <strong className="text-text-primary">{form.name || "your business"}</strong>? Your operator will:
              </p>
              <ul className="mx-auto max-w-sm space-y-2 text-left text-sm">
                <li className="text-text-secondary">✓ Understand your business (Intake)</li>
                <li className="text-text-secondary">✓ Plan your online presence (Planner)</li>
                <li className="text-text-secondary">✓ Build your website (Builder)</li>
                <li className="text-text-secondary">✓ Scan local competitors (Research)</li>
                <li className="text-text-secondary">✓ Draft marketing & outreach</li>
                <li className="text-text-secondary">✓ Safeguard review before anything goes live</li>
              </ul>
              <p className="pt-4 text-xs text-text-muted">
                <Link href="/dashboard/settings/keys" className="text-accent-primary underline hover:text-accent-glow">
                  Add API keys
                </Link>{" "}
                for full power, or run in demo mode with smart templates.
              </p>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={handleNext}>Continue</Button>
            ) : (
              <Button onClick={launch}>Launch operator</Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

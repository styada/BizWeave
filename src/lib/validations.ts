import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const apiKeySchema = z.object({
  // Provider id is a free string. The registry in
  // src/lib/llm/providers.ts decides which are accepted by the UI.
  provider: z.string().min(1).max(64),
  apiKey: z.string().min(10, "API key looks too short"),
  /** Optional model id. Defaults to the provider's defaultModel. */
  model: z.string().max(200).optional(),
  /** Required for custom OpenAI-compatible providers. */
  baseUrl: z.string().url().max(500).optional(),
});

/** Physical, owner-operated local-business categories (Bizweave's target market). */
export const BUSINESS_TYPES = [
  "retail-liquor",
  "retail-general",
  "restaurant",
  "cafe",
  "salon-barber",
  "gym-fitness",
  "trades", // plumber, electrician, HVAC, etc.
  "clinic-health",
  "auto-shop",
  "services",
  "other",
] as const;

export const businessSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(BUSINESS_TYPES),
  tagline: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
});

/** Full onboarding payload (Phase 1) — physical business detail + systems + guardrails. */
export const onboardingSchema = z.object({
  // Step 1 — contact & location
  name: z.string().min(1).max(200),
  type: z.enum(BUSINESS_TYPES),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  addressLine1: z.string().max(300).optional().or(z.literal("")),
  addressLine2: z.string().max(300).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  region: z.string().max(120).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  country: z.string().max(2).default("US"),
  hours: z
    .array(
      z.object({
        day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
        open: z.string().optional(),
        close: z.string().optional(),
        closed: z.boolean().default(false),
      })
    )
    .optional(),
  socialHandles: z.record(z.string(), z.string()).optional(),
  // Step 2 — profile
  tagline: z.string().max(300).optional().or(z.literal("")),
  description: z.string().max(5000).optional().or(z.literal("")),
  categories: z.array(z.string().max(80)).optional(),
  serviceArea: z.string().max(300).optional().or(z.literal("")),
  // Step 3 — systems
  posSystem: z.string().max(120).optional().or(z.literal("")),
  orderMgmtSystem: z.string().max(120).optional().or(z.literal("")),
  websiteUrl: z.string().max(500).optional().or(z.literal("")),
  googleBusinessProfileId: z.string().max(200).optional().or(z.literal("")),
  // Step 4 — goals & guardrails
  goals: z.string().max(2000).optional().or(z.literal("")),
  monthlyBudgetCapUsd: z.coerce.number().min(0).max(100000).optional(),
  requireApprovalForSends: z.boolean().default(true),
  requireApprovalForSpend: z.boolean().default(true),
  // Legal: owner authorizes the AI operator (Phase 26).
  authorizeOperator: z.literal(true, {
    message: "You must authorize the AI operator to continue.",
  }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const inventoryItemSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  price: z.coerce.number().optional(),
  quantity: z.coerce.number().int().optional(),
  category: z.string().optional(),
});

export const inventoryBulkSchema = z.object({
  items: z.array(inventoryItemSchema),
});

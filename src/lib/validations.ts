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
  provider: z.enum(["openai", "anthropic"]),
  apiKey: z.string().min(10, "API key looks too short"),
});

export const businessSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum([
    "retail-liquor",
    "retail-general",
    "restaurant",
    "saas",
    "services",
    "other",
  ]),
  tagline: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
});

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

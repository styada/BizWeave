export type AgentId =
  | "intake"
  | "planner"
  | "builder"
  | "marketing"
  | "support"
  | "safeguard"
  | "outreach"
  | "ads"
  | "finance"
  | "competitor-research"
  | "orchestrator";

export const AGENT_PIPELINE: AgentId[] = [
  "orchestrator",
  "intake",
  "planner",
  "builder",
  "marketing",
  "support",
  "safeguard",
  "outreach",
  "ads",
  "finance",
  "competitor-research",
];

export const AGENT_LABELS: Record<AgentId, string> = {
  intake: "Intake Agent",
  planner: "Planner Agent",
  builder: "Builder Agent",
  marketing: "Marketing Agent",
  support: "Support Agent",
  safeguard: "Safeguard Agent",
  outreach: "Outreach Agent",
  ads: "Ads Agent",
  finance: "Finance Agent",
  "competitor-research": "Competitor Research Agent",
  orchestrator: "Orchestrator Agent",
};

export type BusinessContext = {
  id: string;
  name: string;
  type: string;
  tagline?: string | null;
  description?: string | null;
  location?: string | null;
  phone?: string | null;
  email?: string | null;
  inventory: {
    name: string;
    sku?: string | null;
    price?: number | null;
    quantity?: number | null;
    category?: string | null;
  }[];
};

export type SafeguardVerdict = {
  approved: boolean;
  issues: string[];
  revisions: string[];
  summary: string;
  reliabilityIndex: number;
  scores: {
    safety: number;
    consistency: number;
    channelReadiness: number;
  };
  differentiatorInsight: string;
};

export type IntakeOutput = {
  persona: string;
  valueProps: string[];
  tone: string;
  competitorHints: string[];
  constraints: string[];
};

export type PlannerOutput = {
  siteStructure: {
    pages: {
      slug: string;
      title: string;
      sections: string[];
    }[];
    primaryCTA: string;
    colorMood: string;
  };
  contentThemes: string[];
  marketingAngles: string[];
  timeline: {
    phase: string;
    duration: string;
    actions: string[];
  }[];
};

export type SiteOutput = {
  html: string;
  css: string;
  meta: {
    title: string;
    description: string;
    templateId?: string;
    tier?: string;
  };
};

export type MarketingOutput = {
  channels: string[];
  campaigns: {
    name: string;
    channel: string;
    content: string;
    schedule?: string;
  }[];
  seoKeywords: string[];
};

export type SupportOutput = {
  faqs: {
    question: string;
    answer: string;
  }[];
  autoReplies: {
    trigger: string;
    response: string;
  }[];
  escalationRules: string[];
};

export type OutreachOutput = {
  campaigns: {
    name: string;
    channel: "email" | "sms" | "linkedin" | "twitter";
    subject: string;
    body: string;
    targetAudience: string;
    schedule: "now" | "weekly" | "monthly";
  }[];
  templates: {
    name: string;
    content: string;
  }[];
};

export type AdsOutput = {
  platforms: string[];
  campaigns: {
    name: string;
    platform: string;
    budget: string;
    targetAudience: string;
    adCopy: string;
    startDate: string;
  }[];
  budget: {
    monthly: number;
    allocation: Record<string, number>;
  };
};

export type FinanceOutput = {
  revenueStreams: {
    name: string;
    type: "product" | "service" | "subscription" | "other";
    estimatedMonthly: number;
  }[];
  pricingTiers: {
    name: string;
    price: number;
    features: string[];
  }[];
  metrics: {
    suggestedPricePoints: number[];
    breakEvenEstimate: string;
    growthIndicators: string[];
  };
};

export type CompetitorResearchOutput = {
  competitors: {
    name: string;
    website: string;
    strengths: string[];
    weaknesses: string[];
    estimatedTraffic?: string;
  }[];
  marketPositioning: {
    differentiators: string[];
    gaps: string[];
    opportunities: string[];
  };
  pricingComparison: {
    competitor: string;
    priceRange: string;
    notes: string;
  }[];
};

export type OrchestratorOutput = {
  plan: {
    phase: string;
    agents: AgentId[];
    priority: number;
    estimatedDuration: string;
  }[];
  reasoning: string;
  riskFlags: string[];
};

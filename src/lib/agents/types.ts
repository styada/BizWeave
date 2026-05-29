export type AgentId =
  | "intake"
  | "planner"
  | "builder"
  | "marketing"
  | "support"
  | "safeguard";

export const AGENT_PIPELINE: AgentId[] = [
  "intake",
  "planner",
  "builder",
  "marketing",
  "support",
  "safeguard",
];

export const AGENT_LABELS: Record<AgentId, string> = {
  intake: "Intake Agent",
  planner: "Planner Agent",
  builder: "Builder Agent",
  marketing: "Marketing Agent",
  support: "Support Agent",
  safeguard: "Safeguard Agent",
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

/**
 * Bizweave Integrations Framework
 *
 * Pluggable integration system for external channels (social, email, SMS).
 * Each integration must implement the ChannelIntegration interface.
 *
 * Usage:
 *   const registry = new IntegrationRegistry();
 *   registry.register(twitterIntegration);
 *   await registry.post(twitterIntegration, "Tweet content", credentials);
 */

export type ChannelType = "twitter" | "linkedin" | "email" | "sms";

export interface ChannelCredentials {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  [key: string]: string | undefined;
}

export interface PostResult {
  ok: boolean;
  externalId?: string;
  url?: string;
  error?: string;
}

export interface ChannelIntegration {
  type: ChannelType;
  label: string;
  description: string;
  /** Validate that the credentials are syntactically valid */
  validateCredentials(creds: ChannelCredentials): boolean;
  /** Post content to the channel. Returns the result. */
  post(params: {
    content: string;
    credentials: ChannelCredentials;
    mediaUrls?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<PostResult>;
  /** Optional: Check if the integration is properly configured */
  isConfigured?(creds: ChannelCredentials): boolean;
}

export class IntegrationRegistry {
  private integrations = new Map<ChannelType, ChannelIntegration>();

  register(integration: ChannelIntegration): void {
    if (this.integrations.has(integration.type)) {
      console.warn(`[integrations] Overwriting existing integration: ${integration.type}`);
    }
    this.integrations.set(integration.type, integration);
  }

  get(type: ChannelType): ChannelIntegration | undefined {
    return this.integrations.get(type);
  }

  getAll(): ChannelIntegration[] {
    return Array.from(this.integrations.values());
  }

  listConfigured(creds: Record<ChannelType, ChannelCredentials | null>): ChannelType[] {
    return this.getAll()
      .filter((i) => {
        const c = creds[i.type];
        return c && i.validateCredentials(c);
      })
      .map((i) => i.type);
  }

  async post(type: ChannelType, content: string, credentials: ChannelCredentials): Promise<PostResult> {
    const integration = this.integrations.get(type);
    if (!integration) {
      return { ok: false, error: `No integration registered for channel: ${type}` };
    }
    if (!integration.validateCredentials(credentials)) {
      return { ok: false, error: `Invalid credentials for ${type}` };
    }
    return integration.post({ content, credentials });
  }
}

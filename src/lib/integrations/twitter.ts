/**
 * Twitter/X Integration
 *
 * Uses Twitter API v2 (OAuth 2.0 with PKCE or OAuth 1.0a).
 *
 * TODO: Replace fetch with a proper Twitter API client library when
 *       the app reaches production scale with many active integrations.
 */

import type { ChannelIntegration, ChannelCredentials, PostResult } from "./index";

const TWITTER_API_BASE = "https://api.twitter.com/2";

export const twitterIntegration: ChannelIntegration = {
  type: "twitter",
  label: "Twitter / X",
  description: "Post tweets and manage Twitter/X presence",

  validateCredentials(creds: ChannelCredentials): boolean {
    return !!(creds.accessToken || creds.apiKey);
  },

  isConfigured(creds: ChannelCredentials): boolean {
    return !!creds.accessToken;
  },

  async post({
    content,
    credentials,
  }: {
    content: string;
    credentials: ChannelCredentials;
    mediaUrls?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<PostResult> {
    if (!credentials.accessToken) {
      return { ok: false, error: "No access token configured" };
    }

    // Truncate to Twitter's 280 char limit
    const tweetText = content.length > 280 ? content.slice(0, 277) + "..." : content;

    try {
      const response = await fetch(`${TWITTER_API_BASE}/tweets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: tweetText }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        return {
          ok: false,
          error: `Twitter API error (${response.status}): ${errorBody}`,
        };
      }

      const data = (await response.json()) as { data?: { id: string } };
      return {
        ok: true,
        externalId: data.data?.id,
        url: data.data?.id
          ? `https://twitter.com/i/status/${data.data.id}`
          : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown Twitter API error",
      };
    }
  },
};

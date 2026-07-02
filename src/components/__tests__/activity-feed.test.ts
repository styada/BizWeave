import { describe, expect, it } from "vitest";
import { formatRelativeTime, cn } from "@/lib/utils";

describe("ActivityFeed utilities", () => {
  describe("formatRelativeTime", () => {
    it('returns "just now" for very recent dates', () => {
      const d = new Date();
      expect(formatRelativeTime(d)).toBe("just now");
    });

    it("returns minutes ago", () => {
      const d = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe("5m ago");
    });

    it("returns hours ago", () => {
      const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe("3h ago");
    });

    it("returns days ago", () => {
      const d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe("2d ago");
    });

    it("returns weeks ago", () => {
      const d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe("2w ago");
    });

    it("returns months ago", () => {
      const d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe("2mo ago");
    });

    it("returns years ago", () => {
      const d = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe("1y ago");
    });

    it("handles string dates", () => {
      const iso = new Date(Date.now() - 60_000).toISOString();
      expect(formatRelativeTime(iso)).toBe("1m ago");
    });
  });

  describe("cn utility", () => {
    it("merges class names", () => {
      expect(cn("px-4", "py-2")).toBe("px-4 py-2");
    });

    it("handles conditional classes", () => {
      expect(cn("base", false && "hidden", "visible")).toBe("base visible");
    });

    it("resolves tailwind conflicts", () => {
      expect(cn("px-4", "px-6")).toBe("px-6");
    });
  });
});

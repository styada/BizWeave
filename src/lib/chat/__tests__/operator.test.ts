import { describe, it, expect } from "vitest";
import { classifyIntent } from "@/lib/chat/operator";

describe("classifyIntent", () => {
  it("detects website build requests", () => {
    expect(classifyIntent("Please build a new website for my shop")).toBe("build_website");
  });

  it("detects ad campaigns", () => {
    expect(classifyIntent("Run an ad campaign for summer")).toBe("run_ads");
  });

  it("detects receptionist setup", () => {
    expect(classifyIntent("Create an AI receptionist to answer calls")).toBe("create_receptionist");
  });

  it("detects outreach", () => {
    expect(classifyIntent("Send a newsletter to my email list")).toBe("outreach");
  });

  it("detects competitor research", () => {
    expect(classifyIntent("Who are my competitors nearby?")).toBe("competitor_intel");
  });

  it("detects questions", () => {
    expect(classifyIntent("What are my hours?")).toBe("question");
  });

  it("falls back to generic_task", () => {
    expect(classifyIntent("Install Square POS integration")).toBe("generic_task");
  });
});

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple in-memory rate limiter (for production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // max requests per window

export function rateLimit(request: NextRequest, key?: string): NextResponse | null {
  const ip = key ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return null;
  }
  
  if (record.count >= MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }
  
  record.count++;
  return null;
}

/** Per-business API throttle (Phase 25). */
export function rateLimitBusiness(businessId: string, request: NextRequest): NextResponse | null {
  return rateLimit(request, `biz:${businessId}`);
}

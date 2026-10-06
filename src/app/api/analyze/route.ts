import { NextResponse } from "next/server";
import { analysisRequestSchema } from "@/lib/analysis-schema";
import { analyzeInput, ReviewError } from "@/lib/review-engine";
import { createLiveLimiter, isAuthorized, readJsonBody } from "@/lib/request-guard";
import { getServerConfig } from "@/lib/server-config";

export const runtime = "nodejs";
export const maxDuration = 60;
const acquire = createLiveLimiter();

// Validate credentials before consuming input or spending tokens.
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const config = getServerConfig();
    if (!config.ready) throw new ReviewError(503, "Analysis is unavailable because server configuration is incomplete.");
    if (!config.demo && !isAuthorized(request.headers.get("authorization"), config.accessToken!)) {
      throw new ReviewError(401, "Enter a valid review access token for live analysis.");
    }
    const body = await readJsonBody(request);
    const parsed = analysisRequestSchema.safeParse(body);
    if (!parsed.success) throw new ReviewError(400, parsed.error.issues[0]?.message || "Invalid request.");
    if (!config.demo) release = acquire();
    const result = await analyzeInput(parsed.data, request.signal);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof ReviewError ? error.status : 500;
    const message = error instanceof ReviewError ? error.message : "Unexpected error while generating the review.";
    return NextResponse.json({ error: message }, {
      status,
      headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) },
    });
  } finally { release?.(); }
}

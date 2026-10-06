import { timingSafeEqual } from "node:crypto";
import { ReviewError } from "@/lib/review-engine";

export const MAX_BODY_BYTES = 100_000;

// Compare equal-length tokens without leaking their prefixes through timing.
export function isAuthorized(header: string | null, token: string) {
  const supplied = Buffer.from(header?.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

// Streamed byte counting prevents chunked bodies from bypassing Content-Length checks.
export async function readJsonBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ReviewError(415, "Send the request as application/json.");
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw new ReviewError(413, "Request body is too large.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ReviewError(400, "Request body must be valid JSON.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ReviewError(413, "Request body is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch { throw new ReviewError(400, "Request body must be valid JSON."); }
}

// This process-wide limit is deliberately simple, not a distributed budget guarantee.
export function createLiveLimiter(now: () => number = Date.now) {
  let windowStart = 0;
  let requests = 0;
  let active = false;
  return () => {
    const time = now();
    if (time - windowStart >= 60_000) { windowStart = time; requests = 0; }
    if (active || requests >= 10) throw new ReviewError(429, "Review capacity reached. Try again in a minute.");
    requests += 1;
    active = true;
    return () => { active = false; };
  };
}

import { NextResponse } from "next/server";
import { getServerConfig } from "@/lib/server-config";

export const dynamic = "force-dynamic";

// Readiness checks configuration without spending tokens or exposing secrets.
export function GET() {
  const config = getServerConfig();
  return NextResponse.json({
    status: config.ready ? "ok" : "configuration_required",
    mode: config.demo ? "demo" : "live",
    requiresAccessToken: !config.demo,
  }, { status: config.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

import { NextResponse } from "next/server";

import { isApiConfigured, upstreamFetch } from "@/lib/api/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isApiConfigured()) {
    return NextResponse.json({ status: "degraded", api: "not-configured" }, { status: 503 });
  }

  try {
    const response = await upstreamFetch("/health", { method: "GET" });
    return NextResponse.json(
      { status: response.ok ? "operational" : "degraded", api: response.ok ? "reachable" : "unavailable" },
      { status: response.ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ status: "degraded", api: "unreachable" }, { status: 503 });
  }
}

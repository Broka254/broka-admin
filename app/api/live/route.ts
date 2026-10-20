import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Process liveness only. It deliberately does not probe BROKA_API_URL: an
// upstream outage must not make the platform restart a healthy web process.
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}

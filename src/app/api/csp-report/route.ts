import { isIpRateLimited } from "@/lib/rate-limit";

// Where browsers send what the Report-Only content security policy would
// have blocked (next.config.ts, security audit SEC-08). Each report becomes
// one short log line on Vercel — enough to see which sources are missing
// from the policy before it's enforced. Anyone can post here, so the body is
// capped, the rate limited per IP, and only a few fields are kept (page
// path, directive, blocked source — no query strings).
const MAX_BODY_BYTES = 8 * 1024;

type CspReport = {
  "document-uri"?: string;
  "violated-directive"?: string;
  "effective-directive"?: string;
  "blocked-uri"?: string;
};

function pathOnly(uri: string | undefined) {
  if (!uri) return "";
  try {
    const url = new URL(uri);
    return url.protocol.startsWith("http")
      ? `${url.origin}${url.pathname}`
      : url.protocol;
  } catch {
    return uri.slice(0, 80);
  }
}

export async function POST(request: Request) {
  if (await isIpRateLimited("cspReport")) {
    return new Response(null, { status: 429 });
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let report: CspReport | undefined;
  try {
    const parsed = JSON.parse(body) as
      { "csp-report"?: CspReport } | { body?: CspReport }[];
    report = Array.isArray(parsed) ? parsed[0]?.body : parsed["csp-report"];
  } catch {
    return new Response(null, { status: 400 });
  }
  if (report) {
    console.warn(
      "CSP (observation) :",
      report["effective-directive"] ?? report["violated-directive"] ?? "?",
      "bloquerait",
      pathOnly(report["blocked-uri"]) || "(inline)",
      "sur",
      pathOnly(report["document-uri"]),
    );
  }
  return new Response(null, { status: 204 });
}

// frame-ancestors decides which sites may embed the dashboard in an iframe.
// Left unset it keeps the historical "any HTTPS origin" (the embedded
// preview depends on it). Set BROKA_FRAME_ANCESTORS when the app is built
// to the exact embedding origins - for example
// "'self' https://preview.example.com", or "'none'" when nothing embeds it -
// to stop other sites framing an authenticated admin session (clickjacking).
// Only CSP source expressions are accepted, so a stray ";" cannot inject
// another directive.
const SOURCE = /^(?:'self'|'none'|https:|https:\/\/(?:\*\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*(?::\d{1,5})?)$/;

export function frameAncestors(raw: string | undefined): string {
  const configured = raw?.trim();
  if (!configured) return "https:";
  const tokens = configured.split(/\s+/).filter((token) => SOURCE.test(token));
  if (tokens.includes("'none'")) return "'none'";
  return tokens.length ? tokens.join(" ") : "'none'";
}

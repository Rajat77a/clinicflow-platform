const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["content-security-policy", CONTENT_SECURITY_POLICY],
  ["cross-origin-opener-policy", "same-origin"],
  ["cross-origin-resource-policy", "same-origin"],
  ["permissions-policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()"],
  ["referrer-policy", "no-referrer"],
  ["strict-transport-security", "max-age=63072000; includeSubDomains; preload"],
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["x-permitted-cross-domain-policies", "none"],
];

export function applySecurityHeaders(response: Response, pathname: string, requestId: string) {
  const headers = new Headers(response.headers);

  for (const [name, value] of SECURITY_HEADERS) {
    headers.set(name, value);
  }

  headers.set("x-request-id", requestId);

  if (pathname === "/login" || pathname.startsWith("/app")) {
    headers.set("cache-control", "private, no-store, max-age=0");
    headers.set("pragma", "no-cache");
    headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function healthResponse(requestId: string) {
  return applySecurityHeaders(
    Response.json(
      {
        status: "ok",
        service: "clinicflow",
        timestamp: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    ),
    "/healthz",
    requestId,
  );
}

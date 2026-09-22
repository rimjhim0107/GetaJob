const BLOCKED_HOSTNAMES = ["localhost", "0.0.0.0", "[::1]"];

function isPrivateOrLoopbackIp(hostname: string): boolean {
  // IPv4 loopback and private ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number) as unknown as [number, number, number, number, number];
    const first = Number(ipv4Match[1]);
    const second = Number(ipv4Match[2]);
    if (first === 127) return true; // loopback
    if (first === 10) return true; // private
    if (first === 172 && second >= 16 && second <= 31) return true; // private
    if (first === 192 && second === 168) return true; // private
    if (first === 169 && second === 254) return true; // link-local
  }
  return false;
}

export function isUrlSafeToFetch(url: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: "Only http/https URLs are allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // In non-production environments (e.g. the batch command's local test fixtures
  // served from localhost, per Section 9), allow local addresses.
  if (process.env.NODE_ENV !== "production") {
    return { safe: true };
  }

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { safe: false, reason: "Loopback addresses are not allowed" };
  }

  if (isPrivateOrLoopbackIp(hostname)) {
    return { safe: false, reason: "Private/internal IP addresses are not allowed" };
  }

  return { safe: true };
}
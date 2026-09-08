// A game client served from a developer's machine signs in against the live identity service, so
// loopback origins on any port are trusted alongside the configured ones. Browsers set the Origin
// header themselves; a page cannot claim a loopback origin it is not served from.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export const isLoopbackHost = (host: string | undefined): boolean => host !== undefined && LOOPBACK_HOSTS.has(host);

export const isLoopbackOrigin = (origin: string): boolean => {
  try {
    return isLoopbackHost(new URL(origin).hostname);
  } catch {
    return false;
  }
};

/** The same set as better-auth `trustedOrigins` patterns (matched against the request origin). */
export const LOOPBACK_ORIGIN_PATTERNS = ["localhost", "127.0.0.1", "[::1]"].flatMap((host) => [
  `http://${host}:*`,
  `https://${host}:*`,
]);

/** The same set as better-auth `trustedOrigins` patterns (matched against the request origin). */
export const LOOPBACK_ORIGIN_PATTERNS = ["localhost", "127.0.0.1", "[::1]"].flatMap((host) => [
  `http://${host}:*`,
  `https://${host}:*`,
]);

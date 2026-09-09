const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export const isLoopbackHost = (host: string | undefined): boolean =>
  host !== undefined && LOOPBACK_HOSTS.has(host);

export const isLoopbackOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      isLoopbackHost(url.hostname)
    );
  } catch {
    return false;
  }
};

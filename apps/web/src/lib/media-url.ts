export const DEFAULT_IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs/";
const MEDIA_LOAD_ATTEMPT_COUNT = 3;

function joinIpfsGateway(ipfsGateway: string, path: string) {
  return `${ipfsGateway.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function resolveIpfsMediaUrl(
  src: string,
  ipfsGateway = DEFAULT_IPFS_GATEWAY,
) {
  if (src.startsWith("ipfs://")) {
    return joinIpfsGateway(ipfsGateway, src.slice("ipfs://".length));
  }

  try {
    const url = new URL(src);
    const ipfsPath = /^\/ipfs\/(.+)/.exec(url.pathname)?.[1];
    if (ipfsPath) {
      return `${joinIpfsGateway(ipfsGateway, ipfsPath)}${url.search}${url.hash}`;
    }
  } catch {
    // Preserve relative and otherwise non-URL media sources.
  }

  return src;
}

export function getNextMediaLoadAttempt(currentAttempt: number) {
  const nextAttempt = currentAttempt + 1;
  return nextAttempt < MEDIA_LOAD_ATTEMPT_COUNT ? nextAttempt : null;
}

export function getMediaRetryDelayMs(currentAttempt: number) {
  return 1_000 * (currentAttempt + 1);
}

export function withMediaRetryAttempt(src: string, attempt: number) {
  if (attempt === 0) return src;

  try {
    const url = new URL(src);
    url.searchParams.set("realmsRetry", attempt.toString());
    return url.toString();
  } catch {
    return src;
  }
}

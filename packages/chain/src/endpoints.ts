export type GameChain = "madara" | "appchain";

const FORBIDDEN_HOST_SUFFIX = ["cartridge", "gg"].join(".");

export interface ResolveEndpointOptions {
  name: string;
  browserFacing?: boolean;
  locationProtocol?: string;
}

const isForbiddenHost = (hostname: string): boolean =>
  hostname === FORBIDDEN_HOST_SUFFIX ||
  hostname.endsWith(`.${FORBIDDEN_HOST_SUFFIX}`);

const resolveLocationProtocol = (
  providedProtocol?: string,
): string | undefined => {
  if (providedProtocol) return providedProtocol;
  const browserWindow = (
    globalThis as { window?: { location?: { protocol?: string } } }
  ).window;
  return browserWindow?.location?.protocol;
};

export const resolveEndpoint = (
  value: string | undefined,
  options: ResolveEndpointOptions,
): string => {
  if (!value) {
    throw new Error(`${options.name} is required`);
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error(`${options.name} must be an absolute URL`);
  }

  if (isForbiddenHost(endpoint.hostname)) {
    throw new Error(`${options.name} resolves to a forbidden host`);
  }

  const pageProtocol = resolveLocationProtocol(options.locationProtocol);
  const isBrowserFacing =
    options.browserFacing ??
    Boolean((globalThis as { window?: unknown }).window);
  if (
    isBrowserFacing &&
    pageProtocol === "https:" &&
    endpoint.protocol !== "https:"
  ) {
    throw new Error(`${options.name} must use HTTPS on an HTTPS page`);
  }

  return endpoint.toString().replace(/\/$/, "");
};

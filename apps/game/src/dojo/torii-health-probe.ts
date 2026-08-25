const DEFAULT_TORII_HEALTH_TIMEOUT_MS = 5_000;

export type ToriiHealthReachableSource = "health" | "sql_fallback";
export type ToriiHealthUnreachableReason = "endpoint_not_found" | "timeout" | "network_error" | "server_error";

export type ToriiHealthProbeResult =
  | {
      status: "reachable";
      source: ToriiHealthReachableSource;
      httpStatus: number;
      healthHttpStatus?: number;
    }
  | {
      status: "unreachable";
      reason: ToriiHealthUnreachableReason;
      httpStatus?: number;
      healthHttpStatus?: number;
    };

interface ToriiHealthProbeOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const buildToriiEndpointUrl = (toriiBaseUrl: string, path: "/health" | "/sql"): string =>
  `${toriiBaseUrl.replace(/\/+$/, "")}${path}`;

const createTimeoutSignal = (timeoutMs: number): AbortSignal | undefined =>
  timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

const fetchToriiEndpoint = async (url: string, fetchFn: typeof fetch, timeoutMs: number): Promise<Response> =>
  fetchFn(url, {
    method: "GET",
    signal: createTimeoutSignal(timeoutMs),
  });

const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === "AbortError" || error.name === "TimeoutError";
  }

  if (error instanceof Error) {
    return /abort|timeout|timed out/i.test(`${error.name} ${error.message}`);
  }

  return false;
};

const classifyFetchFailure = (error: unknown, healthHttpStatus?: number): ToriiHealthProbeResult => ({
  status: "unreachable",
  reason: isTimeoutError(error) ? "timeout" : "network_error",
  ...(typeof healthHttpStatus === "number" ? { healthHttpStatus } : {}),
});

const classifyHttpFailure = (httpStatus: number, healthHttpStatus?: number): ToriiHealthProbeResult => ({
  status: "unreachable",
  reason: httpStatus === 404 ? "endpoint_not_found" : "server_error",
  httpStatus,
  ...(typeof healthHttpStatus === "number" ? { healthHttpStatus } : {}),
});

export const probeToriiHealth = async (
  toriiBaseUrl: string,
  { fetchFn = fetch, timeoutMs = DEFAULT_TORII_HEALTH_TIMEOUT_MS }: ToriiHealthProbeOptions = {},
): Promise<ToriiHealthProbeResult> => {
  let healthHttpStatus: number | undefined;

  try {
    const healthResponse = await fetchToriiEndpoint(buildToriiEndpointUrl(toriiBaseUrl, "/health"), fetchFn, timeoutMs);
    healthHttpStatus = healthResponse.status;
    if (healthResponse.ok) {
      return { status: "reachable", source: "health", httpStatus: healthResponse.status };
    }

    const sqlResponse = await fetchToriiEndpoint(buildToriiEndpointUrl(toriiBaseUrl, "/sql"), fetchFn, timeoutMs);
    if (sqlResponse.ok) {
      return {
        status: "reachable",
        source: "sql_fallback",
        httpStatus: sqlResponse.status,
        healthHttpStatus: healthResponse.status,
      };
    }

    return classifyHttpFailure(sqlResponse.status, healthResponse.status);
  } catch (error) {
    return classifyFetchFailure(error, healthHttpStatus);
  }
};

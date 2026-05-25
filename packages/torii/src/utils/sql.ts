/**
 * Properly formats an address by converting to bigint and padding to 64 hex characters
 * This ensures consistent address formatting for database queries by:
 * 1. Converting the input string to bigint (handles various formats)
 * 2. Converting back to hex string (normalizes the format)
 * 3. Padding with leading zeros to exactly 64 characters
 * 4. Adding the 0x prefix
 *
 * Example: "0x1234" -> "0x0000000000000000000000000000000000000000000000000000000000001234"
 */
export function formatAddressForQuery(address: string): string {
  // Convert string to bigint to normalize it
  const addressBigInt = BigInt(address);

  // Convert back to hex string (without 0x prefix)
  const hexString = addressBigInt.toString(16);

  // Pad with leading zeros to make it 64 characters
  const paddedHex = hexString.padStart(64, "0");

  // Add 0x prefix back
  return `0x${paddedHex}`;
}

/**
 * Safely encodes a query string for URL parameters
 */
export function encodeQuery(query: string): string {
  return encodeURIComponent(query);
}

/**
 * Constructs the full API URL with the encoded query
 */
export function buildApiUrl(baseUrl: string, query: string): string {
  return `${baseUrl}?query=${encodeQuery(query)}`;
}

export interface FetchWithErrorHandlingOptions {
  timeoutMs?: number;
  retryDelaysMs?: number[];
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_FETCH_RETRY_DELAYS_MS = [250, 1_000];
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

class FetchTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
  }
}

class FetchResponseError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super(statusText);
    this.name = "FetchResponseError";
  }
}

const waitForRetryDelay = (delayMs: number): Promise<void> =>
  delayMs <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, delayMs));

const createFetchTimeout = (timeoutMs: number): { signal?: AbortSignal; clear: () => void } => {
  if (timeoutMs <= 0 || typeof AbortController === "undefined") {
    return { clear: () => undefined };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new FetchTimeoutError(timeoutMs));
  }, timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
};

const isRetryableFetchError = (error: unknown): boolean => {
  if (error instanceof FetchResponseError) {
    return RETRYABLE_HTTP_STATUSES.has(error.status);
  }

  if (error instanceof FetchTimeoutError) {
    return true;
  }

  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  return false;
};

const normalizeFetchError = (error: unknown, timeoutMs: number): Error => {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new FetchTimeoutError(timeoutMs);
    }
    return error;
  }

  return new Error(String(error));
};

const formatFetchErrorMessage = (errorMessage: string, error: unknown): string => {
  const detail = error instanceof Error ? error.message : String(error);
  return `${errorMessage}: ${detail}`;
};

const fetchJsonOnce = async (url: string, options: FetchWithErrorHandlingOptions): Promise<unknown> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const timeout = createFetchTimeout(timeoutMs);

  try {
    const response = await fetch(url, timeout.signal ? { signal: timeout.signal } : undefined);

    if (!response.ok) {
      throw new FetchResponseError(response.status, response.statusText);
    }

    return await response.json();
  } catch (error) {
    throw normalizeFetchError(error, timeoutMs);
  } finally {
    timeout.clear();
  }
};

const fetchJsonWithRetry = async (
  url: string,
  errorMessage: string,
  options: FetchWithErrorHandlingOptions,
): Promise<unknown> => {
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_FETCH_RETRY_DELAYS_MS;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchJsonOnce(url, options);
    } catch (error) {
      const retryDelayMs = retryDelaysMs[attempt];
      if (retryDelayMs === undefined || !isRetryableFetchError(error)) {
        throw new Error(formatFetchErrorMessage(errorMessage, error));
      }

      await waitForRetryDelay(retryDelayMs);
    }
  }
};

/**
 * Generic function to handle SQL API responses with error checking.
 * SQL queries always return arrays, even for single row results.
 *
 * @template T The type of items in the array
 * @param url The API URL to fetch from
 * @param errorMessage Error message to throw if request fails
 * @returns Promise resolving to an array of T items
 * @throws Error if the request fails or response is not ok
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  errorMessage: string,
  options: FetchWithErrorHandlingOptions = {},
): Promise<T[]> {
  const result = await fetchJsonWithRetry(url, errorMessage, options);

  // Ensure the result is always an array (defensive programming)
  if (!Array.isArray(result)) {
    throw new Error(`${errorMessage}: Expected array response but got ${typeof result}`);
  }

  return result as T[];
}

/**
 * Generic function to handle JSON responses with error checking.
 *
 * @template T The type of the JSON response
 * @param url The API URL to fetch from
 * @param errorMessage Error message to throw if request fails
 * @returns Promise resolving to the parsed JSON response
 * @throws Error if the request fails or response is not ok
 */
export async function fetchJsonWithErrorHandling<T>(
  url: string,
  errorMessage: string,
  options: FetchWithErrorHandlingOptions = {},
): Promise<T> {
  return (await fetchJsonWithRetry(url, errorMessage, options)) as T;
}

/**
 * Helper function to safely extract the first item from a SQL result array.
 * Use this when you expect a single result from a SQL query.
 *
 * @template T The type of the item
 * @param sqlResult Array result from SQL query
 * @returns The first item or null if array is empty
 */
export function extractFirstOrNull<T>(sqlResult: T[]): T | null {
  return sqlResult.length > 0 ? sqlResult[0] : null;
}

/**
 * Helper function to safely extract the first item from a SQL result array.
 * Use this when you expect a single result and want to throw if none found.
 *
 * @template T The type of the item
 * @param sqlResult Array result from SQL query
 * @param errorMessage Error message to throw if no items found
 * @returns The first item
 * @throws Error if array is empty
 */
export function extractFirstOrThrow<T>(sqlResult: T[], errorMessage: string): T {
  if (sqlResult.length === 0) {
    throw new Error(errorMessage);
  }
  return sqlResult[0];
}

/**
 * Helper function to safely convert hex string to BigInt.
 * Handles null values, zero values, and invalid hex strings gracefully.
 *
 * @param hex The hex string to convert (can be null)
 * @returns BigInt value or 0n if hex is null/zero/invalid
 *
 * @example
 * hexToBigInt("0x1234") // returns 4660n
 * hexToBigInt("0x0") // returns 0n
 * hexToBigInt("0x0000000000000000000000000000000000000000000000000000000000000000") // returns 0n
 * hexToBigInt(null) // returns 0n
 * hexToBigInt("invalid") // returns 0n
 */
export function hexToBigInt(hex: string | null): bigint {
  if (!hex || hex === "0x0" || hex === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return 0n;
  }
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

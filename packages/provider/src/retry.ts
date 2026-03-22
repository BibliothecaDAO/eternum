/**
 * Retry utilities for transient network and RPC errors.
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor?: number;
  onRetry?: (error: unknown, attempt: number) => void;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  jitterFactor: 0.5,
};

// Error code patterns that are safe to retry
const RETRYABLE_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"]);
const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504]);
const RETRYABLE_MESSAGE_PATTERNS = ["nonce is too low", "nonce too old"];

// Error patterns that should NOT be retried (business logic failures)
const NON_RETRYABLE_MESSAGE_PATTERNS = ["execution reverted", "revert", "insufficient"];

/**
 * Determine whether an error is transient and safe to retry.
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error) && typeof error !== "object") return false;

  const err = error as any;

  // Check non-retryable patterns first (higher priority)
  const message = (err?.message ?? "").toLowerCase();
  for (const pattern of NON_RETRYABLE_MESSAGE_PATTERNS) {
    if (message.includes(pattern)) return false;
  }

  // Check error code (e.g. ECONNRESET)
  if (err?.code && RETRYABLE_CODES.has(err.code)) return true;

  // Check HTTP status
  if (err?.status && RETRYABLE_HTTP_STATUSES.has(err.status)) return true;

  // Check message patterns
  for (const pattern of RETRYABLE_MESSAGE_PATTERNS) {
    if (message.includes(pattern)) return true;
  }

  return false;
}

/**
 * Calculate exponential backoff delay with jitter.
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const jitterFactor = config.jitterFactor ?? 0.5;
  const baseDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = baseDelay * jitterFactor * Math.random();
  const delay = baseDelay + jitter;
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Execute a function with retry logic for transient errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> & { maxRetries: number; baseDelayMs: number; maxDelayMs: number },
  onRetry?: (error: unknown, attempt: number) => void,
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const retryCallback = onRetry ?? config.onRetry;

  let lastError: unknown;
  const maxAttempts = fullConfig.maxRetries + 1; // initial attempt + retries

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable or we've exhausted retries
      if (!isRetryableError(error) || attempt >= fullConfig.maxRetries) {
        throw error;
      }

      // Notify caller about the retry
      if (retryCallback) {
        retryCallback(error, attempt + 1);
      }

      // Wait before retrying
      const delay = calculateBackoffDelay(attempt, fullConfig);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

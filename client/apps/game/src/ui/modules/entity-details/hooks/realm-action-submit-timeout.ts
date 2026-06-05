const REALM_ACTION_SUBMIT_TIMEOUT_MS = 30_000;
export const REALM_ACTION_SUBMIT_TIMEOUT_MESSAGE =
  "Transaction submission timed out before a transaction hash was returned. Check your wallet activity, then try again.";

export const withRealmActionSubmitTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs = REALM_ACTION_SUBMIT_TIMEOUT_MS,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(REALM_ACTION_SUBMIT_TIMEOUT_MESSAGE));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

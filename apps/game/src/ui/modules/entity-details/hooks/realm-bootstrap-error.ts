import { extractReadableErrorMessage } from "@/utils/error-message";

export function resolveRealmBootstrapErrorMessage(error: unknown): string {
  const message = extractReadableErrorMessage(error, "").toLowerCase();
  if (message.includes("nonce")) {
    return "Your previous action is still syncing. Wait a moment, then try setting up the realm again.";
  }
  if (/fetch|network|timeout|timed out|connection/.test(message)) {
    return "Realm setup could not reach the game chain. Check your connection, then try again.";
  }
  return "Realm setup failed. Wait a moment and try again; reopen the game if it keeps failing.";
}

/**
 * What the service worker tells the window it brings forward when a chat alert (a mention, a private message) is
 * pressed: the alert's kind, target and tag, for the window to open chat on what it is about (chat-alert-press.ts).
 */
export const CHAT_ALERT_PRESSED = "chat-alert-pressed";

export interface ChatAlertPress {
  type: typeof CHAT_ALERT_PRESSED;
  kind: "mention" | "direct-message";
  target: string;
  tag?: string;
}

export const isChatAlertPress = (data: unknown): data is ChatAlertPress =>
  typeof data === "object" &&
  data !== null &&
  (data as ChatAlertPress).type === CHAT_ALERT_PRESSED &&
  ((data as ChatAlertPress).kind === "mention" || (data as ChatAlertPress).kind === "direct-message") &&
  typeof (data as ChatAlertPress).target === "string";

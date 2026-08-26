export const IDENTITY_SESSION_CHANGED_EVENT = "realms:identity-session-changed";

export const notifyIdentitySessionChanged = (): void => {
  window.dispatchEvent(new Event(IDENTITY_SESSION_CHANGED_EVENT));
};

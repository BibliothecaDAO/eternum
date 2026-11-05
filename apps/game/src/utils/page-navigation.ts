/**
 * The one way the client reloads its page or leaves it for another address. A browser's `location` cannot be
 * redefined, nor can jsdom's, so a test sees where the page went by spying on these.
 */
export const pageNavigation = {
  reload: (): void => window.location.reload(),
  open: (url: string): void => window.location.assign(url),
};

import type { SocialProvider } from "@realms-world/identity";

import type { IconMeaning } from "@/ui/design-system/icon";

/** Each sign-in provider's official mark (public/tokens), never a painting: Google's and Apple's brand rules ask for it. */
export const SIGN_IN_PROVIDER_MARKS = {
  google: "brand-google",
  apple: "brand-apple",
  discord: "brand-discord",
  twitter: "brand-x",
} as const satisfies Record<SocialProvider, IconMeaning>;

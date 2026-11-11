import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "party.realms.play",
  appName: "Realms",
  // The offline page only (scripts/write-offline-page.mjs): the app loads the live site, never a bundled client.
  webDir: "www",
  // The client reads this to know it runs in the iOS app (apps/game/src/runtime/distribution-channel.ts).
  appendUserAgent: "RealmsApp/ios",
  server: {
    // The trailing slash matters: Capacitor keeps a navigation in the app when its URL starts with this string, so
    // without it `https://play.realms.party.example.com` would open inside the app instead of in Safari.
    url: "https://play.realms.party/",
    errorPath: "offline.html",
  },
};

export default config;

# Realms for iOS

A Capacitor 8 shell around the live site, `https://play.realms.party`, for iPhone (iOS 16 and later; an iPad runs it as
an iPhone app). It does not bundle the client: sign-in shares the site's origin and cookie, and passkey wallets are tied
to the `play.realms.party` hostname. The client knows it runs here from the `RealmsApp/ios` its user agent ends with
(`apps/game/src/runtime/distribution-channel.ts`).

## What is here

- `capacitor.config.ts`: the bundle id `party.realms.play`, the site and the user agent.
- `scripts/write-offline-page.mjs`: before every `cap copy`, writes the page shown when the site cannot load, from the
  game's own `apps/game/public/offline.html`. Its Try again opens the site again.
- `ios/`: the Xcode project `npx cap add ios` generated (Swift Package Manager, no CocoaPods), with these changes:
  - iPhone only, iOS 16 and later; export compliance answered (`ITSAppUsesNonExemptEncryption` false: HTTPS only).
  - `App.entitlements`: Associated Domains `applinks:play.realms.party` (universal links) and
    `webcredentials:play.realms.party` (passkeys made in Safari sign in here, and the reverse), and push.
  - `SceneDelegate.swift` opens a universal link's page in the game; Capacitor alone only announces it.
  - `AppDelegate.swift` hands the push token to `@capacitor/push-notifications`.
  - `PrivacyInfo.xcprivacy`: no tracking, no tracking domains, no required-reason API. Capacitor and its two plugins
    call none; Capacitor ships its own manifest saying so, the plugins ship none. The data the site collects is declared
    in App Store Connect's privacy label.
- Two plugins. The site calls each through the bridge Capacitor injects into its page (`window.Capacitor`, read by
  `apps/game/src/pwa/ios-app-bridge.ts`):
  - `@capacitor/push-notifications`: Settings' **This device** asks for alerts and registers the APNs token with the
    identity service, sign-out revokes it, and a tapped alert opens its game or chat
    (`apps/game/src/pwa/ios-app-push.ts`).
  - `@capacitor/haptics`: one light tap when Herald confirms an action the player sent, under Settings' **Haptics**
    (`apps/game/src/ui/motion/motion-settings.ts`). An app build from before the plugin refuses the call, and the site
    stays silent there.

  A plugin is installed only with the site's call to it: none sits here unused. Sharing needs none: the web view's
  `navigator.share` opens iOS's own share sheet, and the season's recap shares its card through it in the app
  (`apps/game/src/shell/season-tab/season-recap.tsx`). `@capacitor/share` would add nothing but a sheet without the
  card's image, as it shares only files already saved on the phone.

Not yet: the app icon and launch image are still Capacitor's own. The icon is 1024 px with no transparency, drawn from
the Realms Brand Kit as `apps/game/scripts/build-brand.sh` draws the install icons.

What Capacitor already does, so this app adds nothing for it: when iOS kills the web view's process it reloads the page
that was open, and a link outside the site, or one that opens a new window, goes to Safari. The site's address in the
config ends with `/` because Capacitor keeps a navigation in the app when its URL starts with that string.

## Build

Needs a Mac with Xcode 26 (App Store uploads require its SDK), Node 20.19 or later and pnpm.

```bash
pnpm install
pnpm --dir apps/ios exec cap sync ios   # the offline page, and the Swift package of the installed plugins
open apps/ios/ios/App/App.xcodeproj     # run on a simulator or a phone from Xcode
```

GitHub builds it for the simulator, unsigned, on every change to what the build reads: `apps/ios/`, the game's offline
page and its icon, the lockfile and the workflow itself (`.github/workflows/ios.yml`;
`.github/scripts/test_ios_workflow_paths.py` holds the list to the build's inputs). It fails when the committed native
project differs from what `cap sync` writes. Commit `ios/` after adding a plugin.

## Sign and upload to TestFlight

On the owner's Mac, with Xcode signed in to the Realms organization's Apple account (Xcode > Settings > Accounts):

```bash
pnpm --dir apps/ios upload:testflight
```

It reads the Team ID from `apps/game/public/.well-known/apple-app-site-association`, archives with automatic signing
(Xcode creates the certificate and profile), numbers the build by its time, and uploads it. Signing runs there rather
than in GitHub because deployment credentials never enter GitHub (`.github/scripts/workflow-credentials.test.ts`).

## When the app needs a store release

Only when the shell changes: `capacitor.config.ts`, the entitlements, `Info.plist`, the privacy manifest, the native
code, or a plugin added or updated. A web deploy reaches the app at once and needs none.

## Owner steps

1. An **organization** Apple Developer account (Apple requires one for an app holding a wallet, guideline 3.1.5); it
   needs a D-U-N-S number.
2. In Certificates, Identifiers & Profiles, the App ID `party.realms.play` with Associated Domains and Push
   Notifications. Automatic signing enables them on the first archive if they are missing.
3. The app record in App Store Connect for that bundle id.
4. The Team ID (Membership details, ten characters), added as `<Team ID>.party.realms.play` to both `appIDs` and
   `webcredentials.apps` in `apps/game/public/.well-known/apple-app-site-association`, then deployed with the site.
   Apple's CDN fetches the file when the app is installed, and can take a day to see a change; check what it serves at
   `https://app-site-association.cdn-apple.com/a/v1/play.realms.party`. `src/app-hosting.test.ts` checks the entries.
5. An APNs key in the developer account for the push server (#5202); the app needs nothing more for push.
6. Then `pnpm --dir apps/ios upload:testflight`.

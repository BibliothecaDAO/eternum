# Realms for Android

The Play Store app is a Trusted Web Activity (TWA): it opens `https://play.realms.party/?channel=play` in the player's
Chrome, full screen. It bundles no client, so Chrome's WebGPU, passkeys, cookies, service worker and web push work as
they do on the site, and every web deploy reaches the app at once (#5184).

`twa-manifest.json` is the app's one source: package `party.realms.play`, start URL, colours, icons (the site's own
install icons, and its alert badge as the notification icon), standalone display, any orientation, notification
delegation, the Custom Tabs fallback when Chrome is missing, version, and the signing keys' fingerprints. The Gradle
project beside it is generated from it by [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) and committed as
generated, with one hand edit: the App Link filter in `app/src/main/AndroidManifest.xml` (below).

## Build

Needs JDK 17 and the Android SDK (`ANDROID_HOME`).

```bash
cd apps/android
./gradlew assembleDebug    # app/build/outputs/apk/debug/app-debug.apk, signed with your local debug key
./gradlew bundleRelease    # app/build/outputs/bundle/release/app-release.aab, unsigned
adb install app/build/outputs/apk/debug/app-debug.apk
```

The site vouches only for the Play keys, so a debug build shows Chrome's URL bar. To try one full screen, tell Chrome on
the device to skip that check for the site (enable `chrome://flags/#enable-command-line-on-non-rooted-devices` first):

```bash
adb shell "echo '_ --disable-digital-asset-link-verification-for-url=\"https://play.realms.party\"' > /data/local/tmp/chrome-command-line"
```

Then force-stop Chrome and open the app.

## Change the shell

Edit `twa-manifest.json`, never the site, for a value the app needs differently, then regenerate from `apps/android`:

```bash
npx @bubblewrap/cli update --skipVersionUpgrade    # rewrites the project from twa-manifest.json
```

Bubblewrap writes an App Link filter for the whole host. Put back the three `android:pathPrefix` lines
(`git diff app/src/main/AndroidManifest.xml`): shared `/g/`, `/join/devcon/` and `/results/` links open the app, every
other path stays in the browser, and `/blitz/` is left out until Blitz is decided for the store apps (#5192). The
`android app` workflow refuses a bundle without them.

## Release

A store release is needed only when the shell changes: anything in this folder, such as the manifest's values, the
icons, the App Link paths, or the target SDK Play requires each year. Game changes ship with the web deploy.

1. Raise the version: `npx @bubblewrap/cli update --appVersionName <name>` raises `appVersionCode` by one (Play refuses
   a `versionCode` it has seen) and writes both into `twa-manifest.json` and `app/build.gradle`; put the App Link paths
   back as above.
2. Merge to `next`. The `android app` workflow (`.github/workflows/android-app.yml`) builds the release bundle on every
   change under `apps/android/` and on manual dispatch, and uploads it as `android-bundle-unsigned`. Outside pull
   requests it signs it with the upload key and uploads `android-bundle-signed`; without the key it warns and stops
   there.
3. Upload `android-bundle-signed` in Play Console: internal testing, then closed testing, then production (#5196).

## Owner setup

1. **Play account.** An organization Play developer account (it needs a D-U-N-S number); a personal account made after
   November 2023 must run a 14-day closed test with 12 testers before production.
2. **Upload key.** Create it once, keep the file and its passwords backed up offline, never in git:

   ```bash
   keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 upload.keystore    # the value of ANDROID_UPLOAD_KEYSTORE_BASE64
   ```

   In GitHub, Settings → Environments, create `android-upload`, limit its deployment branches to `next`, and add the
   secrets `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_KEYSTORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS` (`upload`)
   and `ANDROID_UPLOAD_KEY_PASSWORD`. They are the only stored secrets any workflow may read
   (`.github/scripts/workflow-credentials.test.ts`).

3. **Play App Signing.** Create the app `party.realms.play` and upload the first signed bundle by hand; Play keeps the
   key installs are signed with and accepts bundles signed with the upload key.
4. **Fingerprints (#5191).** Add both keys' SHA-256 to `twa-manifest.json`, from `apps/android`:

   ```bash
   keytool -list -v -keystore upload.keystore -alias upload | grep SHA256
   npx @bubblewrap/cli fingerprint add <upload key SHA-256> --name "upload key"
   npx @bubblewrap/cli fingerprint add <Play App Signing key SHA-256> --name "Play App Signing key"
   ```

   The second is on Play Console's App integrity page, under App signing. Commit `twa-manifest.json` (the
   `assetlinks.json` Bubblewrap also writes is ignored). The client's build writes `/.well-known/assetlinks.json` from
   it (`apps/game/build/asset-links.ts`) and refuses a malformed or single key; until both are named the site serves
   none. After the next web deploy, check `play.realms.party` with Google's
   [Statement List tester](https://developers.google.com/digital-asset-links/tools/generator) for `party.realms.play`.
   Leaving out the Play App Signing key is the usual reason Play installs show the URL bar.

## Device checklist (#5193)

The system back runs the page's `history.back()`, and Chrome closes the app when the page has no history left. The
client's side is tested: back closes an open sheet and leaves the page under it
(`src/ui/design-system/kit/kit.test.tsx`), and back from a game's pages and from its map returns to the page before the
game (`src/ui/features/frontier/frontier-hud.test.tsx`). On a phone with a Play build (no URL bar), check the rest:

- [ ] Launched from the icon, the home page opens full screen. Back closes the app; it never shows a blank page.
- [ ] In a game, on the map: back returns to the home page, and back again closes the app.
- [ ] On the map with a sheet open (the Menu, the Season): back closes the sheet and the map stays.
- [ ] A `https://play.realms.party/join/devcon/<code>` link tapped in Messages opens the app on that page; back returns
      to Messages. A `/g/` and a `/results/` link do the same. A `/blitz/` link opens in Chrome.
- [ ] Turning alerts on in the game shows Android's notification prompt for Realms (Android 13+), and the "Alerts are
      on" push arrives under Realms with the white badge icon.
- [ ] With the app swiped away, an "army under attack" alert (`apps/realms/server/shard-notifier.ts`, sent through
      `push-notifications.ts`) arrives, and tapping it opens the app on that game.

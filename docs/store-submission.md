# Store submission answers

What to type into Google Play Console and App Store Connect for the Realms apps (`party.realms.play`): the data each
store asks about, the content ratings, Play's financial features (blockchain) declaration, the reviewer sign-in and
review notes, and the listing copy. Both apps load `https://play.realms.party` and bundle no client, so every answer
describes the site as it runs there. Epics: #5184 (Google Play) and #5185 (App Store). This covers Apple and Google
only: it is not the Epic submission, and the web and installed PWA need none of it.

Each answer cites the code it was read from, as it will merge: `next` at `923107caf04` merged with the five store pull
requests it depends on, #5214 (channel, `304c091f571`), #5216 (account deletion, `9867e031c61`), #5213 (iOS shell,
`72df80b61c8`), #5215 (APNs and the iOS client, `d76fe80b3de`) and #5217 (Android shell, `440a032afa5`). Line numbers
are from that merge (10 November 2026). This document lands after them; when a cited file changes, check its answers
again. A store form that no longer matches the app is a policy violation, whichever way it is wrong.

Values only the owner has are marked `<owner fills: …>`: the reviewer account's email, the shared inbox that receives
its codes, the store contact email, and the Apple Team ID (section 1, item 5).

## 1. Fix before submitting

Each item makes a form below untrue or gets the app rejected. Items 1 to 6 block both stores unless marked.

1. **The store pull requests must be merged and deployed.** Deletion, the iOS channel, push and both shells live in
   #5214, #5216, #5213, #5215 and #5217. Deploy order:
   - D1 migrations `0033_apns_devices.sql`, `0035_account_deletions.sql` and `0036_push_revocations.sql`;
   - the identity Worker, with the APNs key (#5215's `inputs.json` fields). `pnpm run deploy:cloudflare` applies the
     migrations before it publishes the Worker (`deploy/first/publish.ts:35`);
   - the client.

   The deploy also gives chat stored before #5216 its 30 days (`deploy/first/publish.ts:53`, `keepChatRetention`). Until
   then:
   - `https://play.realms.party/account/delete` (`apps/game/src/app.tsx:94`) does not exist;
   - Settings has no Delete account (`apps/game/src/shell/profile/profile-pages.tsx:89`).

2. **The privacy policy is out of date.** `apps/game/src/shell/legal.tsx:368` names only email and Discord sign-in. It
   does not mention:
   - the Google, Apple and X sign-in the server offers (`SOCIAL_PROVIDERS`, `apps/realms/server/env.ts:144`);
   - push alerts, including Apple Push Notification service in the iOS app (section 2.1);
   - the Realms wallet and its recovery records;
   - the browser id and the last-visit time;
   - the name suggested from a sign-in provider;
   - chat's 30 days.

   Both stores compare the forms with the policy. Update it to match section 2 before submitting.

3. **Chat has no way to report a message.** Players can mute (block) another player
   (`apps/game/src/ui/features/social/realtime-chat/ui/shared/player-card.tsx:14`, `useMute`), but nothing in the chat
   client or `apps/realms/server/chat/` takes a report, and nothing filters chat. Apple guideline 1.2 and Play's
   user-generated content policy both require a way to report objectionable content and a way to act on reports.
4. **Apple: the agreed rule that LORDS are claimed on the web only is not built.** No pull request implements it. The
   iOS app shows the site's financial features as they are. The answers in sections 2 and 3 describe that current code,
   not the restricted Apple build:
   - Create my wallet (a passkey wallet) still shows (`apps/game/src/shell/profile/payout-wallet-panel.tsx:158`);
   - a season prize is still claimed in the app (`apps/game/src/shell/season-tab/season-prize.tsx:87`, `:105`);
   - Blitz entries are still paid in LORDS.

   #5214 changes only two things in the iOS app:
   - social sign-in is hidden (`apps/game/src/runtime/distribution-channel.ts:85`, used at
     `apps/game/src/shell/sign-in/connect-flow.tsx:242`);
   - linking an outside wallet is hidden (`payout-wallet-panel.tsx:162`).

   When the restriction is built:
   - audit its screens;
   - answer the gambling, contests and purchases questions and the listing copy from what the restricted app then does.
     Moving a claim to the web does not by itself make those answers No.
   - Section 3.3 lists what to re-check.

5. **iOS: nothing native is proven on a signed build.**
   - **Universal Links and passkeys:** cannot work while the association file names no app.
     `apps/game/public/.well-known/apple-app-site-association:5` (`appIDs`) and `:11` (`webcredentials.apps`) stay empty
     until the owner adds `<owner fills: Apple Team ID>`.
   - **Push** is wired:
     - the iOS client registers the phone (`apps/game/src/pwa/ios-app-push.ts:89`), revokes it on sign-out, an account
       switch or alerts turned off in iOS Settings (`:114`), and opens tapped alerts (`:128`);
     - the server makes a revocation final, so a registration still on its way is refused
       (`apps/realms/server/push-subscription-store.ts:83`);
     - the server sends through APNs (`apps/realms/server/apns-push.ts:61`).

     No TestFlight build has shown an alert yet.

   - **Haptics and the native share sheet** are wired:
     - the shell installs `@capacitor/haptics` (`apps/ios/package.json:11`), and the client taps once, lightly, when
       Herald confirms an action the player sent (`apps/game/src/hooks/use-transaction-listener.ts:117`,
       `apps/game/src/ui/motion/motion-settings.ts:33`);
     - the season's recap shares its card through iOS's share sheet, which the web view's `navigator.share` opens
       (`apps/game/src/shell/season-tab/season-recap.tsx:561`).

     No TestFlight build has shown either yet.

   The review notes (section 5.3) name none of these. Add each to them only after a signed build proves it.

6. **Error reporting is off in production, and the answers assume it.** `deploy/first/publish.ts:144` publishes the
   client with `VITE_PUBLIC_SENTRY_DSN: ""`, so no diagnostics leave the device. #5194 lists Sentry diagnostics. Declare
   them only once a DSN ships; section 2.4 lists what changes then.
7. **The app has real-value features** (`apps/game-docs/docs/pages/account/lords.mdx`, `frontier/chests.mdx`,
   `account/payout-wallet.mdx`):
   - Blitz entries are paid in LORDS, and win LORDS prizes and a chest drawn by chance;
   - Frontier chests pay LORDS at a tier rolled by chance;
   - the app creates a crypto wallet.

   The answers below declare all of it. As a result:
   - Play's Real-Money Gambling, Games and Contests policy covers an app where users pay something of value for a chance
     to win something of value. Blitz fits that description (a paid entry, chests drawn by chance), so expect Google to
     require that policy's approval before distributing it. The Blockchain-based Content policy says the same about
     chances at tokenized assets.
   - Play's Payments policy covers digital items bought inside the app without Play Billing. Blitz entries, swords,
     shields and stamina Refill are all paid in LORDS. Check that policy's blockchain exemption against these before
     submitting.
   - Apple, for the current code: Gambling sets the calculated rating to 18+ (section 3.2). Guidelines 5.3.3 and 5.3.4
     (real-money gaming) and 3.1.5 (cryptocurrencies) apply until the restriction in item 4 is built and audited.

## 2. Data collected

### 2.1 What the app collects, from the code

| Data                                                                                                              | Where it is kept (file)                                                                                                                                                                                                                                                                                                                                                                        | When                                                                                            | Required    |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------- |
| Email address                                                                                                     | `user.email`, `apps/realms/migrations/0001_identity.sql`; `sign_in_budget` (0008), `wallet_change_notices` (0009), `campaign_referrals.mailbox` (0027)                                                                                                                                                                                                                                         | Every account: sign-in codes (`apps/realms/server/auth.ts`), wallet notices, news emails (0025) | Yes         |
| Player name and portrait                                                                                          | `user.name`, `user.image` (0001), unique and public on leaderboards (`auth.ts`)                                                                                                                                                                                                                                                                                                                | The player chooses them after the first sign-in                                                 | Yes         |
| Name suggested by a sign-in provider (it can be a real name)                                                      | `user.suggestedName` (0006), from the provider's name (`assignRealmsIdentity` in `auth.ts`, `suggestedNameOf` in `packages/identity/src/account-rules.ts`)                                                                                                                                                                                                                                     | Sign-in with Discord, Google, Apple or X                                                        | No          |
| Account ids                                                                                                       | `user.id`, `user.realmsId` (0001); the provider's account id and its OAuth tokens in `account` (0001)                                                                                                                                                                                                                                                                                          | Every account; provider ids only with that provider                                             | Yes         |
| IP address and user agent                                                                                         | `session.ipAddress`, `session.userAgent` (0001, written by better-auth)                                                                                                                                                                                                                                                                                                                        | Every sign-in session                                                                           | Yes         |
| Browser id (a random UUID cookie)                                                                                 | `account_browsers` (0029), set by `apps/realms/server/browsers.ts`                                                                                                                                                                                                                                                                                                                             | Every session read; used to count one person once in referrals                                  | Yes         |
| Device key (public half)                                                                                          | `device_sessions` (0007), `revoked_devices` (0004); the private half never leaves the device (`legal.tsx`, Cookies section)                                                                                                                                                                                                                                                                    | Every device that plays                                                                         | Yes         |
| Push registration: a browser's push endpoint and keys, or the iOS app's APNs device token; the device's time zone | `notification_push_subscriptions` (0001, 0022; `apnsToken`, `apps/realms/migrations/0033_apns_devices.sql:10`), `apps/realms/server/push-subscription-store.ts`; level in `notification_preferences`                                                                                                                                                                                           | Only when the player turns alerts on                                                            | No          |
| Chat messages: rooms and direct messages                                                                          | Durable Object SQL in `apps/realms/server/chat/chat-room.ts` and `chat-inbox.ts`. Each message is deleted at 30 days (`CHAT_RETENTION_MS`, `apps/realms/server/chat/retention.ts:14`; `chat-room.ts:182`, `chat-inbox.ts:343`), by an alarm when nobody opens the room or inbox again. A message's `location` is a map tile, not where the player is (`packages/types/src/chat/world-chat.ts`) | Only when the player chats                                                                      | No          |
| Last visit time                                                                                                   | `user.lastSeenAt` (0026), written in `apps/realms/server/routes.ts`; read by the news (comeback) emails                                                                                                                                                                                                                                                                                        | Every visit by a signed-in player                                                               | Yes         |
| Gameplay                                                                                                          | Every game action is signed by the device key and sent to Realms' own Starknet appchain (`README.md`, "How it works"), from the account's game address (`realms_accounts`, 0003); Blitz build orders in `build_order_books` (0020)                                                                                                                                                             | Playing; build orders only when saved                                                           | Yes to play |
| Linked wallet addresses                                                                                           | `user.address`, `wallet_link_history` (0012)                                                                                                                                                                                                                                                                                                                                                   | Only when the player links a payout wallet or creates a Realms wallet                           | No          |
| Realms wallet (passkey-owned) and its recovery                                                                    | `default_wallets`, `sponsored_executions`, `wallet_recoveries` (0028): the address and the passkey's public key and credential id. Biometrics stay on the device.                                                                                                                                                                                                                              | Only when the player creates a Realms wallet                                                    | No          |
| Payout and payment records                                                                                        | `pay_decisions` (0014): payouts by wallet, season and amount. Blitz entries are paid on Starknet into the ledger (`README.md`; `apps/game-docs/docs/pages/blitz/entry.mdx`)                                                                                                                                                                                                                    | Only for players who pay entries or receive payouts                                             | No          |
| Campaign tickets and referrals                                                                                    | `campaign_tickets` (0021), `campaign_referrers`, `campaign_referrals` (0027)                                                                                                                                                                                                                                                                                                                   | Only when the player redeems a code or shares a referral link                                   | No          |

A push registration is deleted when its device revokes it (turning alerts off, signing out or switching accounts) and
with the account (`apps/realms/server/account-deletion.ts:116`). A revocation leaves only the registration's random id
and its time in `notification_push_revocations` (`apps/realms/migrations/0036_push_revocations.sql:4`), with no token
and no account, so a registration still on its way is refused. It goes at the first revocation a day later
(`apps/realms/server/push-subscription-store.ts:7`, `:98`).

Not collected: phone number, postal address, contacts, photos, files, precise or approximate location, health, browsing
or search history, advertising ids, and installed apps. There are no ads and no analytics SDK: the only reporting SDK,
`@sentry/react` in `apps/game/package.json`, is off in production (item 6 of section 1).

Others that receive data to run the service, and are therefore service providers, not sharing: Cloudflare (hosting and
the database, `apps/realms/wrangler.jsonc`), Resend (email, `apps/realms/server/sign-in-codes.ts`), the browser's push
service (`apps/realms/server/web-push.ts`), Apple Push Notification service for the iOS app
(`apps/realms/server/apns-push.ts:61`: the alert's title and body and its envelope, holding the account id, device id,
target, tag and times, which Apple reads over TLS where Web Push encrypts its payload for the device), the chosen
sign-in provider, and the Starknet RPC provider and paymaster (`apps/realms/README.md`,
`apps/realms/server/paymaster.ts`). Player names, chat messages and onchain actions are visible to other players because
the player publishes them.

### 2.2 Google Play: Data safety

Opening questions:

- Does your app collect or share any of the required user data types? **Yes.**
- Is all of the user data collected by your app encrypted in transit? **Yes.** The site and every API are served over
  HTTPS only; cookies are `Secure` (`apps/realms/server/browsers.ts`).
- Do you provide a way for users to request that their data is deleted? **Yes:** in the app, Settings, Delete account
  (`apps/game/src/shell/profile/profile-pages.tsx:89`), and on the web at `https://play.realms.party/account/delete`
  (`apps/game/src/app.tsx:94`). What deletion removes and keeps is the table at
  `apps/realms/server/account-deletion.ts:25`, above the handler at `:53` (#5216; item 1 of section 1).

For every type below: **Shared: No** (section 2.1 lists the service providers and the data players publish themselves)
and **Processed ephemerally: No**.

| Category            | Data type                    | Collected | Required or optional | Purposes                                                                                                                             | Source in section 2.1                                                                |
| ------------------- | ---------------------------- | --------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Personal info       | Name                         | Yes       | Required             | App functionality, Account management                                                                                                | Player name; provider name suggestion                                                |
| Personal info       | Email address                | Yes       | Required             | App functionality, Account management, Developer communications, Advertising or marketing, Fraud prevention, security and compliance | Email address (news emails are marketing; referrals use it to count one person once) |
| Personal info       | User IDs                     | Yes       | Required             | App functionality, Account management                                                                                                | Account ids; provider account ids                                                    |
| Financial info      | Purchase history             | Yes       | Optional             | App functionality                                                                                                                    | Blitz entries; payout records                                                        |
| Financial info      | Other financial info         | Yes       | Optional             | App functionality, Account management                                                                                                | Linked wallet addresses; Realms wallet                                               |
| Messages            | Other in-app messages        | Yes       | Optional             | App functionality                                                                                                                    | Chat messages                                                                        |
| App activity        | App interactions             | Yes       | Required             | App functionality, Developer communications, Advertising or marketing                                                                | Last visit time (it picks who gets a news email)                                     |
| App activity        | Other user-generated content | Yes       | Optional             | App functionality                                                                                                                    | Build orders                                                                         |
| App activity        | Other actions                | Yes       | Required             | App functionality                                                                                                                    | Gameplay                                                                             |
| Device or other IDs | Device or other IDs          | Yes       | Required             | App functionality, Fraud prevention, security and compliance, Account management                                                     | Device key; browser id; push subscription; IP address and user agent                 |

Answer **No** to every other type: Location (the app derives no location from the IP address, and a time zone is not a
location), Health and fitness, Photos and videos, Audio, Files and docs, Calendar, Contacts, Web browsing, App info and
performance (item 6 of section 1), Emails, SMS, and the remaining Personal info and Financial info types.

### 2.3 App Store: privacy nutrition label

- Do you or your third-party partners collect data from this app? **Yes.**
- Tracking: **No** for every type. Nothing is combined with other companies' data for advertising, and nothing goes to
  data brokers, so the app needs no App Tracking Transparency prompt.
- Linked to the user: **Yes** for every type. Everything is stored against the account.

| Category       | Data type               | Purposes                                                | Source in section 2.1                                    |
| -------------- | ----------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Contact Info   | Name                    | App Functionality                                       | Name suggested by a sign-in provider                     |
| Contact Info   | Email Address           | App Functionality, Developer's Advertising or Marketing | Email address (sign-in codes; news emails)               |
| Financial Info | Other Financial Info    | App Functionality                                       | Linked wallet addresses; Realms wallet; payout records   |
| User Content   | Emails or Text Messages | App Functionality                                       | Chat messages (they carry sender, recipient and content) |
| User Content   | Gameplay Content        | App Functionality                                       | Gameplay; build orders                                   |
| Identifiers    | User ID                 | App Functionality                                       | Player name; account ids; provider account ids           |
| Identifiers    | Device ID               | App Functionality                                       | Device key; browser id; push token                       |
| Purchases      | Purchase History        | App Functionality                                       | Blitz entries                                            |
| Usage Data     | Product Interaction     | App Functionality, Developer's Advertising or Marketing | Last visit time                                          |
| Other Data     | Other Data Types        | App Functionality                                       | IP address and user agent kept with each session         |

Not collected: Health and Fitness, Location, Sensitive Info, Contacts, Photos or Videos, Audio, Customer Support,
Browsing History, Search History, Advertising Data, Diagnostics (item 6 of section 1), Surroundings and Body. Apple's
App Functionality purpose covers fraud prevention and security, so the referral and device checks need no other purpose.
On iOS, sign-in is by email code only (`apps/game/src/runtime/distribution-channel.ts:85`, #5214), so no provider name
is collected there. The label keeps Name anyway: the account is the same one the web and Android apps write to, and
declaring too much is safe where declaring too little is not.

Export compliance (#5206): the app uses encryption only through the system's HTTPS and passkey APIs, which is exempt.
Answer **No** to non-exempt encryption (`ITSAppUsesNonExemptEncryption` = `false`).

### 2.4 When error reporting is turned on

Setting `VITE_PUBLIC_SENTRY_DSN` in `deploy/first/publish.ts` starts Sentry with the options in
`apps/game/src/sentry-config.ts` and `apps/game/src/main.tsx`. Unless `VITE_PUBLIC_SENTRY_*` overrides them, those
options are: `sendDefaultPii` on (the IP address), traces on every session (`tracesSampleRate` 1), Session Replay on 10%
of sessions and on every session with an error, and the user set to a hash of the wallet address
(`apps/game/src/observability/sentry-user-sync.tsx`, `wallet-identity.ts`). Before shipping a DSN:

- Add a privacy policy section on error reports. `publish.ts` requires it in its comment beside the DSN.
- Play: add App info and performance (Crash logs, Diagnostics, Other app performance data) and App interactions, all for
  Analytics, and Shared: No (Sentry is a service provider).
- Apple: add Diagnostics (Crash Data, Performance Data, Other Diagnostic Data) and Usage Data (Product Interaction), for
  Analytics, Linked to the user. Tracking stays **No**.
- Or turn replay off and `sendDefaultPii` off through their `VITE_PUBLIC_SENTRY_*` values, and declare only the
  Diagnostics types.

## 3. Content and age ratings

### 3.1 Google Play: IARC questionnaire

Category: **Game**. The IARC wording changes from time to time; the answers are grouped by topic.

| Topic                                          | Answer                      | Why                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Violence                                       | Yes: fantasy, not realistic | Armies of knights fight Trolls, rifts, ruins and beasts (Frontier), and other players' armies (Blitz), as small figures on a strategy map. Fights resolve with no blood or gore (`apps/game-docs/docs/pages/frontier/index.mdx`, `blitz/armies.mdx`).                                                                                                            |
| Weapons                                        | Medieval only               | Swords, crossbows and the like carried by troops. There are no guns.                                                                                                                                                                                                                                                                                             |
| Fear or horror                                 | No                          | Fantasy creatures guard sites; there is no horror theme or startling content.                                                                                                                                                                                                                                                                                    |
| Sexuality or nudity                            | No                          |                                                                                                                                                                                                                                                                                                                                                                  |
| Language (in the app's own content)            | No                          | Players' chat is covered by user interaction below.                                                                                                                                                                                                                                                                                                              |
| Controlled substances                          | No                          |                                                                                                                                                                                                                                                                                                                                                                  |
| Crude humour                                   | No                          |                                                                                                                                                                                                                                                                                                                                                                  |
| Gambling                                       | Yes: real money             | Blitz entries are paid in LORDS, a cryptocurrency. Every finished game gives each player a chest that pays LORDS or an entry credit, drawn by chance, and the season's best players win LORDS (`apps/game-docs/docs/pages/account/lords.mdx`, `blitz/entry.mdx`). Frontier is free, but its chests pay LORDS at a tier rolled by chance (`frontier/chests.mdx`). |
| Users interact or communicate                  | Yes                         | Global chat, a chat per game and per lobby, and direct messages (`apps/realms/server/chat/rooms.ts`). Players can mute other players; they cannot report messages yet (item 3 of section 1).                                                                                                                                                                     |
| Shares the user's physical location            | No                          | A chat message's location is a map tile (`packages/types/src/chat/world-chat.ts`).                                                                                                                                                                                                                                                                               |
| Digital purchases                              | Yes                         | Blitz entries, swords, shields and stamina Refill, paid in LORDS from the player's wallet. There is no Play Billing purchase.                                                                                                                                                                                                                                    |
| Unrestricted internet access                   | No                          | The app opens only play.realms.party; outside links leave the app.                                                                                                                                                                                                                                                                                               |
| Shares personal information with third parties | No                          | Section 2.2.                                                                                                                                                                                                                                                                                                                                                     |

The real-money gambling answer sets the rating to adults only in most regions. That matches the Terms, which already
require players to be 18 (`apps/game/src/shell/legal.tsx`, Eligibility).

### 3.2 App Store: age rating questionnaire (2025)

| Section                 | Item                                             | Answer   | Why                                                                                                                |
| ----------------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------ |
| In-App Controls         | Parental Controls                                | No       | The app has none.                                                                                                  |
| In-App Controls         | Age Assurance                                    | No       | The Terms state the age; the app does not check it.                                                                |
| Capabilities            | Unrestricted Web Access                          | No       | The shell loads play.realms.party only; outside links open in Safari (#5201).                                      |
| Capabilities            | User-Generated Content                           | Yes      | Chat messages and public player names.                                                                             |
| Capabilities            | Messaging and Chat                               | Yes      | Global, game and lobby rooms, and direct messages.                                                                 |
| Capabilities            | Social Media                                     | No       | No feed, follows or posts: players chat and visit realms from a game's board.                                      |
| Capabilities            | Advertising                                      | No       | No ads.                                                                                                            |
| Mature Themes           | Profanity or Crude Humor                         | None     | None in the app's own text; chat is covered by User-Generated Content.                                             |
| Mature Themes           | Horror/Fear Themes                               | None     |                                                                                                                    |
| Mature Themes           | Alcohol, Tobacco, or Drug Use or References      | None     |                                                                                                                    |
| Medical or Wellness     | Medical or Treatment Information                 | None     |                                                                                                                    |
| Medical or Wellness     | Health or Wellness Topics                        | None     |                                                                                                                    |
| Sexuality or Nudity     | All three items                                  | None     |                                                                                                                    |
| Violence                | Cartoon or Fantasy Violence                      | Frequent | Every day's play is armies fighting fantasy guards and other armies.                                               |
| Violence                | Realistic Violence                               | None     | Map-scale figures, no blood.                                                                                       |
| Violence                | Prolonged Graphic or Sadistic Realistic Violence | None     |                                                                                                                    |
| Violence                | Guns or Other Weapons                            | Frequent | Every army carries medieval weapons. There are no guns.                                                            |
| Chance-Based Activities | Gambling                                         | Yes      | Blitz: a paid entry in LORDS, which can be exchanged for money, for LORDS prizes and chests drawn by chance.       |
| Chance-Based Activities | Simulated Gambling                               | None     |                                                                                                                    |
| Chance-Based Activities | Contests                                         | Frequent | Ranked Blitz games and season leaderboards that pay their top places (`blitz/scoring.mdx`, `frontier/chests.mdx`). |
| Chance-Based Activities | Loot Boxes                                       | No       | No chest is sold: Frontier chests are found or won by a clear, and Blitz chests come with a finished game.         |

Made for Kids: **No**. For the current code the calculated rating is **18+**, set by Gambling. Submit **18+** in any
case: the Terms require players to be 18 (`apps/game/src/shell/legal.tsx:141`), and Apple asks for an app whose terms
require a higher age than the questionnaire gives to set that higher rating
([Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)).
Keep the two apart: the calculated rating is what the content answers give; the submitted rating is the contractual
minimum, and it stays 18+ unless the Terms change.

### 3.3 After the Apple restriction is built

The agreed Apple rule, LORDS claimed on the web only (item 4 of section 1), is not built, and nothing here assumes what
it will hide. Once it is, audit the restricted iOS app's screens and answer again from what they do:

- Gambling and Contests (section 3.2), and Play's financial features if the Android app changes too (section 4): a claim
  moved to the web is not by itself a No; what the app still offers decides.
- Purchases and Financial Info in the privacy label (section 2.3): drop a type only if the app no longer collects it.
- The listing copy (section 6): Apple's description must not name what the app no longer has, and must still say which
  features need a payment (guideline 2.3.2).
- The age rating: whatever the questionnaire then calculates, the submitted rating stays 18+ while the Terms require 18
  (section 3.2).

## 4. Google Play: other declarations (#5194)

| Declaration                 | Answer                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy              | `https://play.realms.party/privacy` (served by `apps/game/public/_redirects`; text in `apps/game/src/shell/legal.tsx`; item 2 of section 1)                         |
| Ads                         | **No, my app does not contain ads.** There is no ad SDK (`apps/game/package.json`).                                                                                 |
| App access                  | **All or some functionality is restricted.** Instructions in section 5.                                                                                             |
| Target audience and content | **18 and over** only. The Terms require it (`legal.tsx`, Eligibility). The app is not designed for children.                                                        |
| Account deletion            | Accounts are created in the app: **Yes**. URL: `https://play.realms.party/account/delete` (`apps/game/src/app.tsx:94`, #5216).                                      |
| Data safety                 | Section 2.2.                                                                                                                                                        |
| Content rating              | Section 3.1.                                                                                                                                                        |
| Government, news, health    | **No** to each.                                                                                                                                                     |
| Financial features          | Select **Cryptocurrency wallet** and **Tokenized digital asset (NFT) sales, trading, and awards**. Do not select the others, including **Cryptocurrency exchange**. |

Why those two financial features:

- **Cryptocurrency wallet.** The app creates a Realms wallet: a Starknet account owned by a passkey on the player's
  device, which holds LORDS and sends them to any address (`apps/game-docs/docs/pages/account/payout-wallet.mdx`; the
  `defaultWallet` plugin in `apps/realms/server/auth.ts`). Players can also link a Ready, Braavos or Controller wallet.
  The wallet is non-custodial: Realms co-signs as guardian but cannot move funds alone.
- **Tokenized digital asset awards.** Frontier chests and season prizes pay LORDS, a token on Starknet. Blitz prizes and
  chests pay LORDS too (`account/lords.mdx`). A Realm NFT the player's wallet holds can found their Frontier home
  (`frontier/index.mdx`).
- **Not an exchange.** The app buys, sells and swaps no tokens. Its one swap is a link out to AVNU
  (`apps/game/src/shell/value/no-strk-line.tsx`). The marketplace is realms.world, which opens in a new tab
  (`apps/game/src/shell/profile/profile-pages.tsx`). The in-game bank (`apps/game/src/ui/features/economy/banking`)
  trades game resources.
- **No NFT sales in the app.** The app sells no NFT and no randomised item.

If the form asks about the Blockchain-based Content policy, the answers follow from the above. The app lets users earn
tokenized digital assets (LORDS). Users pay value for a chance at them in Blitz (item 7 of section 1). The listing does
not promote earnings (section 6). The app does not mine cryptocurrency.

## 5. Reviewer sign-in and review notes (#5189)

### 5.1 Before each submission (the owner)

- The reviewer account is `<owner fills: reviewer account email>`. Its codes arrive in
  `<owner fills: shared inbox address, and how the reviewer opens it>`.
- The account has claimed its name, so the reviewer is not asked to choose one
  (`apps/game-docs/docs/pages/account/sign-in.mdx`), and it has a Frontier realm in the live season.
- The account is on fewer than 8 devices. Every reviewer device counts, and a ninth is refused (`account/sign-in.mdx`,
  Devices). Remove old ones from **Settings**, **Devices**.
- Production auth has no bypass code (#5189). Reviewers sign in exactly as players do.

### 5.2 Sign-in instructions (paste into both stores)

Play Console, App access: put the account email in "Username", leave "Password" empty, and paste the text below into
"Any other information". App Store Connect, App Review Information: tick "Sign-in required", put the email in "User
name", write `none: a code is sent by email` in "Password", and paste the text into "Notes".

```text
Realms signs in with a 6-digit code sent by email. There is no password.

Account: <owner fills: reviewer account email>
Inbox for its codes: <owner fills: shared inbox address, and how the reviewer opens it>

1. Open the app. On the home page, press Connect (or Play free).
2. Type the account email and press Send code. Use the email option, not Discord, Google, Apple, X or a wallet.
3. Open the inbox above. The newest email from Realms holds the code. It expires after 10 minutes, and each code allows 3 tries. If it expires, press New code. You can request at most 3 codes a minute.
4. Type the 6 digits. You are signed in on the sixth digit and stay signed in for 30 days.
5. On the home page, press Resume on the Frontier card. The map opens around the account's realm.

Things to try: pick an army, tap a tile beside it to explore, open a site's card and attack it, and open the realm. The game may offer to turn on alerts or to create a wallet; neither is needed to play.
How to play: https://docs.realms.party/frontier/
```

The labels come from `apps/game/src/ui/design-system/kit/words.ts` (`connect`, `playFree`, `sendCode`, `newCode`,
`resume`). The limits come from `packages/identity/src/account-rules.ts` (`SIGN_IN_CODE_SECONDS`, `SESSION_SECONDS`),
`auth.ts` (`allowedAttempts: 3`) and `apps/realms/wrangler.jsonc` (`SIGN_IN_CODE_RATE_LIMIT`: 3 a minute per email).

### 5.3 Review notes

App Store (Notes, after the sign-in text). It names no native feature: none is proven on a signed build yet (item 5 of
section 1).

```text
Realms is a strategy game. The app is its client: it plays the game at play.realms.party, the same account and game on the web, Android and iPhone. Each day a new map opens around the player's realm; armies explore it, fight its guards and bring home what they find.

Sign-in is by email code only. The app uses only the system's HTTPS and passkey encryption. Players must be 18 or older (https://play.realms.party/terms). Privacy: https://play.realms.party/privacy. Players delete their account in Settings, or at https://play.realms.party/account/delete.
```

Add a sentence to the App Store notes for each of these only once a signed TestFlight build shows it working:

- Push alerts through Apple Push Notification service: a new game day, a rested army, a fight, a chat message
  (`apps/game/src/pwa/ios-app-push.ts`). Check an alert arrives, a tap from the background and from a cold start opens
  its game or chat, and signing out stops them.
- Universal Links, so a play.realms.party link opens the game in the app, and passkeys shared with the site: only after
  the Team ID is in the association file (item 5 of section 1).

The app has no haptics of its own and no native share sheet (item 5 of section 1); do not name them.

Google Play (App access, "Any other information", after the sign-in text):

```text
The app is a Trusted Web Activity for play.realms.party: the same account and game as the website. Alerts arrive as Chrome notifications. Players must be 18 or older (https://play.realms.party/terms).
```

## 6. Listing copy (#5195, #5207)

The copy comes from the game as players see it (`README.md`, `apps/game-docs/docs/pages/index.mdx`,
`frontier/index.mdx`, `account/sign-in.mdx`). It names no tokens, prizes, NFTs or earnings, and promises no money.
Blitz's paid entry is stated, because Apple guideline 2.3.2 requires a description to say which features need a payment.
Character counts are in brackets; the limits are in each heading.

### Name (App Store 30, Play title 30)

Realms: Fantasy Strategy [24]

### App Store subtitle (30)

A new map to conquer every day [30]

### Play short description (80)

Send your armies into a new fantasy map every day and grow a realm that lasts. [78]

### App Store promotional text (170)

A fresh map opens around your realm every day. Send your armies into the fog, clear what guards it, and raise your
castle higher. [129]

### App Store keywords (100, comma-separated, no words from the name)

kingdom,castle,army,explore,medieval,conquest,4x,rts,knights,empire,war,map,daily,multiplayer,build [99]

### Category

App Store: Games, subcategory Strategy. Play: Games, Strategy.

### Full description (both stores, 4,000)

```text
Realms is a fantasy strategy game. Build a realm, raise its armies and send them into the unknown.

FRONTIER: A NEW MAP EVERY DAY
Every day a new map opens around your realm, hidden in fog. Deploy your knights and walk them into the dark. What a tile holds is decided only when your army reveals it, so nobody can scout ahead. Trolls, rifts, ruins and beasts guard the land, and each shows its guard before you attack. No dice are rolled: a fight's forecast is its result, so you win by choosing your fights.

When the day ends, the map and every army on it are gone. Your realm rises again on the next map with everything it holds: its buildings, castle, research, troops and stores.

Frontier is free to play, and no other player can attack you.

GROW YOUR REALM
- Build farms, barracks, workshops and workers' huts, and raise your castle tier by tier.
- Research every building up to Legendary, then shrines, wells and the three Ethereal depths.
- Field more armies as your castle rises. Level them up and spend skill points on Battle, Logistics, Scouting, Homecoming or Stamina.
- Visit other players' realms from the Season board and see how they built.

BLITZ: 60 MINUTES, UP TO 24 PLAYERS
A fast match against other players on one shared map. Explore, take camps, rifts and Hyperstructures, and hold them to score. Blitz games have a paid entry.

ONE ACCOUNT, EVERY SCREEN
Sign in with a code sent to your email; there is no password to remember. The same account and game play on your phone, your tablet and on the web at play.realms.party.

CHAT
Talk with every player in Global chat, with your game's players, and in direct messages. Mute anyone with one tap.

Realms is open source, made by BibliothecaDAO and its community. Guides for every game are at docs.realms.party. You must be 18 or older to play.
```

[1,816]

Sources for the copy: Blitz's length and size from `README.md` and `apps/game-docs/docs/utils/blitz.ts`; muting from
`player-card.tsx:14`; the age from `legal.tsx:141`. On iOS, sign-in is by email only
(`apps/game/src/runtime/distribution-channel.ts:85`), which the copy already says. Android also offers Discord, Google,
Apple and X; the copy does not list them, so it is true on both.

The copy names no alerts: the iOS app's push is not proven on a signed build (item 5 of section 1). Play's description
may add "Turn on alerts to know when a new day opens and when someone mentions you in chat." The Android app delivers
them as Chrome notifications (`apps/android/README.md:120`; kinds in `packages/notifications/src/notification-kinds.ts`,
mentions in `apps/realms/server/chat/mention-push.ts`). Re-check the Apple description after the restriction in item 4
of section 1, since its Blitz line names a paid entry.

### Store links

- Privacy policy: `https://play.realms.party/privacy`
- Terms: `https://play.realms.party/terms`
- Support and marketing URL: `https://docs.realms.party`
- Account deletion: `https://play.realms.party/account/delete` (`apps/game/src/app.tsx:94`, #5216)
- Play contact email: `<owner fills: store contact email>`, an address the owner reads. The code's only address is
  `ops@realms.party`, the push contact in `apps/realms/server/env.ts` (`vapidKeysOf`).

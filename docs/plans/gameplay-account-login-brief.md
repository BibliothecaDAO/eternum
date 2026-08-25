# Gameplay account and website login — brief

Branch: `feat/madara-lab`. Replaces the **Accounts** bullet of item C2 in `madara-lab-codex-brief.md`. Direction:
`docs/reports/eternum-game-stack-direction-2026-08-21.html` §03 "Accounts — own gameplay authority".

## Decision

Two accounts, two jobs, never mixed:

|         | Identity wallet                                                   | Gameplay account                                                                                              |
| ------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| What    | The player's Starknet mainnet wallet (Ready/Argent, Braavos, …)   | A plain OpenZeppelin account on the game chain                                                                |
| Signs   | Nothing in this brief (one SNIP-12 binding message in stage 2)    | Every game transaction                                                                                        |
| Lives   | In the wallet extension; `@starknet-react/core` on `SN_MAIN` only | Key generated in the browser, stored per `(chain, owner)`, deployed with `deploy_account` on a fee-free chain |
| Purpose | Who you are, where value goes (stage 2)                           | Authority to play, nothing else                                                                               |

No Cartridge Controller, no session policies, no paymaster, no `dev_predeployedAccounts`. The client's Starknet-react
layer becomes identity-only; the game chain is reached with a `starknet.js` `Account` and the existing
`EternumProvider`, which already takes any `AccountInterface` (`packages/provider/src/transaction-executor.ts:11`).

## Established facts (verified 2026-08-25)

- **Contracts identify the player by caller only.** Registrar
  `contracts/game/src/systems/registrar/contracts.cairo:120,180`, Blitz `register` `realm/blitz/contracts.cairo:82`,
  `settle` `:102`. Prizes are ERC20 `transfer`s on the game chain to `registered_player`
  (`prize_distribution/contracts.cairo:174,249`); the entry fee is `transfer_from(owner, …)` on the game-chain fee token
  (`realm/blitz/contracts.cairo:296-299`). A gameplay account is a complete player: **no contract change in this
  brief.**
- **Both chains are fee-free.** Katana AWS: `no_fee = true` (`deploy/appchain/config/katana.toml:11`). Madara lab:
  `--no-charge-fee`. `deploy_account` needs no funding and gameplay never needs a paymaster.
- **Account classes.** Madara lab devnet OZ account class
  `0xe2eb8f5672af4e6a4e8a8f1b44989685e668489b0a25437733756c5a34a1d6` (ABI has `get_public_key`, `set_public_key`,
  `__validate_deploy__`, `is_valid_signature` — `starknet_getClass`). Katana AWS: `.env.appchain.blitz` sets
  `VITE_PUBLIC_ACCOUNT_CLASS_HASH=0x07dc78…` but `starknet_getClass` on `katana.jcndata.com` answers
  `Class hash not found` — a dead value nothing deploys with; the dev accounts there use class
  `0x5e1c8befefc43017195b550332ba536ca4571a1a108e1c0b4a2f746913d40`.
- **Cartridge surface in the client** (`client/apps/game/src`): `@cartridge/*` is imported by 7 files —
  `hooks/context/{policies,starknet-provider,transaction-submit-guard,use-controller-account}.ts(x)`,
  `hooks/store/use-account-store.ts`, `hooks/{use-cartridge-username.tsx,use-username.ts}`. Controller-only mechanics:
  `session-policy-refresh(.ts,-state.ts)` (iframe rotation), `controller-connect.ts` (170 lines of probe/retry/timeout),
  `signing-policy.ts`, `paymasterRpcProvider` (`starknet-provider.tsx:196-203`), `usePredeployedAccounts` (`:153`),
  `ui/modules/controller/controller.tsx` (login button that opens the Cartridge inventory).
- **Names.** `settle(game_id, name, …)` takes the display name and writes `AddressName`; the Controller username was
  only the default the client typed in. Nothing on-chain depends on Cartridge for names.
- **Master account** (`VITE_PUBLIC_MASTER_*`): required by `hooks/context/dojo-context.tsx:18-28`, the landing fallback
  signer (`landing-dojo-provider.tsx:120`), and the dev fee-token top-up (`hooks/use-world-registration.ts:149`). It is
  a dev faucet; it stays, unchanged, on dev chains.
- **`useAccount()` from starknet-react is read in 17 files.** Today it is the game signer; after this brief it is the
  identity wallet. Every consumer is reclassified (rule below).
- **Katana AWS runs `--cartridge.controllers --paymaster --cartridge.paymaster`**
  (`deploy/appchain/cdk/lib/dev-stack.ts:164`). Unused once this lands; Cartridge is EOL.

## Design

### Identity wallet (website login)

- `StarknetProvider` serves `chains={[mainnet]}` with `useInjectedConnectors({ recommended: [argent(), braavos()] })`
  from `@starknet-react/core` (already a dependency; Ready is the `argentX` connector id). No chain switching, no
  Controller connector, no paymaster provider, no predeployed connector.
- The landing **Login** button connects the identity wallet. `useAccount()` is identity: address, connection state, and
  the display name through `useStarkProfile` (starknet.id) — used by the profile, avatar, mainnet balances
  (`wallet-section.tsx` already reads mainnet), and as the default settle name.
- Nothing on the game chain is signed by it in this brief.

### Gameplay account

- One pure module, shared with the C3 harness: `packages/core/src/account/gameplay-account.ts` (starknet.js only, no
  React):
  - `deriveGameplayAccount({ privateKey, classHash })` → `{ address, publicKey }` via
    `hash.calculateContractAddressFromHash(publicKey, classHash, [publicKey], 0)`.
  - `ensureGameplayAccountDeployed(provider, account)` → `getClassHashAt(address)`; on `ContractNotFound` send
    `deployAccount({ classHash, constructorCalldata: [publicKey], addressSalt: publicKey })` and wait for the receipt.
  - `createGameplayAccount(rpcUrl, privateKey, classHash)` → `Account`.
- Client wrapper `client/apps/game/src/runtime/account/gameplay-account-store.ts`: the key store. One record per
  `(chainId, owner)` in `localStorage` under `realms.gameplay-key.<chainId>.<owner>`; `owner` is the identity address or
  `0x0` for guest. Missing record → generate (`ec.starkCurve.utils.randomPrivateKey()`) and save. No TTL: the account is
  meant to persist.
- `useAccountStore`: keeps `account` (now always the gameplay `Account`) and `accountName`; gains `owner`; the
  `connector: ControllerConnector` field is deleted. It is written from exactly one place, `GameplayAccountSync`
  (replaces `StarknetAccountSync` + `useControllerAccount`): on `(runtime chain, identity address)` change it resolves
  the record, ensures deployment, and calls `setAccount`.
- Account class hash per chain lives in the world profile (`accountClassHash`), next to `rpcUrl`. Boot verifies it with
  `starknet_getClass` and throws in dev when it misses — the current dead env value is exactly the silent default
  guardrail 4 forbids. `VITE_PUBLIC_ACCOUNT_CLASS_HASH` goes away with it.
- Guest play: `owner = 0x0` is allowed on `local` and `madara` (harness, Playwright, dev without an extension) and
  refused on `appchain`. `requiresIdentity(chain)` is the single rule; the sign-in modal reads it.

### Reclassification rule for `useAccount()` consumers

Anything that **signs or reads game ownership** (structures, armies, registration, prize claims, spectator auto-flip)
uses `useAccountStore.account.address`. Anything that **shows who the player is** (profile, avatar, balances, name
default) uses the identity wallet. A consumer that needs both takes both explicitly; none derives one from the other.

### Binding and rotation — without settlement

`account-portal` already runs Sign-In-With-Starknet on better-auth
(`apps/account-portal/src/utils/auth/auth-siws-plugin.ts`: nonce → wallet signs SNIP-12 → server verifies with
`verifyMessageInStarknet` against a mainnet RPC → session cookie). That is the off-chain proof binding needs. Everything
else is on the game chain:

- **`contracts/player-account/`** (pure Cairo, no Dojo): `RealmsPlayerAccount` = OpenZeppelin `AccountComponent` +
  `owner: ContractAddress` set in the constructor and never changed + `rotate_public_key(new_key)` callable only by the
  `binding_authority` address given at construction. `PlayerRegistry`: `bind(owner, account)` by the authority only, one
  account per owner forever, `account_of(owner)`, `owner_of(account)`.
- **Two server functions in the web app** (session = verified owner): `bind(gameplayAddress, publicKey)` — checks on the
  game chain that the class is `RealmsPlayerAccount` and `owner() == session owner`, then `registry.bind`; a second
  account for the same owner is refused. `rotate(publicKey)` — `registry.account_of(owner)` → `rotate_public_key` with
  the authority key.
- **Client flow.** Play: wallet connect → SIWS session → local key → deploy `RealmsPlayerAccount(owner, key, authority)`
  → `bind`. Recovery on a fresh browser: session → registry has an account → no local key → generate → `rotate` → same
  gameplay address, same in-game position. Guest (`owner = 0x0`) skips bind and is unrecoverable by design.
- **Trust.** The authority key can rotate any player's gameplay key, so the operator can play as anyone; it cannot move
  value — `owner` is immutable and payouts (when they move to mainnet) go to `owner_of(account)`. That is the trust
  already placed in whoever runs the sequencer. Log every rotation.
- **Cost.** One Cairo package (~150 lines + tests, written with the `cairo-contract` TDD skill), two server functions
  (~100 lines), the constructor calldata of `gameplay-account.ts` becomes `(owner, publicKey, authority)`, and the lab
  compose gains a `postgres` service under a `web` profile because the session store needs it. Removes the "clearing
  browser storage loses the account" caveat and the whole stage-2 placeholder. Settlement is not involved.

## Work split

### Codex

**L1 — identity provider and Cartridge removal.** Rewrite `hooks/context/starknet-provider.tsx` to the identity design.
Delete: `policies.ts`, `signing-policy.ts`, `session-policy-refresh.ts`, `session-policy-refresh-state.ts`,
`transaction-submit-guard.ts` (and its call site in the provider/system-call config), `controller-connect.ts`,
`use-controller-account.ts`, `use-cartridge-username.tsx`, `use-username.ts`, `ui/modules/controller/controller.tsx`,
`starknet-chain-config.ts`'s `controllerSupportedRpcUrls`/Cartridge RPC builders. Add
`ui/modules/wallet/wallet-button.tsx` (connect / show name / disconnect) and `hooks/use-identity-name.ts`
(`useStarkProfile` → settle-name default). Reclassify the 17 `useAccount()` consumers by the rule above. Rewrite
`sign-in-prompt-modal.tsx` copy. Remove `@cartridge/connector`, `@cartridge/controller`,
`@dojoengine/predeployed-connector` from `client/apps/game/package.json` and the catalog; remove
`VITE_PUBLIC_CARTRIDGE_API_BASE` from `env.ts`.

**L2 — gameplay account.** `packages/core/src/account/gameplay-account.ts` + tests (derivation is deterministic and
matches `starknet.js` `calculateContractAddressFromHash`; deploy is sent once and skipped when the class is present;
records are isolated per `(chainId, owner)`; guest key is stable across reloads).
`runtime/account/gameplay-account-store.ts`, `GameplayAccountSync`, `useAccountStore` change, `accountClassHash` in the
world profile with the boot check.

**L2b — player account contracts.** `contracts/player-account/` with `scarb fmt` and tests: owner immutable, rotation
only by authority, registry one-per-owner. Publish the class hash into the world profile.

**L2c — bind/rotate server functions** in the web app (see `realms-monorepo-consolidation-brief.md`; until that lands,
in `apps/account-portal` upstream), authenticated by the SIWS session; integration test against the lab chain.

**L3 — chain target.** The rest of C2 as written: `madara` in `VITE_PUBLIC_CHAIN`, `.env.madara.blitz.sample` (no
`cartridge.gg` host, `VITE_PUBLIC_MASTER_*` = devnet account #1), world-directory entry from `manifest_madara.json`,
loud Torii/RPC fallbacks.

### Claude

- Prove `deploy_account` on both chains before L2 starts: a bun probe in `deploy/madara-lab/scripts/` that derives,
  deploys and calls `get_public_key` for a fresh key on the lab (stock OZ class `0xe2eb…` until L2b declares
  `RealmsPlayerAccount`) and on Katana AWS. If Katana refuses deploy_account fee-free, declare the class there and note
  it in `deploy/appchain`.
- Declare `RealmsPlayerAccount` + `PlayerRegistry` on the lab and on Katana AWS; hold the authority key in the lab
  `.env` (devnet account #2) and document it in the runbook.
- Drop `--cartridge.controllers --paymaster --cartridge.paymaster` from the Katana AWS command at the next deploy and
  remove `VITE_PUBLIC_ACCOUNT_CLASS_HASH` from `.env.appchain.blitz`.
- Make the C3 harness use `packages/core` `gameplay-account` for its 96 accounts instead of a second key path.
- Integration gate below.

## Cost

Removed: 11 client files (≈900 lines of Controller/session/paymaster mechanics), three dependencies, one env value, the
Katana Cartridge flags. Added: `gameplay-account.ts` (≈100 lines, shared), key store + sync (≈80), wallet button and
identity-name hook (≈120). Net deletion; the only new state is one localStorage record per `(chain, owner)`.

## Gates

1. `packages/core` tests for the account module; `pnpm typecheck`; `pnpm run format`; `pnpm run knip` (must report the
   removed packages as gone, not as unused).
2. Lab: `.env.madara.blitz` → landing → connect Braavos or Ready on mainnet (identity) → Play. `starknet_getClassHashAt`
   on the gameplay address returns the OZ class within one block; create game / register / settle / move an army; every
   `starknet_getTransactionByHash(...).sender_address` is the gameplay account; `AddressName` shows the name entered at
   settle. Reload keeps the same gameplay address; a second identity wallet gets a different one; guest gets a third.
3. Katana AWS: same flow on `.env.appchain.blitz`; no request to `api.cartridge.gg` in the network log.
4. Spectator: `?spectate=true` with a connected identity and no gameplay account shows no ownership chrome
   (`utils/spectator-session.ts` stays the source of truth).

## Decisions taken in this brief

- **Legacy S1 worlds (`mainnet`, `sepolia`) are deleted from this client** — chain kinds, world-directory entries, the
  Cartridge RPC builders and the `s1_eternum` signing domain go with the Controller. Owner-confirmed 2026-08-25.
- **Guest play only on `local`/`madara`.** Production entry requires an identity so the registry has an owner to bind.
- **Binding ships with the login, not after settlement.** The portal's SIWS is the verifier; the registry is the truth.

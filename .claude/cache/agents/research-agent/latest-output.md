# Research Report: Cartridge Controller Node.js Session Authentication Flow

Generated: 2026-02-07

## Executive Summary

The Cartridge Controller Node.js example implements a **session-based authentication flow** for StarkNet gaming wallets.
The agent (Node.js process) generates a local keypair, launches a local HTTP callback server, opens a browser URL to the
Cartridge keychain (`x.cartridge.gg/session`) for user authorization, waits for a redirect callback with session data,
then uses the session to sign and execute transactions via WASM bindings -- all without browser dependencies like
`localStorage` or iframes.

## Research Question

How does the Cartridge Controller Node.js example work end-to-end? What is the auth flow, what packages are needed, what
does the session grant look like, and how does the agent sign/execute transactions after auth?

## Key Findings

### Finding 1: Complete Authentication Flow (Step by Step)

The Node.js auth flow is implemented in `packages/controller/src/node/provider.ts` and works as follows:

**Step 1: Initialize SessionProvider**

```typescript
const provider = new SessionProvider({
  rpc: "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9",
  chainId: constants.StarknetChainId.SN_SEPOLIA,
  policies: { contracts: { [CONTRACT_ADDR]: { methods: [...] } } },
  basePath: ".cartridge",  // filesystem storage path
});
```

**Step 2: Call `provider.connect()`**

1. First calls `probe()` to check if a valid session already exists on disk (in `<basePath>/session.json`)
2. If no existing session, generates a **random Stark keypair** using `stark.randomAddress()` +
   `ec.starkCurve.getStarkKey(pk)`
3. Saves the signer (private + public key) to filesystem via `NodeBackend.set("signer", ...)`
4. Starts a **local HTTP callback server** on a random port (e.g., `http://localhost:54321/callback`)
5. Constructs a keychain URL:
   ```
   https://x.cartridge.gg/session?
     public_key=<generated_public_key>&
     redirect_uri=http://localhost:<port>/callback&
     redirect_query_name=startapp&
     policies=<JSON_encoded_policies>&
     rpc_url=<rpc_url>
   ```
6. **Prints the URL to console** (calls `openLink()` which just does `console.log`). The user must manually open this
   URL.
7. Calls `waitForCallback()` which blocks for up to **5 minutes** waiting for the browser redirect

**Step 3: User authorizes in browser**

- User opens the URL in browser, sees the Cartridge keychain session approval UI
- User reviews the policies (contract methods, message signing permissions)
- User approves using their Cartridge account (Passkeys/WebAuthn)
- The keychain registers the session on-chain and redirects to
  `http://localhost:<port>/callback?startapp=<base64_session_data>`

**Step 4: Callback received**

- The local HTTP server receives the callback request
- Extracts the `startapp` query parameter (base64-encoded session data)
- Responds with HTML telling the user to close the window
- Shuts down the server

**Step 5: Session stored and account created**

- The base64 session data is decoded to a `SessionRegistration` object:
  ```typescript
  {
    username: string; // Cartridge username
    address: string; // Controller contract address
    ownerGuid: string; // Owner's signer GUID
    expiresAt: string; // Unix timestamp (seconds)
    guardianKeyGuid: "0x0";
    metadataHash: "0x0";
    sessionKeyGuid: string; // Computed from the generated keypair
  }
  ```
- Session is saved to `<basePath>/session.json`
- A `SessionAccount` is created wrapping a `CartridgeSessionAccount` (WASM)

**Step 6: Execute transactions**

```typescript
const result = await account.execute([
  {
    contractAddress: "0x...",
    entrypoint: "transfer",
    calldata: [recipient, amount, "0x0"],
  },
]);
// Returns: { transaction_hash: "0x..." }
```

- Source: `packages/controller/src/node/provider.ts`, `packages/controller/src/node/server.ts`,
  `packages/controller/src/node/backend.ts`

### Finding 2: Required SDK Packages

```json
{
  "dependencies": {
    "@cartridge/controller": "workspace:*", // or "^0.13.4" from npm
    "@cartridge/controller-wasm": "0.9.1", // WASM bindings (Rust-compiled)
    "starknet": "8.5.4" // starknet.js
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "@types/node": "^22.12.0"
  }
}
```

**Critical: The `@cartridge/controller` package has TWO build targets:**

- **Browser build** (default `"."` export): Uses iframe-based communication with keychain
- **Node.js build** (`"./session/node"` export): Uses filesystem storage + local HTTP callback server

The import for Node.js is:

```typescript
import SessionProvider, { type ControllerError } from "@cartridge/controller/session/node";
```

The node build is created by `tsup` from `packages/controller/tsup.node.config.ts` and outputs to `dist/node/`.

**Runtime requirement:** Node.js 20+ with `--experimental-wasm-modules` flag (or `--import tsx` for TypeScript).

- Source: `examples/node/package.json`, `packages/controller/package.json`, `packages/controller/tsup.node.config.ts`

### Finding 3: Session Policies Structure

Policies define what the session key is authorized to do. The structure from `@cartridge/presets`:

```typescript
// High-level SessionPolicies (what you provide to the SDK)
type SessionPolicies = {
  contracts?: Record<string, ContractPolicy>; // key = contract address
  messages?: SignMessagePolicy[];
};

type ContractPolicy = {
  methods: Method[];
  description?: string;
};

type Method = {
  name?: string; // Human-readable name
  entrypoint: string; // Contract function name
  description?: string; // Description for UI
};
```

**Example from the node demo:**

```typescript
policies: {
  contracts: {
    "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7": {
      methods: [
        {
          name: "transfer",
          entrypoint: "transfer",
          description: "Transfer STRK",
        },
      ],
    },
  },
},
```

**Internal WASM Policy types** (what gets computed from SessionPolicies):

```typescript
// From @cartridge/controller-wasm
type Policy = CallPolicy | TypedDataPolicy | ApprovalPolicy;

interface CallPolicy {
  target: string; // Contract address
  method: string; // Selector hash (getSelectorFromName(entrypoint))
  authorized?: boolean;
}

interface TypedDataPolicy {
  scope_hash: string;
  authorized?: boolean;
}

interface ApprovalPolicy {
  target: string; // Token contract
  spender: string; // Approved spender
  amount: string; // Max amount
}
```

**Conversion:** The `toWasmPolicies()` function in `packages/controller/src/utils.ts` converts `SessionPolicies` to
`Policy[]`, sorting canonically to avoid merkle root mismatches (see issue #2357).

- Source: `@cartridge/presets` types, `packages/controller/src/utils.ts`, `packages/controller/src/policies.ts`

### Finding 4: Transaction Execution After Auth

Once authenticated, the `SessionAccount` extends starknet.js `WalletAccount` and wraps a `CartridgeSessionAccount`
(WASM):

```typescript
class SessionAccount extends WalletAccount {
  public controller: CartridgeSessionAccount;

  constructor(
    provider,
    {
      rpcUrl,
      privateKey,
      address,
      ownerGuid,
      chainId,
      expiresAt,
      policies,
      guardianKeyGuid,
      metadataHash,
      sessionKeyGuid,
    },
  ) {
    super({ provider: { nodeUrl: rpcUrl }, walletProvider: provider, address });

    this.controller = CartridgeSessionAccount.newAsRegistered(rpcUrl, privateKey, address, ownerGuid, chainId, {
      expiresAt,
      policies,
      guardianKeyGuid,
      metadataHash,
      sessionKeyGuid,
    });
  }

  async execute(calls: Call | Call[]): Promise<InvokeFunctionResponse> {
    try {
      // First try "execute from outside" (meta-transaction, paymaster-sponsored)
      return await this.controller.executeFromOutside(normalizeCalls(calls));
    } catch (e) {
      // Fallback to regular execute (user pays gas)
      return this.controller.execute(normalizeCalls(calls));
    }
  }
}
```

**Key points:**

- `executeFromOutside()` is tried first -- this is a StarkNet "outside execution" pattern where a relayer submits the
  transaction on behalf of the user. This means **the user does not need ETH/STRK for gas** if a paymaster is available.
- Falls back to regular `execute()` where the session account pays gas directly.
- Calls are normalized: `contractAddress` is padded, `calldata` is converted to hex via `CallData.toHex()`.
- The WASM `CartridgeSessionAccount` handles all signing internally using the session private key.

- Source: `packages/controller/src/node/account.ts`, `packages/controller/src/session/account.ts`

### Finding 5: StarkNet/Dojo-Specific Details

**Chain IDs:**

- Mainnet: `constants.StarknetChainId.SN_MAIN` (`"0x534e5f4d41494e"`)
- Sepolia testnet: `constants.StarknetChainId.SN_SEPOLIA` (`"0x534e5f5345504f4c4941"`)
- Katana (local Dojo devnet): Encoded as `WP_<PROJECT_NAME>` via `shortString.encodeShortString()`
- Slot (hosted Dojo): Encoded as `GG_<PROJECT_NAME>`

**RPC URLs:**

- Cartridge-hosted StarkNet: `https://api.cartridge.gg/x/starknet/{mainnet|sepolia}/rpc/v0_9`
- Cartridge Slot (Dojo): `https://api.cartridge.gg/x/<project>/<network>/rpc/v0_9`
- Custom RPC: Any StarkNet-compatible JSON-RPC endpoint

**Keychain URL:** `https://x.cartridge.gg` (the `/session` path handles session registration)

**API URL:** `https://api.cartridge.gg` (used by `subscribeCreateSession` for polling session registration status)

**Session Duration:** The keychain has a `DEFAULT_SESSION_DURATION` constant. Sessions have an `expiresAt` field (Unix
timestamp in seconds). The node example checks expiration on `probe()`.

**Contract Addresses in Example:**

- The example uses `0x049d36...4dc7` which is the **ETH token contract** on StarkNet (despite being called "STRK" in the
  demo comments -- this is actually the ETH ERC20 contract address).

- Source: `packages/controller/src/constants.ts`, `packages/controller/src/utils.ts`

### Finding 6: Filesystem Storage Backend (NodeBackend)

The Node.js adapter replaces browser `localStorage` with filesystem-based storage:

```typescript
class NodeBackend {
  // Stores all session data in a single JSON file
  private sessionFile: string; // <basePath>/session.json
  private data: SessionData = {};

  // Keys stored in the JSON:
  // - "signer": { privKey, pubKey }
  // - "session": { username, address, ownerGuid, expiresAt, ... }

  async get(key: string): Promise<string | null>;
  async set(key: string, value: string): Promise<void>;
  async delete(key: string): Promise<void>;

  // Callback server management
  async getRedirectUri(): Promise<string>; // Starts HTTP server, returns URL
  async waitForCallback(): Promise<string | null>; // Blocks until callback

  openLink(url: string): void; // Just prints URL to console
}
```

**Storage file:** `.cartridge/session.json` (or custom `basePath`) **Gitignored:** The `.gitignore` in the example
contains just `.cartridge`

- Source: `packages/controller/src/node/backend.ts`

### Finding 7: Local HTTP Callback Server

```typescript
class CallbackServer {
  // Creates an HTTP server on a random available port
  constructor() {
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  async listen(): Promise<string> {
    // Listens on port 0 (OS assigns random port), localhost only
    // Returns: "http://localhost:<port>/callback"
  }

  handleRequest(req, res) {
    // Only handles /callback path
    // Extracts "startapp" query param (base64 session data)
    // Returns HTML that tries to window.close()
  }

  async waitForCallback(): Promise<string> {
    // Blocks with a 5-minute timeout
    // Rejects with "Callback timeout after 5 minutes"
  }
}
```

- Source: `packages/controller/src/node/server.ts`

### Finding 8: The `subscribeCreateSession` WASM Function

This is an alternative to the HTTP callback approach. Used by the **browser** `SessionProvider` (not the Node one):

```typescript
// From @cartridge/controller-wasm
function subscribeCreateSession(session_key_guid: JsFelt, cartridge_api_url: string): Promise<JsSubscribeSessionResult>;
```

It subscribes (likely via WebSocket or polling) to the Cartridge API to know when a session registration is completed
for a given session key GUID. The result contains:

- `authorization[]` - The session authorization array (contains owner GUID)
- `controller.accountID` - The username
- `controller.address` - The controller contract address
- `expiresAt` - Session expiration

The **Node.js provider does NOT use `subscribeCreateSession`** -- it uses the local HTTP callback server instead. The
browser `SessionProvider` uses `subscribeCreateSession` as an alternative flow.

- Source: `packages/controller/src/session/provider.ts`, WASM type definitions

### Finding 9: WASM CartridgeSessionAccount Interface

```typescript
class CartridgeSessionAccount {
  // Create from a registered session (most common for Node.js)
  static newAsRegistered(
    rpc_url: string,
    signer: JsFelt, // Session private key
    address: JsFelt, // Controller contract address
    owner_guid: JsFelt, // Owner's GUID
    chain_id: JsFelt, // Chain ID
    session: Session, // Session config
  ): CartridgeSessionAccount;

  // Alternative: create with explicit authorization
  static new(
    rpc_url: string,
    signer: JsFelt,
    address: JsFelt,
    chain_id: JsFelt,
    session_authorization: JsFelt[],
    session: Session,
  ): CartridgeSessionAccount;

  // Execute methods
  executeFromOutside(calls: JsCall[]): Promise<any>; // Meta-transaction
  execute(calls: JsCall[]): Promise<any>; // Direct execution
  sign(hash: JsFelt, calls: JsCall[]): Promise<Felts>; // Sign only
}

interface Session {
  policies: Policy[];
  expiresAt: number;
  metadataHash: JsFelt;
  sessionKeyGuid: JsFelt;
  guardianKeyGuid: JsFelt;
}
```

- Source: `/tmp/cartridge-wasm/package/pkg-session/session_wasm.d.ts`

### Finding 10: Error Handling

The WASM layer exposes `JsControllerError` with typed error codes:

```typescript
class JsControllerError {
  code: ErrorCode; // Numeric enum
  message: string;
  data?: string;
}
```

Key error codes relevant to sessions:

- `SessionAlreadyRegistered` (132) - Session key already registered
- `SessionRefreshRequired` (142) - Session expired, needs re-auth
- `ForbiddenEntrypoint` (144) - Call not authorized by session policies
- `CartridgeControllerNotDeployed` (112) - Controller contract not deployed
- `InsufficientBalance` (113) - Not enough balance for gas
- `PaymasterRateLimitExceeded` (107) - Too many paymaster-sponsored txs

The TypeScript `ControllerError` type exposed to consumers:

```typescript
type ControllerError = {
  code: Number;
  message: string;
  data?: any;
};
```

- Source: WASM type definitions, `packages/controller/src/types.ts`

## Codebase Analysis

### Repository Structure (cartridge-gg/controller)

```
controller/
  examples/
    node/                  # Node.js session example
      src/session.ts       # Main demo script
      package.json         # Dependencies
    next/                  # Next.js browser example
    svelte/                # Svelte browser example
  packages/
    controller/            # Main SDK (@cartridge/controller)
      src/
        node/              # Node.js-specific session implementation
          provider.ts      # SessionProvider for Node.js
          account.ts       # SessionAccount (extends WalletAccount)
          backend.ts       # Filesystem storage (NodeBackend)
          server.ts        # Local HTTP callback server
          index.ts         # Exports
        session/           # Browser session implementation
          provider.ts      # SessionProvider (browser, uses localStorage)
          account.ts       # SessionAccount (same as node)
          backend.ts       # LocalStorageBackend
          index.ts         # Exports
        types.ts           # Shared types
        utils.ts           # Policy conversion, normalization
        policies.ts        # ParsedSessionPolicies types
        constants.ts       # KEYCHAIN_URL, API_URL
        provider.ts        # BaseProvider (abstract)
    connector/             # @cartridge/connector (starknet-react integration)
    keychain/              # Keychain webapp (x.cartridge.gg)
```

### External Package: @cartridge/controller-wasm (v0.9.1)

Published as a separate npm package. Contains Rust-compiled WASM binaries:

- `pkg-controller/` - Full controller account management (CartridgeAccount, ControllerFactory)
- `pkg-session/` - Session-only account (CartridgeSessionAccount) -- lighter weight
- Both export: `signerToGuid()`, `subscribeCreateSession()`

## Sources

- GitHub repo: https://github.com/cartridge-gg/controller
- Node example: `examples/node/src/session.ts`
- Node provider: `packages/controller/src/node/provider.ts`
- Node backend: `packages/controller/src/node/backend.ts`
- Node server: `packages/controller/src/node/server.ts`
- Node account: `packages/controller/src/node/account.ts`
- Session account (shared): `packages/controller/src/session/account.ts`
- Browser session provider: `packages/controller/src/session/provider.ts`
- Types: `packages/controller/src/types.ts`
- Utils/policies: `packages/controller/src/utils.ts`, `packages/controller/src/policies.ts`
- Constants: `packages/controller/src/constants.ts`
- WASM types (session): `@cartridge/controller-wasm@0.9.1` `pkg-session/session_wasm.d.ts`
- WASM types (controller): `@cartridge/controller-wasm@0.9.1` `pkg-controller/account_wasm.d.ts`
- Presets types: `@cartridge/presets@0.5.2` `dist/index.d.ts`
- Package config: `packages/controller/package.json`, `packages/controller/tsup.node.config.ts`
- Workspace config: `pnpm-workspace.yaml`

## Recommendations

1. **For integrating Cartridge sessions into an Eternum agent/bot:**
   - Use `@cartridge/controller/session/node` import path
   - The `SessionProvider` class handles the entire auth flow
   - Session data persists to filesystem -- restart the process and it reconnects without re-auth
   - Sessions expire; check `expiresAt` and re-auth when needed

2. **For a fully headless flow (no browser):**
   - The current Node.js implementation REQUIRES a browser step for initial auth
   - The `openLink()` method only prints the URL to console -- it does not actually open a browser
   - To automate, you would need to programmatically handle the keychain auth (not supported by the SDK)
   - Alternative: Use `subscribeCreateSession` from the WASM package with a pre-registered session

3. **For Dojo/Eternum game contracts:**
   - Define policies matching the game contract's entry points (e.g., `create_army`, `battle_start`, `swap`)
   - Use the appropriate chain ID for your deployment (Slot: `GG_<PROJECT>`, local Katana: `WP_<PROJECT>`)
   - `executeFromOutside` is preferred as it can be paymaster-sponsored (no gas needed)

4. **Package versions to pin:**
   - `@cartridge/controller`: `^0.13.4`
   - `@cartridge/controller-wasm`: `0.9.1` (must match controller version)
   - `starknet`: `8.5.4` (exact version important for compatibility)
   - Node.js: `20.x` with `--experimental-wasm-modules`

## Open Questions

1. **How does `subscribeCreateSession` work internally?** It is a WASM function that likely uses WebSocket or
   long-polling to the Cartridge API (`api.cartridge.gg`). The exact protocol is not visible from the TypeScript/WASM
   bindings alone -- the Rust source is in a separate repo.

2. **What is the session duration/expiration?** The keychain has a `DEFAULT_SESSION_DURATION` constant but its value was
   not directly visible. The browser provider shows it can be user-configured. The node example does not set a custom
   duration.

3. **Can sessions be revoked programmatically?** The `CartridgeAccount` (full controller, not session) has
   `revokeSession()` and `revokeSessions()` methods, but the `CartridgeSessionAccount` (session-only) does not.
   Revocation requires the full account owner credentials.

4. **How does the paymaster work with `executeFromOutside`?** The WASM `executeFromOutside` constructs an "outside
   execution" V3 transaction signed by the session key. A relayer/paymaster submits this on-chain. The exact paymaster
   endpoint is internal to the WASM/API.

5. **Where is the `@cartridge/presets` `Approval` type?** The `policies.ts` in the controller imports `Approval` from
   `@cartridge/presets`, but the published npm package (v0.5.2) does not export it. This may be a newer version or
   workspace-only type. The `ApprovalPolicy` in the WASM types handles ERC20 approve calls with `spender` and `amount`
   fields.

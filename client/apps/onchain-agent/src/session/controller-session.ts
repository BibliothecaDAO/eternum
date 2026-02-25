import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import SessionProvider from "@cartridge/controller/session/node";
import { ec, stark, encode, type WalletAccount } from "starknet";
import { signerToGuid } from "@cartridge/controller-wasm";
import type { WorldProfile } from "../world/types";
import { extractFromABI, tagMatchesGame } from "../abi/parser";

type SessionPolicies = ConstructorParameters<typeof SessionProvider>[0]["policies"];

const KEYCHAIN_URL = "https://x.cartridge.gg";

type PolicyMethod = { name: string; entrypoint: string; description?: string };

interface SessionManifest {
  contracts?: unknown[];
}

interface ControllerSessionConfig {
  rpcUrl: string;
  chainId: string;
  gameName?: string;
  basePath?: string;
  manifest: SessionManifest;
  worldProfile?: WorldProfile;
  /** When set, the auth URL is passed to this callback instead of opening a browser. */
  onAuthUrl?: (url: string) => void;
  /** Override the redirect URI for the auth callback (e.g. public VPS URL). */
  callbackUrl?: string;
}

interface BuildSessionPolicyOptions {
  gameName?: string;
  worldProfile?: WorldProfile;
}

const VRF_PROVIDER_ADDRESS = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";

function normalizeTag(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeGameName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^s\d+_/, "");
  return normalized || null;
}

function buildMessageSigningPolicy(chain: string): Array<Record<string, unknown>> {
  const chainDomain = chain === "mainnet" ? "SN_MAIN" : "SN_SEPOLIA";
  return [
    {
      name: "Eternum Message Signing",
      description: "Allows signing messages for Eternum",
      types: {
        StarknetDomain: [
          { name: "name", type: "shortstring" },
          { name: "version", type: "shortstring" },
          { name: "chainId", type: "shortstring" },
          { name: "revision", type: "shortstring" },
        ],
        "s1_eternum-Message": [
          { name: "identity", type: "ContractAddress" },
          { name: "channel", type: "shortstring" },
          { name: "content", type: "string" },
          { name: "timestamp", type: "felt" },
          { name: "salt", type: "felt" },
        ],
      },
      primaryType: "s1_eternum-Message",
      domain: {
        name: "Eternum",
        version: "1",
        chainId: chainDomain,
        revision: "1",
      },
    },
  ];
}

/**
 * Build session policies by extracting ALL external entrypoints from each
 * contract's ABI in the manifest. This replaces the old hardcoded
 * POLICY_METHODS_BY_SUFFIX table with dynamic ABI-driven extraction.
 *
 * For every contract that has an ABI, all external functions (both framework
 * and game-specific) are registered as policy methods. This ensures the
 * session key is authorized for every possible contract call.
 */
export function buildSessionPoliciesFromManifest(
  manifest: SessionManifest,
  options: BuildSessionPolicyOptions = {},
): SessionPolicies {
  const contracts: Record<string, { methods: PolicyMethod[] }> = {};
  const entries = Array.isArray(manifest.contracts) ? manifest.contracts : [];
  const gameName = normalizeGameName(options.gameName);
  const profile = options.worldProfile;

  for (const contract of entries) {
    const item = contract as Record<string, unknown>;
    const tag = normalizeTag(item.tag);
    const address = normalizeAddress(item.address);
    if (!tag || !address) continue;
    if (!tagMatchesGame(tag, gameName)) continue;

    const abi = item.abi as unknown[] | undefined;
    if (!abi || !Array.isArray(abi) || abi.length === 0) continue;

    const { entrypoints } = extractFromABI(abi);
    const methods: PolicyMethod[] = entrypoints
      .filter((ep) => ep.state_mutability === "external")
      .map((ep) => ({
        name: ep.name,
        entrypoint: ep.name,
      }));

    if (methods.length === 0) continue;

    const existing = contracts[address]?.methods ?? [];
    const mergedByEntrypoint = new Map<string, PolicyMethod>();
    for (const m of existing) mergedByEntrypoint.set(m.entrypoint, m);
    for (const m of methods) mergedByEntrypoint.set(m.entrypoint, m);

    contracts[address] = {
      methods: Array.from(mergedByEntrypoint.values()),
    };
  }

  // Check that we found at least one ABI-based contract before adding special policies
  if (Object.keys(contracts).length === 0) {
    const gameSuffix = gameName ? ` for game '${gameName}'` : "";
    throw new Error(
      `Could not derive Controller session policies from manifest${gameSuffix}: no recognized system contracts found`,
    );
  }

  // Ensure blitz_realm_systems has entrypoints that may be missing from manifest ABI
  // (assign_realm_positions, settle_realms are used by the settle_blitz_realm composite)
  for (const contract of entries) {
    const item = contract as Record<string, unknown>;
    const tag = normalizeTag(item.tag);
    const address = normalizeAddress(item.address);
    if (!tag || !address) continue;
    if (!tag.includes("blitz_realm_systems")) continue;
    const existing = contracts[address];
    if (!existing) continue;
    const mergedByEntrypoint = new Map<string, PolicyMethod>();
    for (const m of existing.methods) mergedByEntrypoint.set(m.entrypoint, m);
    for (const ep of ["assign_realm_positions", "settle_realms"]) {
      if (!mergedByEntrypoint.has(ep)) {
        mergedByEntrypoint.set(ep, { name: ep, entrypoint: ep });
      }
    }
    contracts[address] = { methods: Array.from(mergedByEntrypoint.values()) };
  }

  // Add VRF provider policy
  contracts[VRF_PROVIDER_ADDRESS] = {
    methods: [{ name: "VRF", entrypoint: "request_random" }],
  };

  // Add token policies from WorldProfile
  if (profile?.entryTokenAddress && profile.entryTokenAddress !== "0x0") {
    contracts[profile.entryTokenAddress] = {
      methods: [
        { name: "token_lock", entrypoint: "token_lock" },
        { name: "approve", entrypoint: "approve" },
      ],
    };
  }
  if (profile?.feeTokenAddress) {
    contracts[profile.feeTokenAddress] = {
      methods: [{ name: "approve", entrypoint: "approve" }],
    };
  }

  const chain = profile?.chain ?? "slot";
  return { contracts, messages: buildMessageSigningPolicy(chain) } as SessionPolicies;
}

/**
 * Decode, normalize, and store session data received from a Cartridge callback.
 *
 * Mirrors SessionProvider.connect() normalization:
 * - Lowercase address and ownerGuid
 * - Set guardianKeyGuid and metadataHash to "0x0"
 * - Compute sessionKeyGuid from public key via signerToGuid
 *
 * Writes session.json in the format NodeBackend expects (object values, not JSON strings).
 */
export function storeSessionFromCallback(
  basePath: string,
  sessionDataBase64: string,
): { address: string; username: string } {
  const sessionFilePath = path.join(basePath, "session.json");

  if (!existsSync(sessionFilePath)) {
    throw new Error("No session.json with signer keypair found. Run 'axis auth' first.");
  }
  const raw = readFileSync(sessionFilePath, "utf-8");
  const data = JSON.parse(raw);
  const signerRaw = data.signer ?? data;
  const signer = typeof signerRaw === "string" ? JSON.parse(signerRaw) : signerRaw;

  const decoded = Buffer.from(sessionDataBase64, "base64").toString("utf-8");
  const session = JSON.parse(decoded);

  const formattedPk = encode.addHexPrefix(signer.pubKey);
  session.address = session.address.toLowerCase();
  session.ownerGuid = session.ownerGuid.toLowerCase();
  session.guardianKeyGuid = "0x0";
  session.metadataHash = "0x0";
  session.sessionKeyGuid = signerToGuid({
    starknet: { privateKey: formattedPk },
  });

  // Write in NodeBackend's format: values are objects, not JSON strings.
  const backendData = { signer, session };
  mkdirSync(basePath, { recursive: true });
  writeFileSync(sessionFilePath, JSON.stringify(backendData, null, 2));

  return { address: session.address, username: session.username ?? "" };
}

export class ControllerSession {
  private provider: SessionProvider;
  private config: ControllerSessionConfig;
  private _resolveSessionData?: (data: string) => void;
  private _authUrlPromise: Promise<string>;
  private _resolveAuthUrl!: (url: string) => void;

  constructor(config: ControllerSessionConfig) {
    const policies = buildSessionPoliciesFromManifest(config.manifest, {
      gameName: config.gameName,
      worldProfile: config.worldProfile,
    });
    this.provider = new SessionProvider({
      rpc: config.rpcUrl,
      chainId: config.chainId,
      policies,
      basePath: config.basePath ?? ".cartridge",
    });
    this.config = config;
    this._authUrlPromise = new Promise<string>((resolve) => {
      this._resolveAuthUrl = resolve;
    });
  }

  /**
   * Resolves with the auth URL once connect() has generated it,
   * or "" if an existing session was found (no auth needed).
   */
  waitForAuthUrl(): Promise<string> {
    return this._authUrlPromise;
  }

  /**
   * Check for an existing valid session on disk.
   * Delegates to SessionProvider.probe() — no patching needed.
   */
  async probe(): Promise<WalletAccount | null> {
    const account = await this.provider.probe();
    return account ?? null;
  }

  /**
   * Connect to the Cartridge Controller.
   *
   * Custom implementation that mirrors SessionProvider.connect() but gives us
   * control over URL construction and callback handling. Uses the documented
   * Cartridge session URL format (https://docs.cartridge.gg).
   *
   * Flow:
   * 1. Probe for existing session
   * 2. Generate ephemeral keypair, store signer
   * 3. Set up callback listener (SDK's localhost server or external promise)
   * 4. Construct session URL with redirect_uri and callback_uri
   * 5. Emit URL via onAuthUrl or open browser
   * 6. Wait for session data from callback
   * 7. Decode, normalize, store via storeSessionFromCallback()
   * 8. Probe to materialize SessionAccount
   */
  async connect(): Promise<WalletAccount> {
    const existing = await this.probe();
    if (existing) {
      this._resolveAuthUrl(""); // No auth needed
      return existing;
    }

    const backend = (this.provider as any)._backend;
    if (!backend) {
      throw new Error("Cannot access SessionProvider backend");
    }

    // Generate ephemeral session keypair (same as SDK)
    const pk = stark.randomAddress();
    const publicKey = ec.starkCurve.getStarkKey(pk);
    await backend.set("signer", JSON.stringify({ privKey: pk, pubKey: publicKey }));

    // Set up callback listener
    let redirectUri: string;
    let sessionDataPromise: Promise<string>;

    if (this.config.callbackUrl) {
      // External callback URL — skip SDK's localhost server
      redirectUri = this.config.callbackUrl;
      sessionDataPromise = new Promise<string>((resolve) => {
        this._resolveSessionData = resolve;
      });
    } else {
      // Use SDK's built-in localhost callback server
      redirectUri = await backend.getRedirectUri();
      sessionDataPromise = backend.waitForCallback().then((data: string | null) => {
        if (!data) throw new Error("Callback returned no session data");
        return data;
      });
    }

    // Construct session URL using Cartridge's documented format
    const policies = (this.provider as any)._policies;
    const params = new URLSearchParams();
    params.set("public_key", publicKey);
    params.set("redirect_uri", redirectUri);
    params.set("redirect_query_name", "startapp");
    params.set("policies", JSON.stringify(policies));
    params.set("rpc_url", this.config.rpcUrl);
    if (this.config.callbackUrl) {
      params.set("callback_uri", this.config.callbackUrl);
    }
    const url = `${KEYCHAIN_URL}/session?${params.toString()}`;

    // Signal URL is ready before awaiting callback
    this._resolveAuthUrl(url);
    if (this.config.onAuthUrl) {
      this.config.onAuthUrl(url);
    } else {
      const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
      execFile(openCmd, [url]);
    }

    // Wait for session data
    const sessionData = await sessionDataPromise;

    // Store session via shared helper
    const basePath = this.config.basePath ?? ".cartridge";
    storeSessionFromCallback(basePath, sessionData);

    // Materialize SessionAccount via probe()
    const account = await this.probe();
    if (!account) {
      throw new Error("Session stored but probe() failed to materialize account");
    }
    return account;
  }

  /**
   * Feed session data received from an external callback endpoint.
   * Used when callbackUrl is set — the HTTP server receives the redirect/POST
   * and passes the base64-encoded session data here to complete connect().
   */
  feedCallbackData(sessionData: string): void {
    if (this._resolveSessionData) {
      this._resolveSessionData(sessionData);
      this._resolveSessionData = undefined;
    }
  }

  /**
   * Clear the stored session. Next connect() will require re-authorization.
   */
  async disconnect(): Promise<void> {
    await this.provider.disconnect();
  }
}

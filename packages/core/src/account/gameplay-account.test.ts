import { describe, expect, it, vi } from "vitest";
import { Account, RpcProvider } from "starknet";
import {
  buildGameplayAccountDeployment,
  createGameplayAccountApi,
  ensureGameplayAccount,
  gameplayKeyStorageKey,
  getOrCreateGameplayKey,
} from "./gameplay-account";

const CLASS_HASH = "0x123";
const PUBLIC_KEY = "0x456";
const PRIVATE_KEY = "0x789";
const OWNER = "0xabc";
const AUTHORITY = "0xdef";

describe("gameplay account deployment", () => {
  it("derives a stable address from the owner, public key, and authority", () => {
    const first = buildGameplayAccountDeployment({
      authority: AUTHORITY,
      classHash: CLASS_HASH,
      owner: OWNER,
      publicKey: PUBLIC_KEY,
    });
    const second = buildGameplayAccountDeployment({
      authority: AUTHORITY,
      classHash: CLASS_HASH,
      owner: OWNER,
      publicKey: PUBLIC_KEY,
    });
    const otherOwner = buildGameplayAccountDeployment({
      authority: AUTHORITY,
      classHash: CLASS_HASH,
      owner: "0xabd",
      publicKey: PUBLIC_KEY,
    });

    expect(first).toEqual(second);
    expect(first.address).not.toBe(otherOwner.address);
    expect(first.constructorCalldata).toEqual([PUBLIC_KEY, OWNER, AUTHORITY]);
  });

  it("skips deployment when the expected account already exists", async () => {
    const provider = createProvider();
    vi.spyOn(provider, "getClassHashAt").mockResolvedValue(CLASS_HASH);
    const deployAccount = vi.spyOn(Account.prototype, "deployAccount");

    const account = await ensureGameplayAccount(accountOptions(provider));

    expect(account.address).toBe(buildGameplayAccountDeployment(accountOptions(provider)).address);
    expect(deployAccount).not.toHaveBeenCalled();
  });

  it("deploys once when the address has no contract", async () => {
    const provider = createProvider();
    vi.spyOn(provider, "getClassHashAt").mockRejectedValue({ code: 20 });
    const waitForTransaction = vi.spyOn(provider, "waitForTransaction");
    const deployAccount = vi.spyOn(Account.prototype, "deployAccount").mockResolvedValue({
      contract_address: "0x1",
      transaction_hash: "0x2",
    });

    await ensureGameplayAccount(accountOptions(provider));

    expect(deployAccount).toHaveBeenCalledOnce();
    expect(waitForTransaction).not.toHaveBeenCalled();
  });

  it("refuses an occupied address with a different class", async () => {
    const provider = createProvider();
    vi.spyOn(provider, "getClassHashAt").mockResolvedValue("0x999");

    await expect(ensureGameplayAccount(accountOptions(provider))).rejects.toThrow("unexpected class hash");
  });
});

describe("gameplay key store", () => {
  it("persists one key for each chain and owner", () => {
    const storage = createStorage();
    const options = { storage, chain: "madara" as const, chainId: "0x1", owner: OWNER };

    const first = getOrCreateGameplayKey(options);
    const second = getOrCreateGameplayKey(options);

    expect(second).toEqual(first);
    expect(storage.values.size).toBe(1);
    expect(storage.values.has(gameplayKeyStorageKey("0x1", OWNER))).toBe(true);
  });

  it("allows a guest on madara and refuses one on appchain", () => {
    expect(() =>
      getOrCreateGameplayKey({ storage: createStorage(), chain: "madara", chainId: "0x1", owner: 0 }),
    ).not.toThrow();
    expect(() =>
      getOrCreateGameplayKey({ storage: createStorage(), chain: "appchain", chainId: "0x1", owner: 0 }),
    ).toThrow("only allowed on madara");
  });

  it("fails loudly on a corrupt stored key", () => {
    const storage = createStorage();
    storage.setItem(gameplayKeyStorageKey("0x1", OWNER), "not json");

    expect(() => getOrCreateGameplayKey({ storage, chain: "madara", chainId: "0x1", owner: OWNER })).toThrow(
      "Invalid gameplay key record",
    );
  });
});

describe("gameplay account API", () => {
  it("sends credentialed bind and rotate requests", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ account: "0x1", bound: true }))
      .mockResolvedValueOnce(Response.json({ account: "0x1" }));
    const api = createGameplayAccountApi({ baseUrl: "https://realms.test/", fetch });

    await api.bind("0x1", "0x2");
    await expect(api.rotate("0x3")).resolves.toBe("0x1");

    expect(fetch.mock.calls[0]?.[0]).toBe("https://realms.test/api/gameplay-account/bind");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: "include", method: "POST" });
  });
});

function createProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: "https://rpc.realms.test" });
}

function accountOptions(provider: RpcProvider) {
  return {
    authority: AUTHORITY,
    classHash: CLASS_HASH,
    owner: OWNER,
    privateKey: PRIVATE_KEY,
    provider,
    publicKey: PUBLIC_KEY,
  };
}

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

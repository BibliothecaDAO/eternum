export function parseOwnershipAssertion(address, expectedCountValue) {
  if (!address?.trim()) {
    throw new Error("REALM_OWNERSHIP_SMOKE_ADDRESS is required");
  }
  if (!expectedCountValue?.trim()) {
    throw new Error("REALM_OWNERSHIP_SMOKE_EXPECTED_COUNT is required");
  }

  let owner;
  try {
    owner = `0x${BigInt(address).toString(16)}`;
  } catch {
    throw new Error("REALM_OWNERSHIP_SMOKE_ADDRESS is invalid");
  }

  const expectedCount = Number(expectedCountValue);
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) {
    throw new Error("REALM_OWNERSHIP_SMOKE_EXPECTED_COUNT is invalid");
  }

  return { owner, expectedCount };
}

export function assertIndexedOwnership(
  indexedCount,
  walletCount,
  expectedCount,
) {
  if (indexedCount <= 0) {
    throw new Error("Realm ownership index contains no ownership records");
  }
  if (walletCount !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} Realms for the smoke-test wallet, indexed ${walletCount}`,
    );
  }
}

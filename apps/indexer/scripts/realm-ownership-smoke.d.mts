export interface OwnershipAssertion {
  owner: string;
  expectedCount: number;
}

export function parseOwnershipAssertion(
  address: string | undefined,
  expectedCountValue: string | undefined,
): OwnershipAssertion;

export function assertIndexedOwnership(
  indexedCount: number,
  walletCount: number,
  expectedCount: number,
): void;

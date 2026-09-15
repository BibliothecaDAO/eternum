import { setTimeout as sleep } from "node:timers/promises";
import { hash } from "starknet";

/** Select a lab input root; the contract still evaluates the unchanged pool and timestamp salt. */
function discoveryRoot(gameId: number, time: number, outcome: "mine" | "bitcoin"): bigint {
  const offset = outcome === "bitcoin" ? 10n : 2n;
  const success = outcome === "bitcoin" ? 200n : 1000n;
  const total = outcome === "bitcoin" ? 10000n : 50000n;
  for (let raw = 1n; raw < 50000n; raw++) {
    const seed = BigInt(hash.computePoseidonHashOnElements([raw + 1432n, 0, gameId, 1]));
    const shifted = seed > offset ? seed - offset : seed + offset;
    const wins = [time - 1, time].every((timestamp) => {
      const roll = BigInt(
        hash.computePoseidonHashOnElements([shifted & ((1n << 128n) - 1n), shifted >> 128n, timestamp + 18]),
      );
      return roll % total < success;
    });
    if (wins) return raw;
  }
  throw new Error("No discovery fixture root found");
}

/** Prepare before the latency clock starts; entropy injection never changes the configured pool. */
export function discoveryFixture(gameId: number, clock: () => number) {
  let prepared: { root: bigint; timestamp: number; outcome: string } | undefined;
  return {
    async prepare(bot: number) {
      const outcome = bot === 0 ? "mine" : "bitcoin";
      const target = clock() + 16;
      const root = discoveryRoot(gameId, target, outcome);
      const deadline = Date.now() + 30000;
      while (clock() < target && Date.now() < deadline) await sleep(25);
      if (clock() !== target) throw new Error("Discovery fixture missed its execution window");
      prepared = { root, timestamp: target, outcome };
    },
    read() {
      if (!prepared) throw new Error("Discovery input was not prepared");
      return prepared;
    },
  };
}

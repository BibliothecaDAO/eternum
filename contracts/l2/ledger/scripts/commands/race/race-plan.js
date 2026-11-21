const LORDS_UNIT = 10n ** 18n;
const UINT128 = 2n ** 128n;

const RACE_STEPS = ["declare", "deploy", "fund", "status"];

export function buildRacePlan({ step, book, addresses, environment, options }) {
  if (!RACE_STEPS.includes(step)) throw new Error(`Unknown race step "${step}": use ${RACE_STEPS.join(", ")}`);
  const source = `contracts/common/addresses/${book}.json`;
  const plan = {
    step,
    book,
    ledger: requireAddress(addresses.ledger, `${source}:ledger`),
    lords: requireAddress(addresses.lords, `${source}:lords`),
    treasury: requireAddress(addresses.treasury, `${source}:treasury`),
    rewards: addresses.raceRewards ? requireAddress(addresses.raceRewards, `${source}:raceRewards`) : null,
    signer: requireAddress(environment.STARKNET_ACCOUNT_ADDRESS, "STARKNET_ACCOUNT_ADDRESS"),
  };
  if (step === "declare") return plan;
  if (step === "deploy") return { ...plan, constructorCalldata: [plan.ledger, plan.treasury] };
  const race = { ...plan, rewards: requireDeployed(plan.rewards, source), ...raceKey(options) };
  return step === "fund" ? { ...race, calls: fundingCalls(race, wholeLords(options.amount)) } : race;
}

export function assertLedgerTreasury(plan, storedTreasury) {
  if (BigInt(storedTreasury) !== BigInt(plan.treasury))
    throw new Error(
      `The ledger ${plan.ledger} stores treasury 0x${BigInt(storedTreasury).toString(16)}, but contracts/common/addresses/${plan.book}.json names ${plan.treasury}`,
    );
}

export function withRaceRewards(addresses, rewards) {
  const address = requireAddress(rewards, "deployed race rewards address");
  if (addresses.raceRewards && BigInt(addresses.raceRewards) !== BigInt(address))
    throw new Error(`The address book already names race rewards ${addresses.raceRewards}`);
  return { ...addresses, raceRewards: address };
}

function fundingCalls(race, amount) {
  const uint256 = [`0x${(amount % UINT128).toString(16)}`, `0x${(amount / UINT128).toString(16)}`];
  return [
    { contractAddress: race.lords, entrypoint: "approve", calldata: [race.rewards, ...uint256] },
    { contractAddress: race.rewards, entrypoint: "fund_race", calldata: [race.shard, String(race.game), ...uint256] },
  ];
}

function raceKey(options) {
  const game = Number(requireValue(options.game, "--game"));
  if (!Number.isSafeInteger(game) || game <= 0) throw new Error("--game must be a game id");
  return { shard: requireAddress(options.shard, "--shard"), game };
}

function wholeLords(value) {
  const amount = requireValue(value, "--amount");
  if (!/^[1-9][0-9]*$/.test(amount)) throw new Error("--amount is a whole number of LORDS");
  return BigInt(amount) * LORDS_UNIT;
}

function requireDeployed(rewards, source) {
  if (!rewards) throw new Error(`${source} names no raceRewards: run the deploy step first`);
  return rewards;
}

function requireAddress(value, label) {
  const normalized = `0x${BigInt(requireValue(value, label)).toString(16)}`;
  if (BigInt(normalized) === 0n) throw new Error(`${label} must be non-zero`);
  return normalized;
}

function requireValue(value, label) {
  if (value === undefined || value === null || `${value}`.trim() === "") throw new Error(`${label} is required`);
  return `${value}`.trim();
}

import { CallData, type Abi } from "starknet";
import abi from "../../../contracts/l2/ledger/schema/race-abi.json";

export const raceRewardsAbi: Abi = abi;
const rewards = new CallData(raceRewardsAbi);

export const raceCalldata = (entrypoint: string, args: Record<string, unknown>) =>
  rewards.compile(entrypoint, args as never);

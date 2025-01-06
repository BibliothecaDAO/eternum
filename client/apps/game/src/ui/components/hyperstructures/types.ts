import { ContractAddress } from "@bibliothecadao/eternum";

export type CoOwnersWithTimestamp = {
  coOwners: {
    address: ContractAddress;
    percentage: number;
  }[];
  timestamp: number;
};

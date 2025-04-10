import { ContractAddress } from "@bibliothecadao/types";

export type CoOwnersWithTimestamp = {
  coOwners: {
    address: ContractAddress;
    percentage: number;
  }[];
  timestamp: number;
};

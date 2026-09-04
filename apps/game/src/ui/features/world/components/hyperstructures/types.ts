import { ContractAddress } from "@bibliothecadao/types";

type CoOwnersWithTimestamp = {
  coOwners: {
    address: ContractAddress;
    percentage: number;
  }[];
  timestamp: number;
};

// Read surface of contracts/mmr MMRToken. get_player_mmr returns the initial
// rating for players the token has never seen, so a fresh wallet reads 1500e18.
export const MMR_TOKEN_ABI = [
  {
    type: "function",
    name: "get_player_mmr",
    inputs: [{ name: "player", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
] as const;

import { getEmbeddedAddresses, getEmbeddedManifest } from "./embedded-data";

import type { CartridgeWorldAuthContext } from "../types";

export type AuthChain = CartridgeWorldAuthContext["chain"];

interface Method {
  name: string;
  entrypoint: string;
  description?: string;
}

interface ContractPolicy {
  methods: Method[];
}

interface SessionPolicies {
  contracts: Record<string, ContractPolicy>;
  messages?: SignMessagePolicy[];
}

interface SignMessagePolicy {
  name: string;
  description?: string;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  domain: Record<string, string>;
}

interface TokenAddresses {
  entryToken?: string;
  feeToken?: string;
}

const VRF_ADDRESS = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";

const DOJO_METHODS: Method[] = [method("dojo_name"), method("world_dispatcher")];

export function buildCartridgePolicies(input: {
  chain: AuthChain;
  manifest?: Record<string, unknown>;
  entryTokenAddress?: string;
  feeTokenAddress?: string;
}): SessionPolicies {
  const manifest = (input.manifest ?? getEmbeddedManifest(input.chain)) as {
    contracts: Array<{ tag: string; address: string }>;
  };
  const addresses = getEmbeddedAddresses(input.chain) as { seasonPass: string; villagePass: string };
  const contracts: Record<string, ContractPolicy> = {};

  const add = (address: string, policy: ContractPolicy) => {
    if (contracts[address]) {
      const existing = new Set(contracts[address].methods.map((current) => current.entrypoint));
      for (const current of policy.methods) {
        if (!existing.has(current.entrypoint)) {
          contracts[address].methods.push(current);
          existing.add(current.entrypoint);
        }
      }
      return;
    }

    contracts[address] = {
      methods: [...policy.methods],
    };
  };

  const tokens: TokenAddresses = {
    entryToken: input.entryTokenAddress,
    feeToken: input.feeTokenAddress,
  };

  if (tokens.entryToken && tokens.entryToken !== "0x0") {
    add(tokens.entryToken, {
      methods: [
        {
          name: "token_lock",
          entrypoint: "token_lock",
          description: "Lock entry token for game participation",
        },
      ],
    });
  }

  if (tokens.feeToken) {
    add(tokens.feeToken, {
      methods: [
        {
          name: "approve",
          entrypoint: "approve",
          description: "Approve fee token spending",
        },
      ],
    });
  }

  const blitzRealmSystemsAddress = resolveContractAddress(manifest, "blitz_realm_systems");
  if (blitzRealmSystemsAddress) {
    add(blitzRealmSystemsAddress, {
      methods: [
        method("make_hyperstructures"),
        method("register"),
        method("obtain_entry_token"),
        method("create"),
        method("assign_realm_positions"),
        method("settle_realms"),
      ],
    });
  }

  addSystem(manifest, add, "bank_systems", [method("create_banks")]);
  add(addresses.villagePass, { methods: [method("set_approval_for_all")] });
  addSystem(manifest, add, "liquidity_systems", [method("add"), method("remove")]);
  addSystem(manifest, add, "name_systems", [method("set_address_name")]);
  addSystem(manifest, add, "trade_systems", [method("accept_trade"), method("create_trade"), method("cancel_trade")]);
  addSystem(manifest, add, "troop_systems", [
    method("create_army"),
    method("move_army"),
    method("split_army"),
    method("merge_armies"),
    method("create_explorer"),
    method("swap_explorer_embarks"),
  ]);
  addSystem(manifest, add, "combat_systems", [method("attack"), method("simulate_attack"), method("claim_battle")]);
  addSystem(manifest, add, "production_systems", [
    method("create_building"),
    method("destroy_building"),
    method("pause_building_production"),
    method("resume_building_production"),
  ]);
  addSystem(manifest, add, "resource_systems", [
    method("pickup_resources"),
    method("transfer_resources"),
    method("burn_resources"),
  ]);
  addSystem(manifest, add, "hyperstructure_systems", [
    method("initialize"),
    method("contribute"),
    method("claim_share_points"),
    method("allocate_shares"),
    method("update_construction_access"),
  ]);
  addSystem(manifest, add, "ownership_systems", [
    method("transfer_structure_ownership"),
    method("transfer_agent_ownership"),
  ]);
  addSystem(manifest, add, "config_systems", [method("set_agent_config")]);
  add(addresses.seasonPass, { methods: [method("set_approval_for_all")] });
  add(VRF_ADDRESS, { methods: [method("request_random"), method("read_random")] });

  return {
    contracts,
    messages: [
      {
        name: "Sign world chat message",
        primaryType: "Message",
        domain: {
          name: "Eternum",
          chainId: "0x0",
          version: "1",
        },
        types: {
          StarknetDomain: [
            { name: "name", type: "shortstring" },
            { name: "chainId", type: "felt" },
            { name: "version", type: "shortstring" },
          ],
          Message: [{ name: "content", type: "string" }],
        },
      },
    ],
  };
}

function addSystem(
  manifest: { contracts: Array<{ tag: string; address: string }> },
  add: (address: string, policy: ContractPolicy) => void,
  systemName: string,
  methods: Method[],
) {
  const address = resolveContractAddress(manifest, systemName);
  if (!address) {
    return;
  }

  add(address, {
    methods: [...methods, ...DOJO_METHODS],
  });
}

function resolveContractAddress(
  manifest: { contracts: Array<{ tag: string; address: string }> },
  systemName: string,
): string | null {
  const tag = `s1_eternum-${systemName}`;
  const contract = manifest.contracts.find((current) => current.tag === tag);
  return contract?.address ?? null;
}

function method(entrypoint: string): Method {
  return {
    name: entrypoint,
    entrypoint,
  };
}

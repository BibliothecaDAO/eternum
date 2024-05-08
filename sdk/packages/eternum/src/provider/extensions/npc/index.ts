import { EternumProvider, getContractByName } from "../../index";
import { num } from "starknet";
import { SystemSigner } from "../../../types/provider";

export interface SpawnNpcProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  characteristics: num.BigNumberish;
  character_trait: num.BigNumberish;
  full_name: num.BigNumberish;
  signature: num.BigNumberish[];
}

export interface NpcTravelProps extends SystemSigner {
  npc_entity_id: num.BigNumberish;
  to_realm_entity_id: num.BigNumberish;
}

export interface WelcomeNpcProps extends SystemSigner {
  npc_entity_id: num.BigNumberish;
  into_realm_entity_id: num.BigNumberish;
}

export interface KickOutNpcProps extends SystemSigner {
  npc_entity_id: num.BigNumberish;
}

async function spawn_npc(this: EternumProvider, props: SpawnNpcProps) {
  const { realm_entity_id, characteristics, character_trait, full_name, signature } = props;
  const tx = await this.executeMulti(props.signer, {
    contractAddress: getContractByName(this.manifest, "npc_systems"),
    entrypoint: "spawn_npc",
    calldata: [realm_entity_id, characteristics, character_trait, full_name, signature],
  });
  return await this.waitForTransactionWithCheck(tx.transaction_hash);
}

async function npc_travel(this: EternumProvider, props: NpcTravelProps) {
  const { npc_entity_id, to_realm_entity_id } = props;
  const tx = await this.executeMulti(props.signer, {
    contractAddress: getContractByName(this.manifest, "npc_systems"),
    entrypoint: "npc_travel",
    calldata: [npc_entity_id, to_realm_entity_id],
  });
  return await this.waitForTransactionWithCheck(tx.transaction_hash);
}

async function welcome_npc(this: EternumProvider, props: WelcomeNpcProps) {
  const { npc_entity_id, into_realm_entity_id } = props;
  const tx = await this.executeMulti(props.signer, {
    contractAddress: getContractByName(this.manifest, "npc_systems"),
    entrypoint: "welcome_npc",
    calldata: [npc_entity_id, into_realm_entity_id],
  });
  return await this.waitForTransactionWithCheck(tx.transaction_hash);
}

async function kick_out_npc(this: EternumProvider, props: KickOutNpcProps) {
  const { npc_entity_id } = props;
  const tx = await this.executeMulti(props.signer, {
    contractAddress: getContractByName(this.manifest, "npc_systems"),
    entrypoint: "kick_out_npc",
    calldata: [npc_entity_id],
  });
  return await this.waitForTransactionWithCheck(tx.transaction_hash);
}

const npcProviderFunctions = {
  spawn_npc: spawn_npc,
  npc_travel: npc_travel,
  welcome_npc: welcome_npc,
  kick_out_npc: kick_out_npc,
};

export { npcProviderFunctions };

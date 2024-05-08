import {
  EternumProvider,
  SpawnNpcProps,
  NpcTravelProps,
  WelcomeNpcProps,
  KickOutNpcProps,
} from "@bibliothecadao/eternum";

export type SystemCallFunctions = ReturnType<typeof createNpcSystemCalls>;

export function createNpcSystemCalls(provider: EternumProvider) {
  const spawn_npc = async (props: SpawnNpcProps) => {
    await provider.spawn_npc(props);
  };

  const npc_travel = async (props: NpcTravelProps) => {
    await provider.npc_travel(props);
  };

  const welcome_npc = async (props: WelcomeNpcProps) => {
    await provider.welcome_npc(props);
  };

  const kick_out_npc = async (props: KickOutNpcProps) => {
    await provider.kick_out_npc(props);
  };

  const systemCalls = {
    spawn_npc,
    npc_travel,
    welcome_npc,
    kick_out_npc,
  };

  return systemCalls;
}

import { BattleType } from "@/dojo/modelManager/types";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { FullStructure } from "@/hooks/helpers/useStructures";
import { useModal } from "@/hooks/store/useModal";
import useUIStore from "@/hooks/store/useUIStore";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { getOwnArmy } from "./utils";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import Button from "@/ui/elements/Button";

export const BattleActions = ({
	battle,
	attacker,
	defender,
	structure,
	battleId,
  }: {
	battle: ComponentValue<BattleType, unknown> | undefined;
	attacker: ArmyInfo;
	defender: ArmyInfo | undefined;
	structure: FullStructure | undefined;
	battleId: bigint;
  }) => {
	const [loading, setLoading] = useState(false);
	const setBattleView = useUIStore((state) => state.setBattleView);
	const { toggleModal } = useModal();
  
	const {
	  account: { account },
	  network: { provider },
	  setup: {
		systemCalls: { battle_leave, battle_start },
		components: { Realm },
	  },
	} = useDojo();
  
	const ownArmy = defender ? getOwnArmy(attacker, defender) : undefined;
  
	const isActive = useMemo(() => {
	  if (!battle) {
		return false;
	  }
	  return battle.attack_army_health.current > 0 && battle.defence_army_health.current > 0;
	}, [battle]);
  
	const isRealm = useMemo(() => {
	  if (!structure) return false;
	  return Boolean(getComponentValue(Realm, getEntityIdFromKeys([BigInt(structure.entity_id)])));
	}, [structure]);
  
	const handleRaid = async () => {
	  setLoading(true);
  
	  // await provider.battle_pillage({
	  //   signer: account,
	  //   army_id: attacker.army_id,
	  //   structure_id: structure.protectee_id,
	  // });
  
	  setLoading(false);
	  setBattleView(null);
	  // toggleModal(
	  //   <ModalContainer size="half">
	  //     <PillageHistory
	  //       structureId={BigInt(structure.protectee_id)}
	  //       attackerRealmEntityId={BigInt(attacker.entity_owner_id)}
	  //     />
	  //   </ModalContainer>,
	  // );
	};
  
	const handleBattleStart = async () => {
	  setLoading(true);
	  await battle_start({
		signer: account,
		attacking_army_id: ownArmy!.entity_id,
		defending_army_id: defender!.entity_id,
	  });
  
	  setLoading(false);
	};
  
	const handleBattleClaim = async () => {
	  setLoading(true);
	  await provider.battle_claim({
		signer: account,
		army_id: ownArmy!.entity_id,
		structure_id: structure!.entity_id,
	  });
  
	  setLoading(false);
	};
  
	const handleLeaveBattle = async () => {
	  setLoading(true);
	  await battle_leave({
		signer: account,
		army_id: ownArmy!.entity_id,
		battle_id: battleId,
	  });
  
	  setLoading(false);
	  setBattleView(null);
	};
  
	const isClaimable = ownArmy && !isActive && (!defender || defender.current <= 0) && !isRealm && Boolean(structure);
  
	return (
	  <div className="col-span-2 flex justify-center flex-wrap mx-12 w-[100vw]">
		<div className="grid grid-cols-2 gap-3 row-span-2">
		  <Button
			variant="primary"
			className="flex flex-col gap-2"
			isLoading={loading}
			onClick={handleRaid}
			disabled={!ownArmy || isActive || Boolean(ownArmy.battle_id)}
		  >
			<img className="w-10" src="/images/icons/raid.png" alt="coin" />
			Raid!
		  </Button>
  
		  {/* IF BATTLE HAS BEEN WON or NO ARMY ON STRUCTURE */}
  
		  <Button
			variant="primary"
			className="flex flex-col gap-2"
			isLoading={loading}
			onClick={handleBattleClaim}
			disabled={isClaimable}
		  >
			<img className="w-10" src="/images/icons/claim.png" alt="coin" />
			Claim
		  </Button>
  
		  <Button
			variant="primary"
			className="flex flex-col gap-2"
			isLoading={loading}
			onClick={handleLeaveBattle}
			disabled={!ownArmy || !Boolean(ownArmy.battle_id)}
		  >
			<img className="w-10" src="/images/icons/leave-battle.png" alt="coin" />
			Leave Battle
		  </Button>
  
		  <Button
			variant="primary"
			className="flex flex-col gap-2"
			isLoading={loading}
			onClick={handleBattleStart}
			disabled={!ownArmy || isRealm || Boolean(ownArmy.battle_id) || !defender}
		  >
			<img className="w-10" src="/images/icons/attack.png" alt="coin" />
			Battle
		  </Button>
		</div>
	  </div>
	);
  };
  

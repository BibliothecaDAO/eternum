import { useDojo } from "../../context/DojoContext";
interface TravelToHexProps {
  travelingEntityId: bigint | undefined;
  directions: number[];
}

export function useTravel() {
  const {
    account: { account },
    setup: {
      systemCalls: { travel_hex },
    },
  } = useDojo();

  const travelToHex = async ({ travelingEntityId, directions }: TravelToHexProps) => {
    if (!travelingEntityId) return;
    await travel_hex({
      signer: account,
      travelling_entity_id: travelingEntityId,
      directions,
    });
  };

  return { travelToHex };
}

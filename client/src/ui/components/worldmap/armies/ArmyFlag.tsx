import useRealmStore from "@/hooks/store/useRealmStore";
import { getRealmOrderNameById } from "@/ui/utils/realms";
import { useMemo } from "react";
import { BannerFlag } from "../BannerFlag";
import { Vector3 } from "three";

export const ArmyFlag = ({
  position,
  rotationY,
  visible,
}: {
  position: Vector3;
  rotationY: number;
  visible: boolean;
}) => {
  const realms = useRealmStore((state) => state.realmEntityIds);
  const realmOrder = useMemo(() => {
    const realmId = realms[0]?.realmId || 0;
    const orderName = getRealmOrderNameById(realmId);
    return orderName.charAt(0).toUpperCase() + orderName.slice(1);
  }, []);

  return (
    <group visible={visible} position={[0, 3, 0]} rotation={[0, rotationY - Math.PI / 2, 0]} scale={0.7}>
      <BannerFlag order={realmOrder} position={[position.x, position.y, position.z + 10]}></BannerFlag>
    </group>
  );
};

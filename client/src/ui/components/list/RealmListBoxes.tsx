import clsx from "clsx";
import { ComponentPropsWithRef } from "react";
import { useLocation } from "wouter";
import useUIStore from "@/hooks/store/useUIStore";
import { OrderIcon } from "@/ui/elements/OrderIcon";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";

type RealmSwitchProps = {} & ComponentPropsWithRef<"div">;

export const RealmListBoxes = ({ className }: RealmSwitchProps) => {
  const { playerRealms } = useEntities();
  const { isLocation } = useQuery();

  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const [location, setLocation] = useLocation();

  return (
    <div className={clsx("flex", className)}>
      <div className={clsx("flex items-center ml-2 space-x-2 w-auto transition-all duration-300 overflow-hidden ")}>
        {playerRealms().map((realm) => (
          <div
            className={`${
              isLocation(realm?.position?.x ?? 0, realm?.position?.y ?? 0)
                ? "border-gradient bg-brown"
                : "border-transparent"
            } w-32 h-8 px-2 bg-brown/80 text-gold border-gold border-2 hover:border-gradient duration-300 transition-all flex`}
            key={realm?.realm_id}
            onClick={() => {
              setIsLoadingScreenEnabled(true);
              setTimeout(() => {
                if (location.includes(`/hex`)) {
                  setIsLoadingScreenEnabled(false);
                }
                setLocation(`/hex?col=${realm?.position.x}&row=${realm?.position.y}`);
              }, 300);
            }}
          >
            <div className="text-ellipsis overflow-hidden whitespace-nowrap text-overflow-ellipsis self-center">
              {realm?.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import { useEffect, useState } from "react";
import { Realm } from "../../../types";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useTrade } from "../../../hooks/helpers/useTrade";
import { useCaravan } from "../../../hooks/helpers/useCaravans";
import { getLatestRealmId } from "../../../hooks/graphql/useGraphQLQueries";
import { getRealm } from "../../../utils/realms";
import { getOrderName } from "../../../constants/orders";
import { OrderIcon } from "../../../elements/OrderIcon";

export const SelectRealmPanel = ({
  selectedRealmId,
  setSelectedRealmId,
}: {
  selectedRealmId: number | undefined;
  setSelectedRealmId: (selectedRealmId: number) => void;
}) => {
  const [specifyRealmId, setSpecifyRealmId] = useState(false);
  const [allRealms, setAllRealms] = useState<Realm[]>([]); // This would ideally be populated from an API call or similar.

  const { realmId, realmEntityId } = useRealmStore();

  const { getRealmEntityIdFromRealmId } = useTrade();

  const { calculateDistance } = useCaravan();

  useEffect(() => {
    const buildRealmIds = async () => {
      const realm_id = await getLatestRealmId();
      setAllRealms(
        Array.from({ length: realm_id }, (_, i) => i + 1)
          .map((id) => {
            return getRealm(id);
          })
          .filter((realm) => realm.realm_id !== realmId && realm.realm_id !== 1),
      );
    };
    buildRealmIds();
  }, []);

  return (
    <div className="flex flex-col items-center w-full p-2">
      {!specifyRealmId && (
        <div
          onClick={() => setSpecifyRealmId(true)}
          className="w-full mx-4 h-8 py-[7px] bg-dark-brown cursor-pointer rounded justify-center items-center"
        >
          <div className="text-xs text-center text-gold"> + Make Direct Offer</div>
        </div>
      )}
      {specifyRealmId && (
        <div
          onClick={() => setSpecifyRealmId(false)}
          className="w-full mx-4 h-8 py-[7px] bg-dark-brown cursor-pointer rounded justify-center items-center"
        >
          <div className="text-xs text-center text-gold">Back to Market Offer</div>
        </div>
      )}
      {specifyRealmId && realmEntityId && (
        <div>
          <input
            type="number"
            id="realm-id"
            value={selectedRealmId || ""}
            onChange={(e) => setSelectedRealmId(Number(e.target.value))}
            placeholder="Enter realm id..."
          />
          <div className="bg-gray-100 p-4 rounded shadow-lg max-h-[150px] overflow-y-auto text-gold">
            {allRealms.map(({ order, name, realm_id: takerRealmId }) => {
              const takerEntityId = getRealmEntityIdFromRealmId(takerRealmId);
              const distance = takerEntityId ? calculateDistance(realmEntityId, takerEntityId) : 0;
              return (
                <div
                  key={takerRealmId}
                  className={`realmItem ${selectedRealmId === takerRealmId ? "active" : ""}`}
                  onClick={() => setSelectedRealmId(takerRealmId)}
                >
                  <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
                    {takerRealmId}
                    <OrderIcon order={getOrderName(order)} size="xs" className="mr-1" />
                    {name}-{`${distance?.toFixed(0)} km`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

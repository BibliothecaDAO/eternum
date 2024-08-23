import { useDojo } from "@/hooks/context/DojoContext";
import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";

export const EventStream = () => {
  const {
    setup: {
      components: { MapExplored },
    },
  } = useDojo();

  const entities = useEntityQuery([Has(MapExplored)]);

  console.log({ entities });

  return (
    <div className="bg-black bg-opacity-70 text-white rounded-lg p-3 max-w-sm">
      <h2 className="text-lg font-semibold mb-2">Event Stream</h2>
      {/* Add your event stream content here */}
    </div>
  );
};

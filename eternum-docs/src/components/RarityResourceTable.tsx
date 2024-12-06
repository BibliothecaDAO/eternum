import ResourceIcon from "./ResourceIcon";

const RarityResourceTable = () => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-gray">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b-2 border-gray-300 text-left">Rarity</th>
            <th className="py-2 px-4 border-b-2 border-gray-300 text-left">Resources</th>
          </tr>
        </thead>
        <tbody>
          {/* Common Resources */}
          <tr>
            <td className="py-2 px-4 border-b border-gray-300">Common (Widely Available)</td>
            <td className="py-2 px-4 border-b border-gray-300">
              <div className="flex items-baseline gap-1">
                <ResourceIcon name="Wood" id={1} />
                <ResourceIcon name="Stone" id={2} />
                <ResourceIcon name="Coal" id={3} />
                <ResourceIcon name="Copper" id={4} />
                <ResourceIcon name="Obsidian" id={5} />
              </div>
            </td>
          </tr>
          {/* Uncommon Resources */}
          <tr>
            <td className="py-2 px-4 border-b border-gray-300">Uncommon (Limited Availability)</td>
            <td className="py-2 px-4 border-b border-gray-300">
              <div className="flex items-baseline gap-1">
                <ResourceIcon name="Silver" id={8} />
                <ResourceIcon name="Ironwood" id={5} />
                <ResourceIcon name="Cold Iron" id={11} />
                <ResourceIcon name="Gold" id={7} />
              </div>
            </td>
          </tr>
          {/* Rare Resources */}
          <tr>
            <td className="py-2 px-4 border-b border-gray-300">Rare (Scarce)</td>
            <td className="py-2 px-4 border-b border-gray-300">
              <div className="flex items-baseline gap-1">
                <ResourceIcon name="Hartwood" id={15} />
                <ResourceIcon name="Diamonds" id={14} />
                <ResourceIcon name="Sapphire" id={20} />
                <ResourceIcon name="Ruby" id={13} />
              </div>
            </td>
          </tr>
          {/* Unique Resources */}
          <tr>
            <td className="py-2 px-4 border-b border-gray-300">Unique (Very Scarce)</td>
            <td className="py-2 px-4 border-b border-gray-300">
              <div className="flex items-baseline gap-1">
                <ResourceIcon name="Deep Crystal" id={12} />
                <ResourceIcon name="Ignium" id={16} />
                <ResourceIcon name="Ethereal Silica" id={21} />
                <ResourceIcon name="True Ice" id={18} />
                <ResourceIcon name="Twilight Quartz" id={17} />
                <ResourceIcon name="Alchemical Silver" id={10} />
              </div>
            </td>
          </tr>
          {/* Mythic Resources */}
          <tr>
            <td className="py-2 px-4 border-b border-gray-300">Mythic (Extremely Rare)</td>
            <td className="py-2 px-4 border-b border-gray-300">
              <div className="flex items-baseline gap-1">
                <ResourceIcon name="Adamantine" id={19} />
                <ResourceIcon name="Mithral" id={9} />
                <ResourceIcon name="Dragonhide" id={22} />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default RarityResourceTable;

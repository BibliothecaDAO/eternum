import { getResourceAddresses } from "@/utils/addresses";
import { ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { colors, section, table } from "./styles";

const RESOURCE_ORDER = [
  ResourcesIds.Wood,
  ResourcesIds.Stone,
  ResourcesIds.Coal,
  ResourcesIds.Copper,
  ResourcesIds.Obsidian,
  ResourcesIds.Silver,
  ResourcesIds.Ironwood,
  ResourcesIds.ColdIron,
  ResourcesIds.Gold,
  ResourcesIds.Hartwood,
  ResourcesIds.Diamonds,
  ResourcesIds.Sapphire,
  ResourcesIds.Ruby,
  ResourcesIds.DeepCrystal,
  ResourcesIds.Ignium,
  ResourcesIds.EtherealSilica,
  ResourcesIds.TrueIce,
  ResourcesIds.TwilightQuartz,
  ResourcesIds.AlchemicalSilver,
  ResourcesIds.Adamantine,
  ResourcesIds.Mithral,
  ResourcesIds.Dragonhide,
  ResourcesIds.AncientFragment,
  ResourcesIds.Donkey,
  ResourcesIds.Knight,
  ResourcesIds.Crossbowman,
  ResourcesIds.Paladin,
  ResourcesIds.Wheat,
  ResourcesIds.Fish,
  ResourcesIds.Lords,
];

const resourceIdChangeBetweenSeason0and1 = (id: ResourcesIds) => {
  if (id === 29) return ResourcesIds.Wheat;
  if (id === 30) return ResourcesIds.Fish;
  if (id === 31) return ResourcesIds.Lords;
  if (id === 28) return ResourcesIds.Paladin;
  if (id === 27) return ResourcesIds.Crossbowman;
  if (id === 26) return ResourcesIds.Knight;
  return id;
};

// Additional component-specific styles
const componentStyles = {
  resourceNameWithId: {
    display: "flex",
    flexDirection: "column" as const,
  },
  resourceId: {
    fontSize: "0.7rem",
    color: "#999",
    marginTop: "0.2rem",
  },
  addressCell: {
    ...table.cell,
    color: colors.secondary,
    fontFamily: "monospace",
    fontSize: "0.8rem",
  },
};

export const ResourceAddresses = () => {
  const addresses = getResourceAddresses();

  // Transform the address data for display
  const addressesArray = Object.entries(addresses)
    .map(([resourceName, data]) => {
      // data is an array where first element is the ID and second is the address
      const id = resourceIdChangeBetweenSeason0and1(data[0] as number);
      const address = data[1] as string;

      // remove the ancient fragment from the list because it's not bridgeable
      if (id === ResourcesIds.AncientFragment) return null;

      return {
        resourceName,
        id,
        address,
      };
    })
    .filter((item) => item !== null)
    .sort((a, b) => {
      // Sort by the order defined in RESOURCE_ORDER
      const indexA = RESOURCE_ORDER.indexOf(a.id);
      const indexB = RESOURCE_ORDER.indexOf(b.id);
      return indexA - indexB;
    });

  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Resource Addresses</div>
      <table style={table.table}>
        <thead>
          <tr>
            <th style={table.headerCell}>Resource</th>
            <th style={table.headerCell}>Address</th>
          </tr>
        </thead>
        <tbody>
          {addressesArray.map((item) => (
            <tr key={`address-${item.id}`}>
              <td style={table.resourceCell}>
                <ResourceIcon id={item.id} name={item.resourceName} size="md" />
                <div style={componentStyles.resourceNameWithId}>
                  {item.resourceName.charAt(0) + item.resourceName.slice(1).toLowerCase()}
                  <span style={componentStyles.resourceId}>ID: {item.id}</span>
                </div>
              </td>
              <td style={componentStyles.addressCell}>{item.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

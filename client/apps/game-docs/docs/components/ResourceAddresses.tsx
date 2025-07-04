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
  ResourcesIds.KnightT2,
  ResourcesIds.KnightT3,
  ResourcesIds.Crossbowman,
  ResourcesIds.CrossbowmanT2,
  ResourcesIds.CrossbowmanT3,
  ResourcesIds.Paladin,
  ResourcesIds.PaladinT2,
  ResourcesIds.PaladinT3,
  ResourcesIds.Wheat,
  ResourcesIds.Fish,
  ResourcesIds.Lords,
];

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
  // get addresses from the config
  const addresses = getResourceAddresses();

  // Transform the address data for display
  const addressesArray = Object.entries(addresses)
    .map(([resourceName, data]) => {
      // data is an array where first element is the ID and second is the address
      const id = data[0];
      const address = data[1] as string;

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
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ minWidth: "2rem", display: "flex", justifyContent: "center" }}>
                    <ResourceIcon id={item.id} name={item.resourceName} size="md" />
                  </div>
                  <div style={componentStyles.resourceNameWithId}>
                    {item.resourceName.charAt(0) + item.resourceName.slice(1).toLowerCase()}
                    <span style={componentStyles.resourceId}>ID: {item.id}</span>
                  </div>
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

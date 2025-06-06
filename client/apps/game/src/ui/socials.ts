type TemplateVariables = {
  // player name and tribe
  attackerNameText: string;
  // player name and tribe
  defenderNameText: string;
  // ex: 5940 T1 Knight
  attackerTroopsText: string;
  // ex: 5940 T1 Knight
  defenderTroopsText: string;
  // game url
  url: string;
  // realm name
  realmName: string;
  // tier emoji
  tierEmoji: string;
  // player name
  addressName: string;
  // 300 diamonds, 100 donkeys, 2000 gold
  raidResources: string;
  // tribe name
  tribeName: string;
  // resource type for village
  resourceType: string;
  // resource probability for village
  resourceProbability: number;
  // resource tier for village
  resourceTier: string;
  // realm resources
  realmResources: string;
};

export const formatSocialText = (template: string, variables: Partial<TemplateVariables>): string => {
  return Object.entries(variables).reduce(
    (text, [key, value]) => text.replace(new RegExp(`{${key}}`, "g"), String(value)),
    template,
  );
};

export const twitterTemplates = {
  combat: `⚔️ BATTLE DECLARED! ⚔️\n\n{attackerNameText} with {attackerTroopsText}\n\n🗡️ VS 🛡️\n\n{defenderNameText} with {defenderTroopsText}\n\nJoin the epic clash for @RealmsEternum at {url}! 🏰⚔️🔥`,
  raid: `🔥 SUCCESSFUL RAID! 🔥\n\n{attackerNameText}\n\n🗡️ VS 🛡️\n\n{defenderNameText} \n\nSpoils of war: {raidResources} 💰\n\nJoin the conquest for @RealmsEternum at {url}! 🏰⚔️🔥`,
  realmSettled: `🏰 REALM SETTLED! 🏰\n\nI, {addressName}, have settled {realmName} in @RealmsEternum!\n\nThis realm produces: {realmResources} ⛏️\n\nSettle your realm at {url}! 🏰💎`,
  villageResourceReveal: `🛖 NEW VILLAGE SETTLED! 🛖\n\nI, {addressName}, have settled a {resourceType} village in @RealmsEternum!\n\nWith a {resourceProbability}% chance of finding this {resourceTier} tier resource!{tierEmoji}{tierEmoji}{tierEmoji}\n\nSettle your village at {url}! 🛖💎`,
  joinedTribe: `⚔️ NEW ALLIANCE FORGED! ⚔️\n\nI, {addressName}, have pledged allegiance to the mighty {tribeName} tribe in @RealmsEternum!\n\nUnited we stand, ready to forge our legacy across the lands!\n\nJoin our ranks at {url}! ✊⚔️`,
  createdTribe: `⚔️ A NEW POWER RISES! ⚔️\n\nI, {addressName}, have founded the {tribeName} tribe in @RealmsEternum!\n\nOur banners now fly over these lands as we forge our destiny!\n\nJoin our ranks at {url}! ✊⚔️`,
};
